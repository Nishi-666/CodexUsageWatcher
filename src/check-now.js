'use strict';

const { loadConfig } = require('./config');
const { Logger } = require('./logger');
const { AppServerClient } = require('./app-server-client');
const { resolveCodex } = require('./codex-resolver');
const { normalizeRateLimits } = require('./normalize');
const { fmtTime, displayLimitName } = require('./format');

(async () => {
  const config = loadConfig();
  const logger = new Logger(config.storage.eventLogFile);
  const resolvedCodex = resolveCodex(config.codex.command);
  console.log(`Codex CLI: ${resolvedCodex.version}`);
  console.log(`Codex path: ${resolvedCodex.command}`);
  const client = new AppServerClient({
    command: resolvedCodex.command,
    args: config.codex.args,
    requestTimeoutMs: config.codex.requestTimeoutSeconds * 1000,
    stderrLogFile: config.storage.appServerLogFile,
    logger,
    shell: resolvedCodex.shell
  });

  try {
    await client.start();
    const account = await client.request('account/read', { refreshToken: false });
    const result = await client.request('account/rateLimits/read');
    const state = normalizeRateLimits(result || {});

    console.log('Codex app-server: OK');
    console.log(`Account type: ${account?.account?.type ?? 'unknown'}`);
    console.log(`Plan: ${account?.account?.planType ?? 'unknown'}`);
    console.log('');

    const windows = Object.values(state.windows || {});
    if (!windows.length) {
      console.log('Rate-limit windows were not returned.');
      process.exitCode = 2;
      return;
    }
    for (const w of windows) {
      console.log(`${displayLimitName(w)} / ${w.slot}`);
      console.log(`  used:      ${w.usedPercent}%`);
      console.log(`  remaining: ${w.remainingPercent}%`);
      console.log(`  window:    ${w.windowDurationMins ?? '?'} min`);
      console.log(`  resets:    ${fmtTime(w.resetsAt)}`);
    }
    if (state.resetCredits) console.log(`\nReset Credit: ${state.resetCredits.availableCount ?? '?'} `);
  } finally {
    client.close();
  }
})().catch((err) => {
  console.error(`LIVE CHECK FAILED: ${err.message}`);
  process.exit(1);
});
