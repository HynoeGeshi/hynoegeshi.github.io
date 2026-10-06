import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const SUPABASE_URL='https://bgtxfzvzksgvradodafo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable__rZ-ByelsWiRwQPTOEST4w_4u7TyFNe';
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let channelId=null;

const $=(id)=>document.getElementById(id);
const fmt=(d)=>d?new Date(d).toLocaleString():'—';
const esc=(s='')=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function status(el,msg,type=''){el.textContent=msg;el.className=`status ${type}`;}

async function getSession(){const {data:{session}}=await supabase.auth.getSession();return session;}
async function ensureChannel(){const {data,error}=await supabase.rpc('ensure_hynoe_channel');if(error)throw error;channelId=data?.[0]?.channel_id||null;if(!channelId)throw new Error('Channel bootstrap failed');return channelId;}

async function loadDashboard(){
  const session=await getSession();
  if(!session){$('auth-shell').classList.remove('hidden');$('dashboard').classList.add('hidden');return;}
  if(!session.user.email_confirmed_at){await supabase.auth.signOut();status($('auth-status'),'Verify your email before using the agent.','error');return;}
  $('auth-shell').classList.add('hidden');$('dashboard').classList.remove('hidden');
  await ensureChannel();
  const [jobsRes,clipsRes,pubsRes,analyticsRes,recsRes,connRes]=await Promise.all([
    supabase.from('processing_jobs').select('id,state,created_at,updated_at,error_message,video_sources(title,youtube_video_id,game_topic)').eq('channel_id',channelId).order('created_at',{ascending:false}).limit(30),
    supabase.from('clip_candidates').select('*').eq('channel_id',channelId).order('score',{ascending:false}).limit(30),
    supabase.from('publishing_jobs').select('id,state,created_at,youtube_video_id').eq('channel_id',channelId).order('created_at',{ascending:false}).limit(50),
    supabase.from('analytics_snapshots').select('*').eq('channel_id',channelId).order('captured_at',{ascending:false}).limit(20),
    supabase.from('recommendations').select('*').eq('channel_id',channelId).eq('status','active').order('created_at',{ascending:false}).limit(20),
    supabase.from('youtube_connections').select('status,connected_at,last_error').eq('channel_id',channelId).maybeSingle()
  ]);
  [jobsRes,clipsRes,pubsRes,analyticsRes,recsRes].forEach(r=>{if(r.error)console.warn(r.error)});
  renderMetrics(jobsRes.data||[],clipsRes.data||[],pubsRes.data||[]);
  renderJobs(jobsRes.data||[]);
  renderClips(clipsRes.data||[]);
  renderAnalytics(analyticsRes.data||[]);
  renderRecommendations(recsRes.data||[]);
  const conn=connRes.data;
  $('youtube-connection').textContent=conn?.status==='connected'?`YouTube OAuth connected ${fmt(conn.connected_at)}`:'YouTube OAuth: connection credentials still required';
}

function renderMetrics(jobs,clips,pubs){
  $('metric-queued').textContent=jobs.filter(j=>['queued','claimed','downloading','transcribing','analyzing','rendering'].includes(j.state)).length;
  $('metric-review').textContent=clips.filter(c=>c.approval_state==='pending').length;
  $('metric-approved').textContent=clips.filter(c=>c.approval_state==='approved').length;
  $('metric-published').textContent=pubs.filter(p=>p.state==='published').length;
}
function renderJobs(rows){
  const el=$('jobs');if(!rows.length){el.className='list empty';el.textContent='No jobs yet.';return;}el.className='list';
  el.innerHTML=rows.map(j=>`<div class="list-row"><div><strong>${esc(j.video_sources?.title||'Untitled')}</strong><div>${esc(j.video_sources?.game_topic||'No topic')} ${j.video_sources?.youtube_video_id?`• ${esc(j.video_sources.youtube_video_id)}`:''}</div></div><div><span class="badge ${j.state==='awaiting_review'?'warn':j.state==='completed'?'good':''}">${esc(j.state)}</span></div><div>${fmt(j.updated_at)}</div><div>${j.error_message?`<span title="${esc(j.error_message)}">⚠</span>`:''}</div></div>`).join('');
}
function renderClips(rows){
  const el=$('clips');if(!rows.length){el.className='clip-grid empty';el.textContent='No clip candidates yet.';return;}el.className='clip-grid';
  el.innerHTML=rows.map(c=>`<article class="clip-card">${c.preview_uri?`<video controls playsinline src="${esc(c.preview_uri)}"></video>`:''}<div class="body"><div class="clip-score">${c.score}<small>/100</small></div><span class="badge ${c.approval_state==='approved'?'good':c.approval_state==='pending'?'warn':''}">${esc(c.approval_state)}</span><h3>${esc(c.title||c.hook||'Untitled clip')}</h3><p>${esc(c.transcript_excerpt||'')}</p><p><strong>${esc(c.category)}</strong> • ${Math.round((c.end_ms-c.start_ms)/1000)}s</p><div class="clip-actions"><button data-approve="${c.id}">Approve</button><button class="reject" data-reject="${c.id}">Reject</button></div></div></article>`).join('');
  el.querySelectorAll('[data-approve]').forEach(b=>b.addEventListener('click',()=>reviewClip(b.dataset.approve,'approve')));
  el.querySelectorAll('[data-reject]').forEach(b=>b.addEventListener('click',()=>reviewClip(b.dataset.reject,'reject')));
}
async function reviewClip(id,action){const {error}=await supabase.rpc('approve_clip',{p_clip_id:id,p_action:action,p_notes:null});if(error){alert(error.message);return;}await loadDashboard();}
function renderAnalytics(rows){const el=$('analytics');if(!rows.length){el.className='list empty';el.textContent='No analytics yet.';return;}el.className='list';el.innerHTML=rows.map(a=>`<div class="list-row"><div><strong>${esc(a.youtube_video_id)}</strong><div>${esc(a.horizon)} snapshot</div></div><div>${Number(a.views||0).toLocaleString()} views</div><div>${a.average_percentage_viewed?`${Number(a.average_percentage_viewed).toFixed(1)}% avg viewed`:'—'}</div><div>${fmt(a.captured_at)}</div></div>`).join('');}
function renderRecommendations(rows){const el=$('recommendations');if(!rows.length){el.className='list empty';el.textContent='Not enough data yet.';return;}el.className='list';el.innerHTML=rows.map(r=>`<div class="list-row"><div><strong>${esc(r.title)}</strong><div>${esc(r.body)}</div></div><div><span class="badge">${esc(r.recommendation_type)}</span></div><div>${esc(r.confidence)} confidence</div><div>${fmt(r.created_at)}</div></div>`).join('');}

$('login-form').addEventListener('submit',async(e)=>{e.preventDefault();status($('auth-status'),'Signing in…');const email=$('email').value.trim(),password=$('password').value;const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error){status($('auth-status'),error.message,'error');return;}if(!data.user?.email_confirmed_at){await supabase.auth.signOut();status($('auth-status'),'Verify your email first.','error');return;}status($('auth-status'),'Signed in.','ok');await loadDashboard();});
$('vod-form').addEventListener('submit',async(e)=>{e.preventDefault();if(!channelId)return;status($('vod-status'),'Queueing…');const title=$('vod-title').value.trim(),youtubeId=$('vod-id').value.trim()||null,topic=$('vod-topic').value.trim()||null;const {data,error}=await supabase.rpc('enqueue_video_source',{p_channel_id:channelId,p_youtube_video_id:youtubeId,p_source_type:youtubeId?'youtube':'manual',p_title:title,p_duration_seconds:null,p_game_topic:topic});if(error){status($('vod-status'),error.message,'error');return;}const created=data?.[0]?.created;status($('vod-status'),created?'Queued for processing.':'Already queued; duplicate avoided.','ok');e.target.reset();await loadDashboard();});
$('logout-btn').addEventListener('click',async()=>{await supabase.auth.signOut();channelId=null;await loadDashboard();});
$('refresh-btn').addEventListener('click',loadDashboard);
supabase.auth.onAuthStateChange(()=>setTimeout(loadDashboard,0));
loadDashboard().catch(err=>{console.error(err);status($('auth-status'),err.message,'error')});
