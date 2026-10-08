import { createClient } from 'jsr:@supabase/supabase-js@2';
const ALLOWED_ORIGINS=new Set(['https://hynoe-youtube-agent.vercel.app','https://hynoe-youtube-agent-hynoe.vercel.app']);
function cors(req:Request){const o=req.headers.get('Origin')||'';const a=ALLOWED_ORIGINS.has(o)?o:'https://hynoe-youtube-agent.vercel.app';return {'Access-Control-Allow-Origin':a,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400','Vary':'Origin'};}
function json(req:Request,body:unknown,status=200){return Response.json(body,{status,headers:cors(req)});}
function envKey(name:string,legacy:string,dictName:string){const direct=Deno.env.get(name)||Deno.env.get(legacy);if(direct)return direct;const raw=Deno.env.get(dictName);if(!raw)return null;try{const parsed=JSON.parse(raw);return parsed.default||Object.values(parsed)[0]||null;}catch{return null;}}
async function token(admin:any,channelId:string,clientId:string,clientSecret:string){const {data,error}=await admin.rpc('admin_get_youtube_oauth_tokens',{p_channel_id:channelId});if(error)throw error;const t=data?.[0];if(!t?.refresh_token)throw new Error('YouTube not connected');let access=t.access_token as string|null;const exp=t.expires_at?new Date(t.expires_at).getTime():0;if(!access||exp<Date.now()+120000){const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:t.refresh_token,grant_type:'refresh_token'})});const b=await r.json();if(!r.ok||!b.access_token)throw new Error(b.error_description||b.error||'token refresh failed');access=b.access_token;const {error:u}=await admin.rpc('admin_update_youtube_access_token',{p_channel_id:channelId,p_access_token:access,p_expires_at:new Date(Date.now()+Number(b.expires_in||3600)*1000).toISOString()});if(u)throw u;}return access!;}
async function yt(access:string,url:string,init:RequestInit={}){const h=new Headers(init.headers||{});h.set('Authorization',`Bearer ${access}`);if(init.body&&!h.has('Content-Type'))h.set('Content-Type','application/json');const r=await fetch(url,{...init,headers:h});const text=await r.text();let b:any={};try{b=text?JSON.parse(text):{};}catch{b={raw:text};}if(!r.ok){const e:any=new Error(b?.error?.errors?.[0]?.reason||b?.error?.message||`YouTube request failed (${r.status})`);e.status=r.status;throw e;}return b;}
function keepSnippet(s:any,title:string,description:string){const out:any={title,description,categoryId:String(s.categoryId||'20')};if(Array.isArray(s.tags))out.tags=s.tags;if(s.defaultLanguage)out.defaultLanguage=s.defaultLanguage;if(s.defaultAudioLanguage)out.defaultAudioLanguage=s.defaultAudioLanguage;return out;}
function keepStatus(s:any){const out:any={privacyStatus:'public'};for(const k of ['license','embeddable','publicStatsViewable','selfDeclaredMadeForKids','containsSyntheticMedia'])if(s?.[k]!==undefined)out[k]=s[k];return out;}
export {json,token,yt,keepSnippet,keepStatus};
export async function context(req:Request) {
 const auth=req.headers.get('Authorization');
 if(!auth)throw Error('authentication required');
 const url=Deno.env.get('SUPABASE_URL')!;
 const pub=envKey('SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEYS');
 const sec=envKey('SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEYS');
 if(!pub||!sec)throw Error('server configuration incomplete');
 const admin=createClient(url,String(sec));const body=await req.json();
 const uc=createClient(url,String(pub),{global:{headers:{Authorization:auth}}});
 const {data:{user}}=await uc.auth.getUser();if(!user)throw Error('invalid session');
 const {data:owned,error}=await uc.from('channels').select('id,youtube_channel_id,youtube_handle').eq('id',body.channel_id).maybeSingle();
 if(error||!owned||owned.youtube_handle!=='@Hynoe'||owned.youtube_channel_id!=='UCjWR1CZVFkrVk3S-TRrOGGQ')throw Error('channel not owned');
 return {admin,owned,body,user};
}
export async function access(admin:any,channelId:string) {
 const {data,error}=await admin.rpc('admin_get_youtube_oauth_client_credentials',{p_channel_id:channelId});if(error)throw error;
 if(!data?.[0]?.client_id||!data?.[0]?.client_secret)throw Error('OAuth unavailable');
 return token(admin,channelId,data[0].client_id,data[0].client_secret);
}
export function authStatus(e:unknown){return /authentication|invalid session/.test(String(e))?401:/not owned/.test(String(e))?403:500;}
