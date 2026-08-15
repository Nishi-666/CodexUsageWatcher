'use strict';

const path = require('node:path');
const { loadConfig } = require('./config');
const { Logger } = require('./logger');
const { AppServerClient } = require('./app-server-client');
const { resolveCodex } = require('./codex-resolver');
const { normalizeRateLimits } = require('./normalize');
const { detectEvents } = require('./detector');
const { loadState, saveState, appendHistory } = require('./storage');
const { Notifier } = require('./notifier');
const { readLock, writeLock, removeLock, inspectLockOwner } = require('./process-lock');

const config = loadConfig();
const logger = new Logger(config.storage.eventLogFile);
const notifier = new Notifier(config, logger);
const lockPath = path.join(config._root, 'data', 'watcher.lock');
const resolvedCodex = resolveCodex(config.codex.command);
logger.info('Codex CLI resolved', { command: resolvedCodex.command, version: resolvedCodex.version, source: resolvedCodex.source });

let stopping = false;
let activeClient = null;
let outageNotified = false;

function acquireLock() {
  const existing = readLock(lockPath);
  if (existing) {
    const owner = inspectLockOwner(existing);
    if (owner.running) throw new Error(`CodexUsageWatcher may already be running (PID ${existing.pid}; ${owner.verified ? 'verified process fingerprint' : owner.reason}).`);
    logger.warn('Removing stale watcher lock', { reason: owner.reason, pid: existing.pid ?? null });
    removeLock(lockPath);
  }
  writeLock(lockPath);
}
function releaseLock() { try { removeLock(lockPath); } catch {} }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function runConnection() {
  const codexCfg = config.codex;
  const client = new AppServerClient({ command: resolvedCodex.command, args: codexCfg.args, requestTimeoutMs: codexCfg.requestTimeoutSeconds * 1000, stderrLogFile: config.storage.appServerLogFile, logger, shell: resolvedCodex.shell });
  activeClient = client;
  let resolveFatal;
  const fatalPromise = new Promise((resolve) => { resolveFatal = resolve; });
  client.on('fatal', (err) => resolveFatal(err));
  await client.start();
  logger.info('Connected to codex app-server');
  try {
    const account = await client.request('account/read', { refreshToken: false });
    logger.info('Codex account state', { accountType: account?.account?.type ?? null, planType: account?.account?.planType ?? null, emailPresent: Boolean(account?.account?.email), requiresOpenaiAuth: account?.requiresOpenaiAuth ?? null });
  } catch (err) { logger.warn('account/read failed; continuing with rate-limit read', { error: err.message }); }

  let refreshInFlight = false;
  let refreshQueued = false;
  const refresh = async (reason) => {
    if (refreshInFlight) { refreshQueued = true; return; }
    refreshInFlight = true;
    try {
      const result = await client.request('account/rateLimits/read');
      const current = normalizeRateLimits(result || {});
      const previous = loadState(config.storage.stateFile);
      const events = detectEvents(previous, current, config.detection);
      appendHistory(config.storage.historyFile, { recordType: 'snapshot', reason, capturedAt: current.capturedAt, windows: current.windows, resetCredits: current.resetCredits });
      for (const evt of events) {
        appendHistory(config.storage.historyFile, { recordType: 'event', ...evt });
        logger.info(`Detected ${evt.type}`, evt);
        await notifier.sendEvent(evt, current);
      }
      saveState(config.storage.stateFile, current);
      if (outageNotified) {
        outageNotified = false;
        if (config.notifications.notifyOnRecovery) await notifier.send('Codex Usage Watcher 復旧', 'Codex app-serverとの接続が復旧し、監視を再開しました。', 'INFO');
      }
    } finally {
      refreshInFlight = false;
      if (refreshQueued) { refreshQueued = false; setTimeout(() => refresh('queued'), 250); }
    }
  };
  let notificationTimer = null;
  const handleRefreshError = (err) => logger.warn('Rate-limit refresh failed', { error: err.message });
  client.on('notification', (msg) => {
    if (msg.method === 'account/rateLimits/updated') {
      clearTimeout(notificationTimer);
      notificationTimer = setTimeout(() => refresh('account/rateLimits/updated').catch(handleRefreshError), 350);
    }
  });
  await refresh('startup');
  if (config.notifications.notifyOnStartup) await notifier.send('Codex Usage Watcher 起動', 'Codex利用量の監視を開始しました。', 'INFO');
  const pollMs = Math.max(15, codexCfg.pollIntervalSeconds) * 1000;
  const pollTimer = setInterval(() => refresh('poll').catch(handleRefreshError), pollMs);
  try { throw await fatalPromise; } finally { clearInterval(pollTimer); clearTimeout(notificationTimer); client.close(); activeClient = null; }
}

async function main() {
  acquireLock();
  logger.info('Codex Usage Watcher starting', { pid: process.pid, node: process.version });
  let attempt = 0;
  while (!stopping) {
    try { await runConnection(); attempt = 0; }
    catch (err) {
      if (stopping) break;
      attempt += 1;
      const delaySec = Math.min(config.codex.restartMaxDelaySeconds || 60, Math.max(2, Math.pow(2, Math.min(attempt, 6))));
      logger.error('Codex app-server connection failed', { error: err.message, retryInSeconds: delaySec });
      if (!outageNotified) {
        outageNotified = true;
        await notifier.send('Codex Usage Watcher 監視不能', `Codex app-serverに接続できません。自動再接続します。\n${err.message}`, 'ERROR');
      }
      await sleep(delaySec * 1000);
    }
  }
}
async function shutdown(signal) { if (stopping) return; stopping = true; logger.info(`Stopping due to ${signal}`); if (activeClient) activeClient.close(); releaseLock(); setTimeout(() => process.exit(0), 100).unref(); }
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => { logger.error('Uncaught exception', { error: err.stack || err.message }); releaseLock(); process.exit(1); });
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', { error: reason?.stack || String(reason) }));
process.on('exit', releaseLock);
main().catch((err) => { logger.error('Fatal startup error', { error: err.stack || err.message }); releaseLock(); process.exit(1); });
