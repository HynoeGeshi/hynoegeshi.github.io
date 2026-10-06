import test from 'node:test';
import assert from 'node:assert/strict';
import { isReducedMotion, setExpanded } from '../../assets/js/site-utils.mjs';

test('setExpanded writes aria-expanded', () => {
  const attrs = {};
  const el = { setAttribute: (key, value) => { attrs[key] = value; } };
  setExpanded(el, true);
  assert.equal(attrs['aria-expanded'], 'true');
  setExpanded(el, false);
  assert.equal(attrs['aria-expanded'], 'false');
});

test('isReducedMotion returns injected media query state', () => {
  assert.equal(isReducedMotion({ matches: true }), true);
  assert.equal(isReducedMotion({ matches: false }), false);
});
