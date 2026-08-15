'use strict';

function normalizeRateLimits(result) {
  const now = Date.now();
  const rawMap = result?.rateLimitsByLimitId && typeof result.rateLimitsByLimitId === 'object' ? result.rateLimitsByLimitId : null;
  const source = rawMap || (result?.rateLimits ? { [result.rateLimits.limitId || 'codex']: result.rateLimits } : {});
  const windows = {};
  for (const [mapKey, bucket] of Object.entries(source)) {
    if (!bucket) continue;
    const limitId = bucket.limitId || mapKey;
    for (const slot of ['primary', 'secondary']) {
      const w = bucket[slot];
      if (!w || typeof w.usedPercent !== 'number') continue;
      const key = `${limitId}:${slot}`;
      windows[key] = { key, limitId, limitName: bucket.limitName ?? null, slot, usedPercent: clamp(w.usedPercent, 0, 100), remainingPercent: clamp(100 - w.usedPercent, 0, 100), windowDurationMins: numberOrNull(w.windowDurationMins), resetsAt: numberOrNull(w.resetsAt), planType: bucket.planType ?? null, rateLimitReachedType: bucket.rateLimitReachedType ?? null };
    }
  }
  const resetCredits = result?.rateLimitResetCredits ? { availableCount: numberOrNull(result.rateLimitResetCredits.availableCount), credits: Array.isArray(result.rateLimitResetCredits.credits) ? result.rateLimitResetCredits.credits.map((c) => ({ id: c.id ?? null, resetType: c.resetType ?? null, status: c.status ?? null, grantedAt: numberOrNull(c.grantedAt), expiresAt: numberOrNull(c.expiresAt), title: c.title ?? null, description: c.description ?? null })) : null } : null;
  return { capturedAt: now, windows, resetCredits };
}
function numberOrNull(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
module.exports = { normalizeRateLimits };
