import {scoreRevival,classifyRevival} from './revival_score.mjs';

export function cleanLinks(text='') {
 return String(text).replace(/\\n/g,'\n').replace(/https?:\/\/(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite|streamlabs\.com|streamelements\.com|donate\.[^/\s]+)[^\s]*/gi,'').replace(/(?:💬|💛)?\s*(?:JOIN THE HYNOE COMMUNITY|SUPPORT THE CHANNEL\s*\/\s*STREAM)\s*/gi,'').replace(/\n{3,}/g,'\n\n').trim();
}
export function packageRevival(rec) {
 const facts=Object.assign({},...(rec.evidence||[]));const rank=Number(facts.rank);
 if(!Number.isInteger(rank)||rank<1||rank>30)return null;
 const old=!!facts.old_server;let title=facts.target_title||rec.title;
 if(old&&!/ARCHIVE/i.test(title))title=`ARCHIVE: ${title} — Pre-Current Hynoe SMP`;
 let description=cleanLinks(facts.target_description||`${title}\n\nFull stream replay from the Hynoe gaming archive.`);
 if(old)description=`HISTORICAL MINECRAFT ARCHIVE — this is not the current Hynoe SMP. Old server details and invitations are no longer current.\n\n${description}`;
 else if(!/archive/i.test(description))description=`Hynoe archive replay.\n\n${description}`;
 const blocked=facts.broken||facts.duplicate||facts.non_gaming;
 return {video_id:facts.video_id,rank,game:facts.game,target_title:title.slice(0,100),target_description:description.slice(0,5000),target_playlist:old?'Minecraft — Hynoe Archive (Pre-Current SMP)':facts.target_playlist,reason:rec.body||'Approved historical revival',score:scoreRevival({...facts,audience_fit:1,clear_premise:1}),state:blocked?'failed':rank<=10?'ready':'deferred',approved:!blocked,old_server:old,historical:facts,analytics_complete:Number.isFinite(facts.watch_minutes)&&Number.isFinite(facts.avg_viewed_pct)};
}
export function assessCatalog(videos,expected=882) {
 const rows=videos.map(v=>{
 const protectedSeries=/hynoe smp|gears|vanguard.*zombies|halo|high on life|nba|madden/i.test(v.title||v.game||'');
 const publicLong=v.privacy==='public'&&v.duration_seconds>60&&!v.is_short;
 const analytics=Number.isFinite(v.watch_minutes)&&Number.isFinite(v.avg_viewed_pct);
 const score=scoreRevival(v);
 return {...v,score,analytics_complete:analytics,decision:publicLong?'preserve-public':protectedSeries?'preserve-series':!analytics?'needs-evidence':classifyRevival(score,v)};
 });
 return {expected,scored:rows.length,complete:rows.length===expected&&new Set(rows.map(v=>v.video_id)).size===expected,rows};
}
export function promotionAllowed(samples,rules) {
 if(!rules||!samples.length)return false;
 for(const k of ['min_views','min_watch_hours','min_avg_viewed_pct','max_subscribers_lost','window_days'])if(!Number.isFinite(rules[k]))return false;
 return samples.every(s=>s.verified===true&&s.window_days>=rules.window_days&&s.views>=rules.min_views&&s.public_longform_watch_minutes>=rules.min_watch_hours*60&&s.avg_viewed_pct>=rules.min_avg_viewed_pct&&s.subscribers_lost<=rules.max_subscribers_lost);
}
export function canAutoPublish(item) {return item.approved===true&&item.analytics_complete===true&&Number.isFinite(Number(item.score))&&Number(item.score)>=90;}
export function classifyFailure(error) {
 const msg=String(error);
 if(msg.includes('quotaExceeded'))return 'quota';
 if(/ownership mismatch|canonical 90\+ evidence|required|video not processed/.test(msg))return 'failed';
 if(Number(error?.status)>=500||Number(error?.status)===429||/backendError|internalError|network|fetch|verificationPending|reservation|persistence|\(5\d\d\)/i.test(msg))return 'retry';
 return 'retry'; // Unknown write outcomes are reconciled, never silently abandoned.
}
export async function runOne(item,api) {
 let v=await api.read(item.video_id);
 if(v.title!==item.target_title||v.description!==item.target_description)await api.metadata(item,v);
 await api.playlist(item);
 if(v.privacy!=='public')await api.publish(item,v);
 v=await api.read(item.video_id);
 const verified=v.title===item.target_title&&v.description===item.target_description&&v.privacy==='public';
 if(!verified)throw Error('verificationPending');
 return {verified:true};
}
