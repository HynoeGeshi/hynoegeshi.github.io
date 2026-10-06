export function nextIndex(current, length) {
  if (!Number.isFinite(length) || length <= 0) return -1;
  return (current + 1 + length) % length;
}

export function previousIndex(current, length) {
  if (!Number.isFinite(length) || length <= 0) return -1;
  return (current - 1 + length) % length;
}

export function normalizeCategory(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'all';
}
