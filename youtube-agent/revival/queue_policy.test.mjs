import test from 'node:test';
import assert from 'node:assert/strict';
import { packageRevival, assessCatalog, promotionAllowed, runOne, canAutoPublish } from './queue_policy.mjs';

test('all non-blocked packages await owner review regardless of rank',()=>{
 const first=packageRevival({body:'Historical evidence',evidence:[{rank:1,video_id:'abcdefghijk',game:'Madden',watch_minutes:8000,avg_viewed_pct:75},{target_title:'Playoffs',target_playlist:'Sports Archive'}]});
 const later=packageRevival({body:'Historical evidence',evidence:[{rank:16,video_id:'HQf42-Fklns',game:'Minecraft',watch_minutes:1240},{old_server:true,target_title:'Minecraft Grind',target_playlist:'Current SMP',target_description:'Old server https://discord.gg/broken https://streamlabs.com/old'}]});
 assert.equal(first.state,'awaiting_review');
 assert.equal(later.state,'awaiting_review');
 assert.equal(first.approved,false);
 assert.match(later.target_title,/ARCHIVE/);
 assert.match(later.target_playlist,/Pre-Current/);
 assert.doesNotMatch(later.target_description,/discord\.gg|streamlabs/);
});

test('broken packages fail and invalid ranks are rejected',()=>{
 const broken=packageRevival({evidence:[{rank:3,video_id:'abcdefghijk',game:'Madden',broken:true},{target_title:'Playoffs',target_playlist:'Sports Archive'}]});
 assert.equal(broken.state,'failed');
 assert.equal(packageRevival({evidence:[{rank:31,video_id:'abcdefghijk'}]}),null);
});

test('catalog assessment protects public long form and named lanes',()=>{
 const a=assessCatalog([{video_id:'a',privacy:'public',duration_seconds:3600,title:'Halo'},{video_id:'b',privacy:'unlisted',title:'High on Life'}],882);
 assert.equal(a.complete,false);
 assert.equal(a.rows[0].decision,'preserve-public');
 assert.equal(a.rows[1].decision,'preserve-series');
});

test('generic approval and a 90 score are insufficient without a bound exact approval',()=>{
 assert.equal(canAutoPublish({approved:true,score:95,analytics_complete:true}),false);
 assert.equal(canAutoPublish({public_approval_id:'approval-id',approved:false,score:89,analytics_complete:true}),false);
 assert.equal(canAutoPublish({public_approval_id:'approval-id',approved:false,score:95,analytics_complete:false}),false);
 assert.equal(canAutoPublish({public_approval_id:'approval-id',approved:false,score:95,analytics_complete:true}),true);
});

test('deferred promotion metrics never substitute for owner approval',()=>{
 const rule={min_views:20,min_watch_hours:2,min_avg_viewed_pct:15,max_subscribers_lost:0,window_days:7};
 const good={window_days:7,views:25,public_longform_watch_minutes:180,avg_viewed_pct:20,subscribers_lost:0,verified:true};
 assert.equal(promotionAllowed([good],rule),true);
 assert.equal(canAutoPublish({...good,score:99,analytics_complete:true}),false);
});

test('one-video execution stops immediately on quota and resumes idempotently',async()=>{
 let calls=[];const item={video_id:'abcdefghijk',target_title:'Archive',target_description:'Replay',target_playlist:'Archive'};
 const api={read:async()=>{calls.push('read');return{title:'Old',description:'Old',privacy:'unlisted'}},metadata:async()=>{calls.push('metadata');throw Error('quotaExceeded')},playlist:async()=>calls.push('playlist'),publish:async()=>calls.push('publish')};
 await assert.rejects(runOne(item,api),/quotaExceeded/);assert.deepEqual(calls,['read','metadata']);
 calls=[];api.read=async()=>({title:'Archive',description:'Replay',privacy:'public'});await runOne(item,api);assert.deepEqual(calls,['playlist']);
});
