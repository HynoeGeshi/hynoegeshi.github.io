import {context,access,json,yt,keepSnippet,keepStatus,authStatus} from './edge_helpers.ts';
import {runOne,classifyFailure} from './queue_policy.mjs';

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return json(req,{});
 if(req.method!=='POST')return json(req,{error:'POST required'},405);
 if(req.headers.get('x-revival-runner'))return json(req,{error:'Interactive owner approval is required for every public YouTube change.'},403);
 let ctx:any,item:any,playlistId:string|undefined;
 try {
  ctx=await context(req);const {admin,owned,body}=ctx;
  if(typeof body.video_id!=='string'||!/^[-\w]{11}$/.test(body.video_id))return json(req,{error:'one approved video_id required'},400);
  const {data:ctl,error:ce}=await admin.from('revival_control').select('*').eq('channel_id',owned.id).single();if(ce)throw ce;
  if(ctl.pause_until&&Date.parse(ctl.pause_until)>Date.now())return json(req,{paused:true,resume_at:ctl.pause_until});
  const {data:claim,error}=await admin.rpc('claim_revival',{p_channel_id:owned.id,p_video_id:body.video_id});if(error)throw error;item=claim?.[0];
  if(!item)return json(req,{error:'No exact active owner approval exists for this review package, or the evidence gate is not satisfied.'},409);

  const ensureApproval=async()=>{
   const {data,error}=await admin.rpc('validate_revival_public_approval',{p_channel_id:owned.id,p_video_id:item.video_id,p_approval_id:item.public_approval_id});
   if(error||data!==true)throw Error('specific public approval required');
  };

  await ensureApproval();
  const bearer=await access(admin,owned.id);
  const api={
   read:async(id:string)=>{const b=await yt(bearer,`https://www.googleapis.com/youtube/v3/videos?part=snippet,status,contentDetails&id=${id}`);const v=b.items?.[0];if(v?.snippet?.channelId!==owned.youtube_channel_id)throw Error('video ownership mismatch');if(!v.contentDetails?.duration||v.status?.uploadStatus!=='processed')throw Error('video not processed');return{title:v.snippet.title,description:v.snippet.description||'',privacy:v.status.privacyStatus,raw:v};},
   metadata:async(i:any,v:any)=>{await ensureApproval();await yt(bearer,'https://www.googleapis.com/youtube/v3/videos?part=snippet',{method:'PUT',body:JSON.stringify({id:i.video_id,snippet:keepSnippet(v.raw.snippet,i.target_title,i.target_description)})});},
   playlist:async(i:any)=>{
    await ensureApproval();
    let page='',found:any;
    do{const b=await yt(bearer,`https://www.googleapis.com/youtube/v3/playlists?part=snippet,status&mine=true&maxResults=50${page?'&pageToken='+encodeURIComponent(page):''}`);found=b.items?.find((p:any)=>p.snippet.title===i.target_playlist);page=found?'':b.nextPageToken||'';}while(page);
    if(!found)found=await yt(bearer,'https://www.googleapis.com/youtube/v3/playlists?part=snippet,status',{method:'POST',body:JSON.stringify({snippet:{title:i.target_playlist,description:'Historical Hynoe gaming archive. Older Minecraft is separate from the current SMP.'},status:{privacyStatus:'public'}})});
    playlistId=found.id;page='';let present=false;
    do{const b=await yt(bearer,`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=50${page?'&pageToken='+encodeURIComponent(page):''}`);present=b.items?.some((p:any)=>p.contentDetails.videoId===i.video_id);page=present?'':b.nextPageToken||'';}while(page);
    if(!present){await ensureApproval();await yt(bearer,'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet',{method:'POST',body:JSON.stringify({snippet:{playlistId,resourceId:{kind:'youtube#video',videoId:i.video_id}}})});}
   },
   publish:async(i:any,v:any)=>{await ensureApproval();const{data:reserved,error}=await admin.rpc('reserve_revival_publication',{p_channel_id:owned.id,p_video_id:i.video_id,p_lease_token:i.lease_token});if(error||!reserved)throw Error('publication reservation failed');await ensureApproval();await yt(bearer,'https://www.googleapis.com/youtube/v3/videos?part=status',{method:'PUT',body:JSON.stringify({id:i.video_id,status:keepStatus(v.raw.status)})});}
  };
  const result=await runOne(item,api);
  await ensureApproval();
  const {data:finished,error:fe}=await admin.rpc('finish_revival',{p_channel_id:owned.id,p_video_id:item.video_id,p_lease_token:item.lease_token,p_result:'published',p_playlist_id:playlistId});if(fe||!finished)throw Error('completion persistence failed');
  return json(req,{ok:true,video_id:item.video_id,...result});
 }catch(e){
  const msg=String(e).replace(/^Error:\s*/,'');
  const result=/specific public approval|required approval|exact active owner approval/i.test(msg)?'review':classifyFailure(e);
  const quota=result==='quota';
  if(ctx&&item){const {error}=await ctx.admin.rpc('finish_revival',{p_channel_id:ctx.owned.id,p_video_id:item.video_id,p_lease_token:item.lease_token,p_result:result,p_error:msg.slice(0,500),p_playlist_id:playlistId});if(error)return json(req,{error:'Attempt persistence failed; channel needs attention'},503);}
  return json(req,{error:msg,quota_exhausted:quota},quota?429:authStatus(e));
 }
});
