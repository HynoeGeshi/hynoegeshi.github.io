import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const s=createClient(
  'https://bgtxfzvzksgvradodafo.supabase.co',
  'sb_publishable__rZ-ByelsWiRwQPTOEST4w_4u7TyFNe',
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
);
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let channel,rows=[],catalog=[],approvals=[],state='awaiting_review';

async function readCatalog(){
  const all=[];
  for(let offset=0;;offset+=1000){
    const r=await s.from('revival_catalog').select('*').eq('channel_id',channel).order('video_id').range(offset,offset+999);
    if(r.error)return r;
    all.push(...r.data);
    if(r.data.length<1000)return{data:all,error:null};
  }
}

function setStatus(message,type=''){
  const el=$('status');
  el.textContent=message;
  el.className=type?`status ${type}`:'status';
}

function actionButtons(row){
  const eligible=row.analytics_complete&&Number(row.score)>=90;
  if(row.state==='awaiting_review'){
    return eligible
      ? `<button data-approve="${esc(row.video_id)}">Approve exact package & apply</button>`
      : `<button disabled title="Complete verified analytics and a 90+ score are required">Not eligible for public change</button>`;
  }
  if(row.state==='ready'){
    return `<button data-apply="${esc(row.video_id)}">Apply approved package</button><button class="secondary" data-revoke="${esc(row.video_id)}">Revoke approval</button>`;
  }
  if(row.state==='processing')return '<button disabled>Applying approved package…</button>';
  return '';
}

function render(){
  const selected=rows.filter(r=>r.state===state||(state==='ready'&&r.state==='processing'));
  $('queue').innerHTML=selected.length?selected.map(r=>{
    const current=r.current||{};
    const approval=r.public_approval_id?approvals.find(a=>a.id===r.public_approval_id):null;
    return `<article class="queue-card">
      <span>${esc(r.state)} · Rank ${r.rank} · ${esc(r.score)}/100</span>
      <h3>${esc(r.target_title)}</h3>
      <p>${esc(r.reason)}</p>
      <p class="muted">Current: ${esc(current.title||'Unknown')} · ${esc(current.privacy||'unknown visibility')}</p>
      <p class="muted">${r.analytics_complete?'Numeric analytics present':'Awaiting canonical analytics'}${Number(r.score)<90?' · Below required 90 threshold':''}${approval?' · Exact owner approval recorded':''}${r.last_error?' · '+esc(r.last_error):''}</p>
      <details>
        <summary>Exact public change package</summary>
        <label>Visibility</label><p>${esc(current.privacy||'unknown')} → public</p>
        <label>Title</label><p>${esc(r.target_title)}</p>
        <label>Description</label><pre>${esc(r.target_description)}</pre>
        <label>Playlist</label><p>${esc(r.target_playlist)}</p>
        <label>Historical evidence</label><pre>${esc(JSON.stringify(r.historical,null,2))}</pre>
        <a href="https://www.youtube.com/watch?v=${encodeURIComponent(r.video_id)}" target="_blank" rel="noreferrer">Open video</a>
      </details>
      <div class="toolbar">${actionButtons(r)}</div>
    </article>`;
  }).join(''):'<p>No items in this state.</p>';

  document.querySelectorAll('[data-approve]').forEach(b=>b.addEventListener('click',()=>approveAndApply(b.dataset.approve)));
  document.querySelectorAll('[data-apply]').forEach(b=>b.addEventListener('click',()=>applyApproved(b.dataset.apply)));
  document.querySelectorAll('[data-revoke]').forEach(b=>b.addEventListener('click',()=>revokeApproval(b.dataset.revoke)));
}

async function load(){
  const {data:{session}}=await s.auth.getSession();
  if(!session){
    setStatus('Sign in on the main Agent first.','error');
    $('sync').disabled=true;
    return;
  }
  const {data,error}=await s.rpc('ensure_hynoe_channel');
  if(error)throw error;
  channel=data?.[0]?.channel_id;

  const responses=await Promise.all([
    s.from('revival_queue').select('*').eq('channel_id',channel).order('rank'),
    s.from('revival_control').select('*').eq('channel_id',channel).single(),
    readCatalog(),
    s.from('revival_sync').select('*').eq('channel_id',channel).maybeSingle(),
    s.from('revival_public_approvals').select('*').eq('channel_id',channel).is('revoked_at',null).is('consumed_at',null)
  ]);
  for(const r of responses)if(r.error)throw r.error;

  const queue=responses[0].data;
  const ctl=responses[1].data;
  catalog=responses[2].data;
  const sync=responses[3].data;
  approvals=responses[4].data;
  const catalogByVideo=new Map(catalog.map(r=>[r.video_id,r]));
  rows=queue.map(r=>({...r,current:catalogByVideo.get(r.video_id)}));

  const paused=ctl.pause_until&&Date.parse(ctl.pause_until)>Date.now();
  setStatus(paused
    ? `YouTube quota paused until ${new Date(ctl.pause_until).toLocaleString()}. Safe preparation remains available.`
    : `${ctl.catalog_complete?'Catalog enumeration complete':'Catalog sync incomplete'}. Public changes require an exact owner approval for each video. ${sync?.last_error||''}`,
    paused?'error':'ok'
  );
  $('sync').disabled=!!paused;

  $('metrics').innerHTML=[
    ['Catalog coverage',`${catalog.length} / ${ctl.observed_unique_catalog_count??ctl.observed_catalog_count??ctl.expected_catalog_count}`],
    ['Numeric analytics',catalog.filter(x=>x.analytics_complete).length],
    ['Awaiting review',rows.filter(x=>x.state==='awaiting_review').length],
    ['Exact active approvals',approvals.length],
    ['90+ eligible',rows.filter(x=>x.state==='awaiting_review'&&x.analytics_complete&&Number(x.score)>=90).length],
    ['Published by workflow',rows.filter(x=>x.state==='published').length]
  ].map(([label,value])=>`<article class="card metric"><strong>${esc(value)}</strong>${esc(label)}</article>`).join('');

  const sorted=[...catalog].sort((a,b)=>Number(b.evidence.watch_minutes||0)-Number(a.evidence.watch_minutes||0));
  $('watch').innerHTML=sorted.length?sorted.map(r=>`<tr><td>${esc(r.title)}</td><td>${esc(r.privacy)}</td><td>${r.evidence.watch_minutes==null?'Unknown':(r.evidence.watch_minutes/60).toFixed(1)}</td><td>${r.evidence.avg_viewed_pct==null?'Unknown':Number(r.evidence.avg_viewed_pct).toFixed(1)+'%'}</td><td>${r.score==null?'Unknown':esc(r.score)}</td><td>${esc(r.decision)}</td></tr>`).join(''):'<tr><td colspan="6">Canonical owner catalog has not synced yet. No analytics are fabricated.</td></tr>';
  render();
}

function getRow(videoId){
  const row=rows.find(r=>r.video_id===videoId);
  if(!row)throw Error('Review item no longer exists. Refresh the page.');
  return row;
}

async function approveAndApply(videoId){
  const row=getRow(videoId);
  const current=row.current||{};
  const confirmation=[
    'Approve and apply this exact YouTube public change?',
    '',
    `Video: ${current.title||row.video_id}`,
    `Visibility: ${current.privacy||'unknown'} → public`,
    `New title: ${row.target_title}`,
    `Playlist: ${row.target_playlist}`,
    '',
    'This approval applies only to the exact title, description, playlist, and visibility currently shown.'
  ].join('\n');
  if(!window.confirm(confirmation))return;

  setStatus('Recording exact approval…');
  const {error}=await s.rpc('approve_revival_public_change',{
    p_channel_id:channel,
    p_video_id:row.video_id,
    p_target_title:row.target_title,
    p_target_description:row.target_description,
    p_target_playlist:row.target_playlist,
    p_target_visibility:'public',
    p_confirmation_text:'I approve this exact YouTube public change'
  });
  if(error){setStatus(error.message,'error');return;}
  await applyApproved(row.video_id,false);
}

async function applyApproved(videoId,ask=true){
  const row=getRow(videoId);
  if(ask&&!window.confirm(`Apply the previously approved exact package for “${row.target_title}” now?`))return;
  setStatus('Applying the approved package…');
  const {data,error}=await s.functions.invoke('youtube-archive-revive',{body:{channel_id:channel,video_id:row.video_id}});
  if(error||data?.error){
    setStatus(data?.error||error?.message||'Approved change could not be applied.','error');
    await load();
    return;
  }
  setStatus(`Verified public change applied to ${data.video_id}.`,'ok');
  await load();
}

async function revokeApproval(videoId){
  const row=getRow(videoId);
  if(!window.confirm(`Revoke the exact public-change approval for “${row.target_title}”?`))return;
  const {error}=await s.rpc('revoke_revival_public_change',{p_channel_id:channel,p_video_id:row.video_id});
  if(error){setStatus(error.message,'error');return;}
  setStatus('Approval revoked. The video returned to awaiting review.','ok');
  await load();
}

async function syncCatalog(){
  if(!channel)return;
  $('sync').disabled=true;
  setStatus('Syncing a safe catalog page…');
  try{
    const{data,error}=await s.functions.invoke('youtube-revival-catalog-sync',{body:{channel_id:channel}});
    if(error||data?.error)throw Error(data?.error||error?.message);
    setStatus(data.paused?`Paused until ${new Date(data.resume_at).toLocaleString()}`:`Catalog sync: ${JSON.stringify(data)}`,data.paused?'error':'ok');
    await load();
  }catch(e){
    setStatus(e.message,'error');
    $('sync').disabled=false;
  }
}

document.querySelectorAll('[data-state]').forEach(b=>b.addEventListener('click',()=>{
  state=b.dataset.state;
  document.querySelectorAll('[data-state]').forEach(x=>x.classList.toggle('active',x===b));
  render();
}));
$('refresh').addEventListener('click',()=>load().catch(e=>setStatus(e.message,'error')));
$('sync').addEventListener('click',syncCatalog);
load().catch(e=>setStatus(e.message,'error'));
