import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeService, validateStep, buildSubmissionPayload } from '../../assets/js/booking-utils.mjs';

test('normalizeService accepts known services and rejects unknown values', () => {
  assert.equal(normalizeService('Editing Only'), 'Editing Only');
  assert.equal(normalizeService('Nightlife'), 'Nightlife');
  assert.equal(normalizeService('Totally Fake Package'), '');
});

test('validateStep checks only fields required for that step', () => {
  assert.deepEqual(validateStep('service', { service: '' }), ['service']);
  assert.deepEqual(validateStep('service', { service: 'Portraits' }), []);
  assert.deepEqual(validateStep('schedule', { dateRange: '', location: 'Chicago' }), ['dateRange']);
  assert.deepEqual(validateStep('contact', { name: 'T', email: 'bad' }), ['email']);
  assert.deepEqual(validateStep('contact', { name: 'T', email: 't@example.com' }), []);
});

test('buildSubmissionPayload keeps booking fields and excludes internal analytics state', () => {
  const payload = buildSubmissionPayload({
    service: 'Nightlife', name: 'T', email: 't@example.com', dateRange: 'Oct 10',
    location: 'Chicago', details: 'Neon vibe', references: 'https://example.com',
    analyticsSession: 'secret-internal', currentStep: 4
  });
  assert.equal(payload.service, 'Nightlife');
  assert.equal(payload.details, 'Neon vibe');
  assert.equal('analyticsSession' in payload, false);
  assert.equal('currentStep' in payload, false);
});
