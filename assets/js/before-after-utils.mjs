export function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.min(100, Math.max(0, number));
}

export function keyboardDelta(key, current) {
  if (key === 'ArrowLeft') return clampPercent(Number(current) - 2);
  if (key === 'ArrowRight') return clampPercent(Number(current) + 2);
  return clampPercent(current);
}
