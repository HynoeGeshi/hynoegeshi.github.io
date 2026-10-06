import test from 'node:test';
import assert from 'node:assert/strict';
import { packageRevival, assessCatalog, promotionAllowed, runOne } from './queue_policy.mjs';

test('packages approved ranks without inflating scores, cleans links and separates old Minecraft',()=>{
 const x=packageRevival({body:'Historical evidence',evidence:[{rank:16,video_id:'HQf42-Fklns',game:'Minecraft',watch_minutes:1240},{old_server:true,target_title:'Minecraft Grind',target_playlist:'Current SMP',target_description:'Old server https://discord.gg/broken https://streamlabs.com/old'}]});
 assert.equal(x.state,'deferred');assert.match(x.target_title,/ARCHIVE/);assert.match(x.target_playlist,/Pre-Current/);assert.match(x.target_description,/not the current Hynoe SMP/);assert.doesNotMatch(x.target_description,/discord\.gg|streamlabs/);assert.ok(x.score<90);assert.equal(x.reason,'Historical evidence');
});
test('first ten approved are ready; twenty are deferred; broken never ready',()=>{
 const p=rank=>packageRevival({evidence:[{rank,video_id:'abcdefghijk',game:'Madden',broken:rank===3},{auto_publish:true,target_title:'Playoffs',target_playlist:'Sports Archive'}]});
 assert.equal(p(1).state,'ready');assert.equal(p(11).state,'deferred');assert.equal(p(3).state,'failed');assert.equal(p(31),null);
});
test('catalog assessment protects public long form and all named lanes; unknown data is not complete',()=>{
 const a=assessCatalog([{video_id:'a',privacy:'public',duration_seconds:3600,title:'Halo'},{video_id:'b',privacy:'unlisted',title:'High on Life'}],882);
 assert.equal(a.complete,false);assert.equal(a.scored,2);assert.equal(a.rows[0].decision,'preserve-public');assert.equal(a.rows[1].decision,'preserve-series');assert.equal(a.rows[1].analytics_complete,false);
});
test('deferred promotion requires measured post-publication public long-form hours and quality',()=>{
 const rule={min_views:20,min_watch_hours:2,min_avg_viewed_pct:15,max_subscribers_lost:0,window_days:7};
 const good={window_days:7,views:25,public_longform_watch_minutes:180,avg_viewed_pct:20,subscribers_lost:0,verified:true};
 assert.equal(promotionAllowed([good],rule),true);assert.equal(promotionAllowed([good],null),false);assert.equal(promotionAllowed([{...good,verified:false}],rule),false);assert.equal(promotionAllowed([{...good,window_days:1}],rule),false);assert.equal(promotionAllowed([{...good,public_longform_watch_minutes:0,watch_minutes:9999}],rule),false);
});
test('one-video execution stops immediately on quota and resumes idempotently',async()=>{
 let calls=[];const item={video_id:'abcdefghijk',target_title:'Archive',target_description:'Replay',target_playlist:'Archive'};
 const api={read:async()=>{calls.push('read');return{title:'Old',description:'Old',privacy:'unlisted'}},metadata:async()=>{calls.push('metadata');throw Error('quotaExceeded')},playlist:async()=>calls.push('playlist'),publish:async()=>calls.push('publish')};
 await assert.rejects(runOne(item,api),/quotaExceeded/);assert.deepEqual(calls,['read','metadata']);
 calls=[];api.read=async()=>({title:'Archive',description:'Replay',privacy:'public'});await runOne(item,api);assert.deepEqual(calls,['playlist']);
});
test('visibility is last, and current metadata does not get rewritten',async()=>{
 const calls=[];const item={target_title:'Archive',target_description:'Replay'};let published=false;
 const api={read:async()=>({title:'Archive',description:'Replay',privacy:published?'public':'unlisted'}),metadata:async()=>calls.push('metadata'),playlist:async()=>calls.push('playlist'),publish:async()=>{calls.push('publish');published=true}};
 assert.equal((await runOne(item,api)).verified,true);assert.deepEqual(calls,['playlist','publish']);
});
test('auto publication needs canonical numeric 90+ evidence even with prior approval',async()=>{
 const {canAutoPublish}=await import('./queue_policy.mjs');
 assert.equal(canAutoPublish({approved:true,score:95,analytics_complete:false}),false);
 assert.equal(canAutoPublish({approved:true,score:89,analytics_complete:true}),false);
 assert.equal(canAutoPublish({approved:true,score:90,analytics_complete:true}),true);
});
test('transient and ambiguous writes remain retryable while quota pauses immediately',async()=>{
 const {classifyFailure}=await import('./queue_policy.mjs');
 assert.equal(classifyFailure(Object.assign(Error('backendError'),{status:503})),'retry');
 assert.equal(classifyFailure(Object.assign(Error('internalError'),{status:500})),'retry');
 assert.equal(classifyFailure(Error('quotaExceeded')),'quota');
 assert.equal(classifyFailure(Error('video ownership mismatch')),'failed');
});
test('legacy description escapes become readable paragraphs',async()=>{
 const {cleanLinks}=await import('./queue_policy.mjs');assert.equal(cleanLinks('Archive\\n\\nFull stream'),'Archive\n\nFull stream');
});
