import {context,access,json,yt,authStatus} from './edge_helpers.ts';
import {catalogRow,mergeAnalytics} from './catalog.mjs';
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return json(req,{});if(req.method!=='POST')return json(req,{error:'POST required'},405);
 let ctx:any;
 try{
  ctx=await context(req);const{admin,owned}=ctx;
  const {data:ctl,error}=await admin.from('revival_control').select('*').eq('channel_id',owned.id).single();if(error)throw error;
  if(ctl.pause_until&&Date.parse(ctl.pause_until)>Date.now())return json(req,{paused:true,resume_at:ctl.pause_until});
  const {data:sync,error:se}=await admin.rpc('claim_catalog_sync',{p_channel_id:owned.id});if(se)throw se;if(!sync?.[0])return json(req,{busy:true});
  const state=sync[0];ctx.sync=state;
  const bearer=await access(admin,owned.id);let playlist=state.uploads_playlist_id;
  if(!playlist){const ch=await yt(bearer,'https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true');playlist=ch.items?.find((c:any)=>c.id===owned.youtube_channel_id)?.contentDetails?.relatedPlaylists?.uploads;if(!playlist)throw Error('owner uploads playlist unavailable');}
  const page=await yt(bearer,`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${encodeURIComponent(playlist)}&maxResults=50${state.page_token?'&pageToken='+encodeURIComponent(state.page_token):''}`);
  const ids=(page.items||[]).map((x:any)=>x.contentDetails.videoId);
  let rows:any[]=[];const stamp=new Date().toISOString();
  if(ids.length){
   const videos=await yt(bearer,`https://www.googleapis.com/youtube/v3/videos?part=snippet,status,contentDetails,statistics&id=${ids.join(',')}`);
   rows=(videos.items||[]).map((v:any)=>{if(v.snippet.channelId!==owned.youtube_channel_id)throw Error('catalog ownership mismatch');return{...catalogRow(v,stamp),channel_id:owned.id}});
   const {error:metadataError}=await admin.from('revival_catalog').upsert(rows,{onConflict:'channel_id,video_id'});if(metadataError)throw metadataError;
   const end=new Date(Date.now()-86400000).toISOString().slice(0,10),start='2005-01-01';
   const u=new URL('https://youtubeanalytics.googleapis.com/v2/reports');Object.entries({ids:'channel==MINE',startDate:start,endDate:end,dimensions:'video',metrics:'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost',filters:'video=='+ids.join(','),'maxResults':'200'}).forEach(([k,v])=>u.searchParams.set(k,v));
   let a:any;try{a=await yt(bearer,u.toString());}catch(e){if(String(e).includes('quotaExceeded'))throw e;a={rows:[],error:String(e).slice(0,500)};}
   const headers=a.columnHeaders?.map((h:any)=>h.name)||[];const metrics=new Map((a.rows||[]).map((r:any[])=>{const m=Object.fromEntries(headers.map((h:string,i:number)=>[h,r[i]]));return[m.video,m]}));
   rows=rows.map(r=>{const x=mergeAnalytics(r,metrics.get(r.video_id),{start,end});return{...x,evidence:{...x.evidence,analytics_error:a.error||null},channel_id:owned.id}});
   const {error:up}=await admin.from('revival_catalog').upsert(rows,{onConflict:'channel_id,video_id'});if(up)throw up;
   for(const r of rows){const {error:q}=await admin.from('revival_queue').update({...r.score!==null?{score:r.score}:{},analytics_complete:r.analytics_complete}).eq('channel_id',owned.id).eq('video_id',r.video_id).neq('state','published');if(q)throw q;}
  }
  const {data:finished,error:done}=await admin.rpc('finish_catalog_sync',{p_channel_id:owned.id,p_lease_token:state.lease_token,p_uploads_playlist_id:playlist,p_page_token:page.nextPageToken||null,p_done:!page.nextPageToken,p_observed_count:page.pageInfo?.totalResults??null});if(done||!finished)throw Error('sync checkpoint persistence failed');
  return json(req,{ok:true,updated:rows.length,enumeration_complete:!page.nextPageToken,synced_at:stamp});
 }catch(e){const msg=String(e).replace(/^Error:\s*/,'');const quota=msg.includes('quotaExceeded');if(ctx){const{error}=await ctx.admin.rpc('fail_catalog_sync',{p_channel_id:ctx.owned.id,p_error:msg.slice(0,500),p_quota:quota,p_lease_token:ctx.sync?.lease_token||null});if(error)return json(req,{error:'sync error persistence failed'},503);}return json(req,{error:msg,quota_exhausted:quota},quota?429:authStatus(e));}
});
