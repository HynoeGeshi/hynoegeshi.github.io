import test from 'node:test';import assert from 'node:assert/strict';
import {catalogRow, mergeAnalytics, buildCatalogPageRows} from './catalog.mjs';

test('owner metadata preserves privacy/date and duration with missing analytics explicit',()=>{
 const r=catalogRow({id:'abcdefghijk',snippet:{title:'Halo',publishedAt:'2021-01-01'},status:{privacyStatus:'private'},contentDetails:{duration:'PT1H2M3S'},statistics:{viewCount:'10'}},'2026-10-06');
 assert.equal(r.duration_seconds,3723);assert.equal(r.privacy,'private');assert.equal(r.evidence.published_at,'2021-01-01');assert.equal(r.analytics_complete,false);assert.equal(r.evidence.watch_minutes,null);assert.equal(r.evidence.synced_at,'2026-10-06');
});
test('actual analytics populate numeric scoring inputs without substituting views for watch time',()=>{
 const r=catalogRow({id:'abcdefghijk',snippet:{title:'Madden'},status:{privacyStatus:'unlisted'},contentDetails:{duration:'PT2H'},statistics:{viewCount:'10'}},'now');
 const x=mergeAnalytics(r,{views:3000,estimatedMinutesWatched:8000,averageViewDuration:480,averageViewPercentage:75,subscribersGained:10,subscribersLost:0});
 assert.equal(x.analytics_complete,true);assert.equal(x.evidence.watch_minutes,8000);assert.equal(x.evidence.subs_gained,10);assert.ok(x.score>=90);
 assert.equal(mergeAnalytics(r,null).analytics_complete,false);
});
test('canonical scores use numeric performance only; missing subscriber evidence cannot qualify',()=>{
 const r=catalogRow({id:'abcdefghijk',snippet:{title:'Madden Playoffs'},status:{privacyStatus:'unlisted'},contentDetails:{duration:'PT2H'}},'now');
 const a={views:3000,estimatedMinutesWatched:8000,averageViewDuration:480,averageViewPercentage:75,subscribersGained:0,subscribersLost:0};
 const x=mergeAnalytics(r,a);assert.equal(x.score,83.3);
 assert.equal(mergeAnalytics(r,{...a,subscribersLost:undefined}).analytics_complete,false);
});
test('playlist IDs missing from videos.list become non-publishable catalog placeholders',()=>{
 const ids=['abcdefghijk','missing12345'];
 const videos=[{id:'abcdefghijk',snippet:{title:'Madden'},status:{privacyStatus:'unlisted'},contentDetails:{duration:'PT2H'},statistics:{viewCount:'10'}}];
 const rows=buildCatalogPageRows({ids,videos,timestamp:'2026-10-07T00:00:00Z',channelId:'channel'});
 assert.equal(rows.length,2);
 assert.equal(rows[1].video_id,'missing12345');
 assert.equal(rows[1].decision,'unavailable');
 assert.equal(rows[1].analytics_complete,false);
 assert.equal(rows[1].evidence.missing_from_videos_list,true);
});
