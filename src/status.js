'use strict';
const path = require('node:path');
const { version } = require('../package.json');
const { loadConfig } = require('./config');
const { loadState } = require('./storage');
const { fmtTime, displayLimitName } = require('./format');
const { readLock, inspectLockOwner } = require('./process-lock');
const config = loadConfig();
const state = loadState(config.storage.stateFile);
const lockPath = path.join(config._root, 'data', 'watcher.lock');
const lock = readLock(lockPath);
const owner = lock ? inspectLockOwner(lock) : { running: false, verified: true, reason: 'no lock file' };
let status;
if (!owner.running) status = 'STOPPED'; else if (owner.verified) status = `RUNNING (PID ${lock.pid})`; else status = `UNKNOWN (PID ${lock.pid}; ${owner.reason})`;
console.log(`Codex Usage Watcher v${version}: ${status}`);
console.log(`実行フォルダ: ${config._root}`);
if (!state) { console.log('まだ利用量スナップショットがありません。'); process.exit(0); }
console.log(`最終取得: ${new Date(state.capturedAt).toLocaleString('ja-JP')}`); console.log('');
for (const w of Object.values(state.windows || {})) {
  console.log(`${displayLimitName(w)} / ${w.slot}`); console.log(`  使用済み: ${w.usedPercent}%`); console.log(`  残り    : ${w.remainingPercent}%`); console.log(`  窓      : ${w.windowDurationMins ?? '?'} 分`); console.log(`  リセット: ${fmtTime(w.resetsAt)}`); if (w.rateLimitReachedType) console.log(`  制限状態: ${w.rateLimitReachedType}`);
}
if (state.resetCredits) { console.log(''); console.log(`Reset Credit: ${state.resetCredits.availableCount ?? '?'} 件`); }
