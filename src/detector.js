'use strict';

function detectEvents(previous, current, cfg) {
  const events = [];
  if (!previous) return events;

  const prevWindows = previous.windows || {};
  const curWindows = current.windows || {};
  const allKeys = new Set([...Object.keys(prevWindows), ...Object.keys(curWindows)]);

  for (const key of allKeys) {
    const prev = prevWindows[key];
    const cur = curWindows[key];

    if (!prev && cur) {
      events.push(event('WINDOW_ADDED', 'INFO', cur, { current: cur }));
      continue;
    }
    if (prev && !cur) {
      events.push(event('WINDOW_REMOVED', 'WARNING', prev, { previous: prev }));
      continue;
    }
    if (!prev || !cur) continue;

    const usedDrop = prev.usedPercent - cur.usedPercent;
    const resetTimeDiff = diffSeconds(prev.resetsAt, cur.resetsAt);
    const resetTimeMovedForward = resetTimeDiff !== null && resetTimeDiff >= cfg.resetTimeChangeMinSeconds;
    const enoughDrop = usedDrop >= cfg.resetDropMinPoints;
    const smallDropWithNewWindow = usedDrop > 0 && resetTimeMovedForward;
    const currentLimitReached = cur.usedPercent >= 100;

    let resetDetected = false;
    if (enoughDrop || smallDropWithNewWindow) {
      resetDetected = true;
      const oldResetMs = prev.resetsAt == null ? null : prev.resetsAt * 1000;
      const deltaFromScheduledSec = oldResetMs == null ? null : Math.abs(current.capturedAt - oldResetMs) / 1000;
      const crossedScheduledBoundary = oldResetMs !== null
        && previous.capturedAt <= oldResetMs + cfg.normalResetGraceSeconds * 1000
        && current.capturedAt >= oldResetMs - cfg.normalResetGraceSeconds * 1000;
      const isScheduled = crossedScheduledBoundary
        || (deltaFromScheduledSec !== null && deltaFromScheduledSec <= cfg.normalResetGraceSeconds);

      events.push(event(
        isScheduled ? 'NORMAL_RESET' : 'EARLY_RESET',
        isScheduled ? 'INFO' : 'IMPORTANT',
        cur,
        {
          previousUsedPercent: prev.usedPercent,
          currentUsedPercent: cur.usedPercent,
          recoveredPoints: usedDrop,
          previousResetsAt: prev.resetsAt,
          currentResetsAt: cur.resetsAt,
          secondsFromPreviousScheduledReset: oldResetMs == null ? null : Math.round((current.capturedAt - oldResetMs) / 1000)
        }
      ));
    }

    // While the usage window is exhausted, Codex may move resetsAt as the
    // server refreshes its limit state. Treating each movement as a real
    // schedule change causes one notification per poll. The actual recovery
    // is still detected above when usedPercent drops from 100%.
    if (!resetDetected && !currentLimitReached && resetTimeDiff !== null && Math.abs(resetTimeDiff) >= cfg.resetTimeChangeMinSeconds) {
      events.push(event('RESET_TIME_CHANGED', 'NOTICE', cur, {
        previousResetsAt: prev.resetsAt,
        currentResetsAt: cur.resetsAt,
        changedBySeconds: resetTimeDiff
      }));
    }

    for (const remainingThreshold of cfg.remainingWarningThresholds || []) {
      const usedThreshold = 100 - remainingThreshold;
      if (prev.usedPercent < usedThreshold && cur.usedPercent >= usedThreshold) {
        events.push(event(remainingThreshold === 0 ? 'LIMIT_REACHED' : 'LOW_REMAINING', remainingThreshold <= 5 ? 'WARNING' : 'NOTICE', cur, { remainingThreshold }));
      }
    }

    if (prev.rateLimitReachedType !== cur.rateLimitReachedType && cur.rateLimitReachedType) {
      events.push(event('SERVER_LIMIT_REACHED', 'WARNING', cur, { previousType: prev.rateLimitReachedType, currentType: cur.rateLimitReachedType }));
    }
  }

  const prevCredits = previous.resetCredits?.availableCount;
  const curCredits = current.resetCredits?.availableCount;
  if (typeof prevCredits === 'number' && typeof curCredits === 'number' && prevCredits !== curCredits) {
    events.push({
      type: curCredits > prevCredits ? 'RESET_CREDIT_ADDED' : 'RESET_CREDIT_DECREASED',
      severity: curCredits > prevCredits ? 'NOTICE' : 'INFO',
      timestamp: current.capturedAt,
      details: { previousCount: prevCredits, currentCount: curCredits, delta: curCredits - prevCredits }
    });
  }

  return dedupe(events);
}

function diffSeconds(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  return b - a;
}

function event(type, severity, window, details) {
  return { type, severity, timestamp: Date.now(), windowKey: window.key, limitId: window.limitId, limitName: window.limitName, slot: window.slot, details };
}

function dedupe(events) {
  const seen = new Set();
  return events.filter((e) => {
    const signature = `${e.type}|${e.windowKey || ''}|${JSON.stringify(e.details)}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

module.exports = { detectEvents };
