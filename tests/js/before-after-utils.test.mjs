import test from 'node:test';
import assert from 'node:assert/strict';
import { clampPercent, keyboardDelta } from '../../assets/js/before-after-utils.mjs';

test('clampPercent stays within slider range', () => {
  assert.equal(clampPercent(-5), 0);
  assert.equal(clampPercent(52), 52);
  assert.equal(clampPercent(140), 100);
});

test('keyboardDelta responds to horizontal arrow keys', () => {
  assert.equal(keyboardDelta('ArrowLeft', 50), 48);
  assert.equal(keyboardDelta('ArrowRight', 50), 52);
  assert.equal(keyboardDelta('Enter', 50), 50);
});
