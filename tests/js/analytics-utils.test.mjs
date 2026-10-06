import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAnalyticsProperties } from '../../assets/js/analytics-utils.mjs';

test('analytics sanitizer keeps categorical data and strips PII/free text', () => {
  const result = sanitizeAnalyticsProperties({
    category: 'nightlife',
    service: 'Portraits',
    step: 2,
    email: 'person@example.com',
    name: 'Person',
    phone: '555',
    details: 'private message',
    message: 'another private message',
    references: 'https://example.com/board',
    location: 'private free text'
  });
  assert.deepEqual(result, { category: 'nightlife', service: 'Portraits', step: 2 });
});
