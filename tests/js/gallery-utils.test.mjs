import test from 'node:test';
import assert from 'node:assert/strict';
import { nextIndex, previousIndex, normalizeCategory } from '../../assets/js/gallery-utils.mjs';

test('gallery index wraps in both directions', () => {
  assert.equal(nextIndex(7, 8), 0);
  assert.equal(previousIndex(0, 8), 7);
  assert.equal(nextIndex(0, 0), -1);
  assert.equal(previousIndex(0, 0), -1);
});

test('normalizeCategory creates stable category tokens', () => {
  assert.equal(normalizeCategory('Music / Artists'), 'music-artists');
  assert.equal(normalizeCategory('  Nightlife  '), 'nightlife');
  assert.equal(normalizeCategory(''), 'all');
});
