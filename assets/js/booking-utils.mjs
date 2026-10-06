const SERVICES = new Set([
  'Portraits',
  'Nightlife',
  'Music + Events',
  'Music / Artist Content',
  'Events',
  'Brand + Lifestyle',
  'Editing Only'
]);

export function normalizeService(value) {
  const candidate = String(value ?? '').trim();
  return SERVICES.has(candidate) ? candidate : '';
}

export function validateStep(stepId, data = {}) {
  const missing = [];
  if (stepId === 'service') {
    if (!normalizeService(data.service)) missing.push('service');
  }
  if (stepId === 'schedule') {
    if (!String(data.dateRange ?? '').trim()) missing.push('dateRange');
    if (!String(data.location ?? '').trim()) missing.push('location');
  }
  if (stepId === 'vision') {
    return missing;
  }
  if (stepId === 'contact') {
    if (!String(data.name ?? '').trim()) missing.push('name');
    const email = String(data.email ?? '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) missing.push('email');
  }
  return missing;
}

export function buildSubmissionPayload(data = {}) {
  const allowed = ['service', 'dateRange', 'location', 'details', 'references', 'name', 'email', 'budgetNote'];
  return Object.fromEntries(allowed.map((key) => [key, String(data[key] ?? '').trim()]));
}

export const BOOKING_SERVICES = [...SERVICES];
