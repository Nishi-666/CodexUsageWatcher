'use strict';

const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const START_TIME_TOLERANCE_MS = 3000;
function estimateCurrentProcessStartMs() { return Date.now() - Math.round(process.uptime() * 1000); }
function readLock(lockPath) {
  let text;
  try { text = fs.readFileSync(lockPath, 'utf8').trim(); } catch (err) { if (err.code === 'ENOENT') return null; throw err; }
  if (!text) return { valid: false, reason: 'empty lock file' };
  if (/^\d+$/.test(text)) return { valid: true, legacy: true, pid: Number(text), processStartedAtMs: null };
  try {
    const parsed = JSON.parse(text); const pid = Number(parsed.pid); const processStartedAtMs = Number(parsed.processStartedAtMs);
    if (!Number.isInteger(pid) || pid <= 0 || !Number.isFinite(processStartedAtMs)) return { valid: false, reason: 'invalid lock fields' };
    return { valid: true, legacy: false, pid, processStartedAtMs };
  } catch { return { valid: false, reason: 'invalid lock JSON' }; }
}
function writeLock(lockPath) { const lock = { pid: process.pid, processStartedAtMs: estimateCurrentProcessStartMs() }; fs.writeFileSync(lockPath, `${JSON.stringify(lock)}\n`, 'utf8'); return lock; }
function removeLock(lockPath) { try { fs.unlinkSync(lockPath); } catch (err) { if (err.code !== 'ENOENT') throw err; } }
function isPidAlive(pid) { try { process.kill(pid, 0); return true; } catch (err) { if (err.code === 'ESRCH') return false; if (err.code === 'EPERM') return true; return false; } }
function getWindowsProcessStartMs(pid) {
  const command = ['$ErrorActionPreference = "Stop"', `$p = Get-Process -Id ${pid}`, '$p.StartTime.ToUniversalTime().ToString("o")'].join('; ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
  if (result.error || result.status !== 0) return null;
  const value = String(result.stdout || '').trim().split(/\r?\n/).filter(Boolean).at(-1);
  const ms = Date.parse(value); return Number.isFinite(ms) ? ms : null;
}
function inspectLockOwner(lock) {
  if (!lock?.valid || !Number.isInteger(lock.pid) || lock.pid <= 0) return { running: false, verified: false, reason: lock?.reason || 'invalid lock' };
  if (!isPidAlive(lock.pid)) return { running: false, verified: true, reason: 'process not found' };
  if (lock.legacy || !Number.isFinite(lock.processStartedAtMs)) return { running: true, verified: false, reason: 'legacy PID-only lock cannot be fingerprinted' };
  if (process.platform !== 'win32') return { running: true, verified: false, reason: 'process start fingerprint is Windows-only' };
  const actualStartMs = getWindowsProcessStartMs(lock.pid);
  if (!Number.isFinite(actualStartMs)) return { running: true, verified: false, reason: 'could not read process start time' };
  const deltaMs = Math.abs(actualStartMs - lock.processStartedAtMs);
  if (deltaMs > START_TIME_TOLERANCE_MS) return { running: false, verified: true, reason: 'PID was reused by another process', deltaMs };
  return { running: true, verified: true, reason: 'PID and process start time match', deltaMs };
}
module.exports = { START_TIME_TOLERANCE_MS, estimateCurrentProcessStartMs, readLock, writeLock, removeLock, inspectLockOwner };
