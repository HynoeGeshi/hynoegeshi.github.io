export const EDITING_SERVICE = 'Editing Only';

const SERVICES = new Set([
  'Portraits',
  'Nightlife',
  'Music + Events',
  'Music / Artist Content',
  'Events',
  'Brand + Lifestyle',
  EDITING_SERVICE
]);

export function normalizeService(value) {
  const candidate = String(value ?? '').trim();
  if (candidate === 'Music + Events') return 'Music / Artist Content';
  return SERVICES.has(candidate) ? candidate : '';
}

export function validateStep(stepId, data = {}) {
  const missing = [];
  if (stepId === 'service') {
    if (!normalizeService(data.service)) missing.push('service');
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
  const payload = Object.fromEntries(allowed.map((key) => [key, String(data[key] ?? '').trim()]));
  if (payload.service === EDITING_SERVICE && Object.hasOwn(data, 'editingDeadline')) {
    payload.dateRange = String(data.editingDeadline ?? '').trim() || 'Flexible';
    payload.location = '';
  }
  return payload;
}

export const BOOKING_SERVICES = [...SERVICES];
