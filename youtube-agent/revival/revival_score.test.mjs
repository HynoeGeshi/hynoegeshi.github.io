import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreRevival, classifyRevival } from './revival_score.mjs';

test('strong long-form gaming archive outranks weak low-watch archive', () => {
  const strong = scoreRevival({views:156, watch_minutes:7636, avg_viewed_pct:67.53, subs_gained:0, audience_fit:1, clear_premise:1, duplicate:false, stale_confusion:false});
  const weak = scoreRevival({views:35, watch_minutes:80, avg_viewed_pct:4, subs_gained:0, audience_fit:1, clear_premise:0, duplicate:false, stale_confusion:false});
  assert.ok(strong > weak + 35);
});

test('old-server confusion receives a large penalty', () => {
  const clean = scoreRevival({views:100, watch_minutes:1200, avg_viewed_pct:25, subs_gained:3, audience_fit:1, clear_premise:1, stale_confusion:false});
  const confusing = scoreRevival({views:100, watch_minutes:1200, avg_viewed_pct:25, subs_gained:3, audience_fit:1, clear_premise:1, stale_confusion:true});
  assert.ok(clean - confusing >= 20);
});

test('non-gaming archive is not auto-revived into gaming channel', () => {
  const score = scoreRevival({views:5857, watch_minutes:1002, avg_viewed_pct:183, subs_gained:9, audience_fit:0, clear_premise:1, non_gaming:true});
  assert.equal(classifyRevival(score, {non_gaming:true}), 'asset-only');
});

test('classification creates controlled publish queue', () => {
  assert.equal(classifyRevival(80, {}), 'wave-1');
  assert.equal(classifyRevival(68, {}), 'wave-2');
  assert.equal(classifyRevival(52, {}), 'archive-only');
});
