export function setExpanded(el, expanded) {
  if (!el) return;
  el.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

export function isReducedMotion(mediaQuery = null) {
  const query = mediaQuery ?? (typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false });
  return Boolean(query?.matches);
}
