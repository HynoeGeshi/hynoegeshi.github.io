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

test('editing deadline is optional and shoot details stay out of editing requests', () => {
  assert.deepEqual(validateStep('schedule', { service: 'Editing Only', editingDeadline: '' }), []);
  assert.deepEqual(validateStep('schedule', { service: 'Events' }), ['dateRange', 'location']);
  const values = { service: 'Editing Only', dateRange: 'November 20', location: 'Chicago', editingDeadline: '' };
  const flexible = buildSubmissionPayload(values);
  assert.equal(flexible.dateRange, 'Flexible');
  assert.equal(flexible.location, '');
  assert.equal(buildSubmissionPayload({ ...values, editingDeadline: ' November 30 ' }).dateRange, 'November 30');
  const shoot = buildSubmissionPayload({ ...values, service: 'Events', editingDeadline: 'November 30' });
  assert.equal(shoot.dateRange, 'November 20');
  assert.equal(shoot.location, 'Chicago');
  const legacy = { service: 'Editing Only', dateRange: 'November 20', location: 'Chicago' };
  assert.equal(buildSubmissionPayload(legacy).dateRange, 'November 20');
  assert.equal(buildSubmissionPayload(legacy).location, 'Chicago');
});
