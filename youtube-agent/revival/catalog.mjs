import {assessCatalog} from './queue_policy.mjs';
import {scoreRevival} from './revival_score.mjs';

export function catalogRow(v,timestamp) {
 const m=/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(v.contentDetails?.duration||'');
 const duration=m?Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0):null;
 const evidence={synced_at:timestamp,published_at:v.snippet?.publishedAt||null,description:v.snippet?.description||'',duration_iso:v.contentDetails?.duration||null,type:duration>180?'long-form':'short-or-unknown',views:Number(v.statistics?.viewCount||0),watch_minutes:null,avg_viewed_pct:null,avg_view_duration_seconds:null,subs_gained:null,subs_lost:null,analytics_source:null,raw_metadata:v};
 return assessCatalog([{video_id:v.id,title:v.snippet?.title||'',privacy:v.status?.privacyStatus||null,duration_seconds:duration,...evidence}],1).rows.map(r=>({video_id:r.video_id,title:r.title,privacy:r.privacy,duration_seconds:duration,score:null,decision:r.decision,analytics_complete:false,evidence}))[0];
}

export function buildCatalogPageRows({ids=[],videos=[],timestamp,channelId}) {
 const byId=new Map(videos.map(video=>[video.id,video]));
 return ids.map(videoId=>{
  const video=byId.get(videoId);
  if(video)return{...catalogRow(video,timestamp),channel_id:channelId};
  return{
   channel_id:channelId,
   video_id:videoId,
   title:'[Unavailable YouTube upload]',
   privacy:'unavailable',
   duration_seconds:null,
   score:null,
   decision:'unavailable',
   analytics_complete:false,
   evidence:{
    synced_at:timestamp,
    missing_from_videos_list:true,
    unavailable_reason:'Upload appears in the channel uploads playlist but was not returned by videos.list.'
   }
  };
 });
}

export function mergeAnalytics(row,a,period={}) {
 if(!a)return row;
 const e={...row.evidence,analytics_source:'YouTube Analytics API',analytics_period:period,raw_analytics:a,views:a.views,watch_minutes:a.estimatedMinutesWatched,avg_viewed_pct:a.averageViewPercentage,avg_view_duration_seconds:a.averageViewDuration,subs_gained:a.subscribersGained,subs_lost:a.subscribersLost};
 // Canonical 90+ is normalized from the original numeric weights (32+18+10+12).
 // Editorial fit/premise do not add points or replace missing metrics.
 const fit=/minecraft|madden|nba|halo|gears|zombies|dying light|forza|black ops|fallout|resident evil|grounded|back 4 blood|lost ark|high on life|dead island/i.test(row.title);
 const x=assessCatalog([{...row,...e,audience_fit:fit,clear_premise:!!row.title}],1).rows[0];
 const complete=['views','estimatedMinutesWatched','averageViewDuration','averageViewPercentage','subscribersGained','subscribersLost'].every(k=>Number.isFinite(a[k]));
 const numeric=complete?Math.round(scoreRevival({...e,audience_fit:false,clear_premise:false})/72*1000)/10:null;
 return {...row,score:numeric,decision:!complete?'needs-evidence':x.decision,analytics_complete:complete,evidence:{...e,score_version:'numeric-v1',editorial_fit:fit}};
}
