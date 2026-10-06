import {context,access,json,yt,authStatus} from './edge_helpers.ts';
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return json(req,{});if(req.method!=='POST')return json(req,{error:'POST required'},405);
 let ctx:any;
 try{
  ctx=await context(req);const{admin,owned}=ctx;
  const {data:ctl,error:ce}=await admin.from('revival_control').select('*').eq('channel_id',owned.id).single();if(ce)throw ce;
  if(ctl.pause_until&&Date.parse(ctl.pause_until)>Date.now())return json(req,{paused:true,resume_at:ctl.pause_until});
  const {data:items,error}=await admin.from('revival_queue').select('*').eq('channel_id',owned.id).eq('state','published').order('published_at');if(error)throw error;
  const item=(items||[]).find((x:any)=>Date.now()-Date.parse(x.published_at)>=8*86400000&&!x.performance?.verified);
  if(!item)return json(req,{ok:true,message:'No mature unmeasured revival'});
  const bearer=await access(admin,owned.id);
  const v=(await yt(bearer,`https://www.googleapis.com/youtube/v3/videos?part=snippet,status,contentDetails&id=${item.video_id}`)).items?.[0];
  const d=/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(v?.contentDetails?.duration||'');const seconds=d?Number(d[1]||0)*3600+Number(d[2]||0)*60+Number(d[3]||0):0;
  if(v?.snippet?.channelId!==owned.youtube_channel_id||v.status.privacyStatus!=='public'||seconds<=180)throw Error('public long-form readback required');
  // Use seven complete calendar days after publication, avoiding the partial publication day.
  const start=new Date(Date.parse(item.published_at)+86400000).toISOString().slice(0,10),end=new Date(Date.parse(start)+6*86400000).toISOString().slice(0,10);
  const u=new URL('https://youtubeanalytics.googleapis.com/v2/reports');Object.entries({ids:'channel==MINE',startDate:start,endDate:end,metrics:'views,estimatedMinutesWatched,averageViewPercentage,subscribersLost',filters:'video=='+item.video_id}).forEach(([k,v])=>u.searchParams.set(k,v));
  const b=await yt(bearer,u.toString());const headers=b.columnHeaders?.map((h:any)=>h.name)||[],r=b.rows?.[0];
  if(!r)return json(req,{ok:true,message:'Analytics still unavailable'});
  const m=Object.fromEntries(headers.map((h:string,i:number)=>[h,r[i]]));
  const performance={verified:['views','estimatedMinutesWatched','averageViewPercentage','subscribersLost'].every(k=>Number.isFinite(m[k])),window_days:7,views:m.views,public_longform_watch_minutes:m.estimatedMinutesWatched,avg_viewed_pct:m.averageViewPercentage,subscribers_lost:m.subscribersLost,start,end,synced_at:new Date().toISOString(),raw:m,ypp_eligible_hours_verified:false};
  const {error:up}=await admin.from('revival_queue').update({performance}).eq('channel_id',owned.id).eq('video_id',item.video_id);if(up)throw up;
  return json(req,{ok:true,video_id:item.video_id,performance});
 }catch(e){const msg=String(e).replace(/^Error:\s*/,'');const quota=msg.includes('quotaExceeded');if(quota&&ctx){const {error}=await ctx.admin.rpc('fail_catalog_sync',{p_channel_id:ctx.owned.id,p_error:msg,p_quota:true,p_lease_token:null});if(error)return json(req,{error:'quota persistence failed'},503);}return json(req,{error:msg,quota_exhausted:quota},quota?429:authStatus(e));}
});
