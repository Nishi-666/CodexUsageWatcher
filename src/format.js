'use strict';

function formatEvent(evt, snapshot) {
  const w = evt.windowKey ? snapshot.windows?.[evt.windowKey] : null;
  const label = w ? `${displayLimitName(w)} / ${slotLabel(w.slot)}` : 'Codex';

  switch (evt.type) {
    case 'NORMAL_RESET':
      return { title: 'Codex 使用量が定期リセットされました', body: `${label}\n使用済み ${fmt(evt.details.previousUsedPercent)}% → ${fmt(evt.details.currentUsedPercent)}%\n残り ${fmt(w?.remainingPercent)}%\n次回リセット: ${fmtTime(w?.resetsAt)}` };
    case 'EARLY_RESET':
      return { title: 'Codex 予定外リセットを検出', body: `${label}\n使用済み ${fmt(evt.details.previousUsedPercent)}% → ${fmt(evt.details.currentUsedPercent)}%\n${fmt(evt.details.recoveredPoints)}ポイント回復\n次回リセット: ${fmtTime(w?.resetsAt)}` };
    case 'RESET_TIME_CHANGED':
      return { title: 'Codex リセット時刻が変更されました', body: `${label}\n変更前: ${fmtTime(evt.details.previousResetsAt)}\n変更後: ${fmtTime(evt.details.currentResetsAt)}\n差: ${fmtDuration(evt.details.changedBySeconds)}` };
    case 'LOW_REMAINING':
      return { title: `Codex 残量 ${evt.details.remainingThreshold}% 以下`, body: `${label}\n使用済み ${fmt(w?.usedPercent)}% / 残り ${fmt(w?.remainingPercent)}%\nリセット: ${fmtTime(w?.resetsAt)}` };
    case 'LIMIT_REACHED':
    case 'SERVER_LIMIT_REACHED':
      return { title: 'Codex 利用上限を検出', body: `${label}\n使用済み ${fmt(w?.usedPercent)}% / 残り ${fmt(w?.remainingPercent)}%\nリセット: ${fmtTime(w?.resetsAt)}` };
    case 'RESET_CREDIT_ADDED': return { title: 'Codex Reset Credit が追加されました', body: `Reset Credit: ${evt.details.previousCount} → ${evt.details.currentCount}` };
    case 'RESET_CREDIT_DECREASED': return { title: 'Codex Reset Credit 数が変化しました', body: `Reset Credit: ${evt.details.previousCount} → ${evt.details.currentCount}` };
    case 'WINDOW_ADDED': return { title: 'Codex 利用枠が追加されました', body: label };
    case 'WINDOW_REMOVED': return { title: 'Codex 利用枠が消失しました', body: label };
    default: return { title: `Codex Usage Watcher: ${evt.type}`, body: label };
  }
}

function displayLimitName(w) { return w.limitName || w.limitId || 'Codex'; }
function slotLabel(slot) { if (slot === 'primary') return 'Primary'; if (slot === 'secondary') return 'Secondary'; return slot || ''; }
function fmt(value) { return typeof value === 'number' ? String(Math.round(value * 10) / 10) : '?'; }
function fmtTime(unixSeconds) {
  if (typeof unixSeconds !== 'number') return '不明';
  return new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(unixSeconds * 1000));
}
function fmtDuration(seconds) {
  if (typeof seconds !== 'number') return '不明';
  const sign = seconds >= 0 ? '+' : '-';
  const a = Math.abs(seconds);
  if (a >= 86400) return `${sign}${(a / 86400).toFixed(1)}日`;
  if (a >= 3600) return `${sign}${(a / 3600).toFixed(1)}時間`;
  if (a >= 60) return `${sign}${Math.round(a / 60)}分`;
  return `${sign}${Math.round(a)}秒`;
}
module.exports = { formatEvent, fmtTime, displayLimitName };
