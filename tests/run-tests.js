'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { detectEvents, isEffectivelyExhausted } = require('../src/detector');
const { normalizeRateLimits } = require('../src/normalize');
const { resolveCodex } = require('../src/codex-resolver');
const { readLock } = require('../src/process-lock');

const cfg = {
  resetDropMinPoints: 3,
  normalResetGraceSeconds: 600,
  resetTimeChangeMinSeconds: 60,
  remainingWarningThresholds: [20, 10, 5, 0]
};

function snap(capturedAt, used, reset, extra = {}) {
  return {
    capturedAt,
    windows: {
      'codex:primary': {
        key: 'codex:primary', limitId: 'codex', limitName: null, slot: 'primary',
        usedPercent: used, remainingPercent: 100 - used, windowDurationMins: 300,
        resetsAt: reset, planType: 'plus', rateLimitReachedType: extra.rateLimitReachedType || null
      }
    },
    resetCredits: extra.resetCredits ?? { availableCount: 1, credits: null }
  };
}

let passed = 0;
function test(name, fn) {
  try { fn(); console.log(`PASS ${name}`); passed += 1; }
  catch (err) { console.error(`FAIL ${name}`); throw err; }
}

test('normalize multi-bucket response', () => {
  const n = normalizeRateLimits({
    rateLimitsByLimitId: {
      codex: { limitId: 'codex', primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 2000 }, secondary: null },
      other: { limitId: 'other', primary: { usedPercent: 40, windowDurationMins: 10080, resetsAt: 3000 }, secondary: null }
    },
    rateLimitResetCredits: { availableCount: 2, credits: null }
  });
  assert.equal(Object.keys(n.windows).length, 2);
  assert.equal(n.windows['codex:primary'].remainingPercent, 75);
  assert.equal(n.resetCredits.availableCount, 2);
});

test('detect scheduled reset', () => {
  const reset = 2_000_000;
  const prev = snap((reset - 60) * 1000, 85, reset);
  const cur = snap((reset + 30) * 1000, 1, reset + 300);
  const events = detectEvents(prev, cur, cfg);
  assert(events.some((e) => e.type === 'NORMAL_RESET'));
});

test('detect early reset', () => {
  const reset = 2_000_000;
  const prev = snap((reset - 3600) * 1000, 85, reset);
  const cur = snap((reset - 3500) * 1000, 2, reset + 5000);
  const events = detectEvents(prev, cur, cfg);
  assert(events.some((e) => e.type === 'EARLY_RESET'));
});

test('detect reset time change without usage reset', () => {
  const prev = snap(1_000_000, 50, 2000);
  const cur = snap(1_060_000, 51, 5600);
  const events = detectEvents(prev, cur, cfg);
  assert(events.some((e) => e.type === 'RESET_TIME_CHANGED'));
});

test('suppress reset time change while usage remains at 100 percent', () => {
  const prev = snap(1_000_000, 100, 2000);
  const cur = snap(1_060_000, 100, 2060);
  const events = detectEvents(prev, cur, cfg);
  assert(!events.some((e) => e.type === 'RESET_TIME_CHANGED'));
});

test('treat UI-rounded near-100 usage as exhausted', () => {
  const w = snap(1_000_000, 99.6, 2000).windows['codex:primary'];
  assert.equal(isEffectivelyExhausted(w), true);
});

test('do not treat 99.4 percent as exhausted without server limit state', () => {
  const w = snap(1_000_000, 99.4, 2000).windows['codex:primary'];
  assert.equal(isEffectivelyExhausted(w), false);
});

test('server limit state counts as exhausted even below near-100 threshold', () => {
  const w = snap(1_000_000, 98, 2000, { rateLimitReachedType: 'hard_limit' }).windows['codex:primary'];
  assert.equal(isEffectivelyExhausted(w), true);
});

test('suppress reset time movement at 99.6 percent', () => {
  const prev = snap(1_000_000, 99.6, 2000);
  const cur = snap(1_060_000, 99.6, 2060);
  const events = detectEvents(prev, cur, cfg);
  assert(!events.some((e) => e.type === 'RESET_TIME_CHANGED'));
});

test('continue suppressing moving reset time on repeated exhausted polls', () => {
  const first = snap(1_000_000, 100, 2000);
  const second = snap(1_060_000, 100, 2060);
  const third = snap(1_120_000, 100, 2120);
  assert(!detectEvents(first, second, cfg).some((e) => e.type === 'RESET_TIME_CHANGED'));
  assert(!detectEvents(second, third, cfg).some((e) => e.type === 'RESET_TIME_CHANGED'));
});

test('still detect recovery from 100 percent as a reset', () => {
  const reset = 2_000_000;
  const prev = snap((reset - 60) * 1000, 100, reset);
  const cur = snap((reset + 30) * 1000, 0, reset + 300);
  const events = detectEvents(prev, cur, cfg);
  assert(events.some((e) => e.type === 'NORMAL_RESET'));
  assert(!events.some((e) => e.type === 'RESET_TIME_CHANGED'));
});

test('detect remaining threshold crossing', () => {
  const prev = snap(1_000_000, 79, 2000);
  const cur = snap(1_060_000, 81, 2000);
  const events = detectEvents(prev, cur, cfg);
  assert(events.some((e) => e.type === 'LOW_REMAINING' && e.details.remainingThreshold === 20));
});

test('scheduled reset after watcher downtime is not mislabeled early', () => {
  const reset = 2_000_000;
  const prev = snap((reset - 1800) * 1000, 70, reset);
  const cur = snap((reset + 7200) * 1000, 5, reset + 10080);
  const events = detectEvents(prev, cur, cfg);
  assert(events.some((e) => e.type === 'NORMAL_RESET'));
  assert(!events.some((e) => e.type === 'EARLY_RESET'));
});

test('small usage drop plus new reset window still detects reset', () => {
  const reset = 2_000_000;
  const prev = snap((reset - 60) * 1000, 2, reset);
  const cur = snap((reset + 30) * 1000, 0, reset + 300);
  const events = detectEvents(prev, cur, cfg);
  assert(events.some((e) => e.type === 'NORMAL_RESET'));
});

test('resolve Codex from PATH without assuming command shell state', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-watcher-test-'));
  const oldPath = process.env.PATH;
  try {
    if (process.platform === 'win32') {
      const shim = path.join(dir, 'codex.cmd');
      fs.writeFileSync(shim, '@echo off\r\nif "%1"=="--version" (echo codex-cli 9.9.9-test& exit /b 0)\r\nexit /b 1\r\n', 'utf8');
    } else {
      const shim = path.join(dir, 'codex');
      fs.writeFileSync(shim, '#!/bin/sh\n[ "$1" = "--version" ] && { echo "codex-cli 9.9.9-test"; exit 0; }\nexit 1\n', 'utf8');
      fs.chmodSync(shim, 0o755);
    }
    process.env.PATH = `${dir}${path.delimiter}${oldPath || ''}`;
    const found = resolveCodex('auto');
    assert.match(found.version, /9\.9\.9-test/);
    assert.equal(found.source, 'PATH');
  } finally {
    process.env.PATH = oldPath;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('parse JSON process lock', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-watcher-lock-'));
  const file = path.join(dir, 'watcher.lock');
  try {
    fs.writeFileSync(file, JSON.stringify({ pid: 1234, processStartedAtMs: 1700000000000 }), 'utf8');
    const lock = readLock(file);
    assert.equal(lock.valid, true);
    assert.equal(lock.legacy, false);
    assert.equal(lock.pid, 1234);
    assert.equal(lock.processStartedAtMs, 1700000000000);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('parse legacy PID-only lock without treating it as verified', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-watcher-lock-'));
  const file = path.join(dir, 'watcher.lock');
  try {
    fs.writeFileSync(file, '4321\n', 'utf8');
    const lock = readLock(file);
    assert.equal(lock.valid, true);
    assert.equal(lock.legacy, true);
    assert.equal(lock.pid, 4321);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('detect reset credit added', () => {
  const prev = snap(1_000_000, 10, 2000, { resetCredits: { availableCount: 1, credits: null } });
  const cur = snap(1_060_000, 11, 2000, { resetCredits: { availableCount: 2, credits: null } });
  const events = detectEvents(prev, cur, cfg);
  assert(events.some((e) => e.type === 'RESET_CREDIT_ADDED'));
});

console.log(`\n${passed} tests passed.`);
