function clamp(v,min,max){return Math.max(min,Math.min(max,v));}

export function scoreRevival(item={}) {
  const views = Number(item.views||0);
  const watch = Number(item.watch_minutes||0);
  const avg = Number(item.avg_viewed_pct||0);
  const subs = Number(item.subs_gained||0);
  const fit = item.audience_fit ? 1 : 0;
  const premise = item.clear_premise ? 1 : 0;
  let score = 0;

  // Watch time is the largest positive signal because public long-form can
  // contribute toward YPP watch hours after a controlled revival.
  score += clamp(Math.log10(watch + 1) / Math.log10(8001) * 32, 0, 32);
  score += clamp(avg / 75 * 18, 0, 18);
  score += clamp(Math.log10(views + 1) / Math.log10(3001) * 10, 0, 10);
  score += clamp(subs / 10 * 12, 0, 12);
  score += fit * 14;
  score += premise * 10;

  // Quality/channel-coherence penalties override raw historical volume.
  if (item.duplicate) score -= 30;
  if (item.broken) score -= 35;
  if (item.stale_confusion) score -= 25;
  if (item.non_gaming) score -= 18;

  return Math.round(clamp(score, 0, 100) * 10) / 10;
}

export function classifyRevival(score, item={}) {
  if (item.non_gaming) return 'asset-only';
  if (item.duplicate || item.broken) return 'leave-hidden';
  if (score >= 75) return 'wave-1';
  if (score >= 62) return 'wave-2';
  return 'archive-only';
}
