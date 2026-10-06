const BLOCKED_KEYS = new Set([
  'email', 'name', 'phone', 'details', 'message', 'references', 'reference',
  'referenceurl', 'referenceurls', 'location', 'budgetnote', 'notes', 'vision'
]);

export function sanitizeAnalyticsProperties(properties = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(properties)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (BLOCKED_KEYS.has(normalized)) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      safe[key] = value;
    }
  }
  return safe;
}
