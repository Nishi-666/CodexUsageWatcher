'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ROOT } = require('./config');
const { readLock, removeLock, inspectLockOwner } = require('./process-lock');
const lockPath = path.join(ROOT, 'data', 'watcher.lock');
const lock = readLock(lockPath);
if (!lock) { console.log('Codex Usage Watcher is not running, or no lock file exists.'); process.exit(0); }
if (!lock.valid) { console.warn(`Invalid lock file (${lock.reason}). Removing it without terminating any process.`); removeLock(lockPath); process.exit(0); }
const owner = inspectLockOwner(lock);
if (!owner.running) { console.log(`Stale lock detected (${owner.reason}). Removing it without terminating any process.`); removeLock(lockPath); process.exit(0); }
if (!owner.verified) { console.error(`Refusing to terminate PID ${lock.pid}: ${owner.reason}.`); console.error('Remove data\\watcher.lock manually only after confirming the watcher is not running.'); process.exit(2); }
console.log(`Stopping verified Codex Usage Watcher PID ${lock.pid} ...`);
const result = spawnSync('taskkill.exe', ['/PID', String(lock.pid), '/T'], { encoding: 'utf8', windowsHide: true });
if (result.error) { console.error(`Failed to run taskkill: ${result.error.message}`); process.exit(1); }
if (result.status !== 0) { const detail = String(result.stderr || result.stdout || '').trim(); console.error(`taskkill failed (exit ${result.status})${detail ? `: ${detail}` : ''}`); process.exit(result.status || 1); }
removeLock(lockPath); console.log('Done.');
