create table if not exists public.revival_control (
 channel_id uuid primary key references public.channels(id),
 expected_catalog_count int not null default 882,
 pause_until timestamptz,
 last_publication_at timestamptz,
 promotion_rules jsonb,
 catalog_complete boolean not null default false
);
create table if not exists public.revival_queue (
 channel_id uuid not null references public.channels(id), video_id text not null,
 rank int not null check(rank between 1 and 30), game text, score numeric not null check(score between 0 and 100),
 target_title text not null, target_description text not null, target_playlist text not null, reason text not null,
 historical jsonb not null default '{}', old_server boolean not null default false,
 analytics_complete boolean not null default false, approved boolean not null default false,
 state text not null check(state in ('ready','deferred','processing','published','failed')),
 lease_token uuid, lease_until timestamptz, attempts int not null default 0,
 last_error text, published_at timestamptz, last_attempt_at timestamptz,
 playlist_id text, performance jsonb,
 primary key(channel_id,video_id), unique(channel_id,rank),
 check(length(target_title)<=100 and length(target_description)<=5000),
 check(not old_server or (target_title ilike '%archive%' and target_playlist ilike '%Pre-Current%'))
);
create table if not exists public.revival_catalog (
 channel_id uuid not null references public.channels(id), video_id text not null,
 title text not null, privacy text, duration_seconds numeric, score numeric,
 decision text not null, analytics_complete boolean not null default false,
 evidence jsonb not null default '{}', primary key(channel_id,video_id)
);
alter table public.revival_control enable row level security;
alter table public.revival_queue enable row level security;
alter table public.revival_catalog enable row level security;
create policy revival_control_owner on public.revival_control for select to authenticated using(exists(select 1 from public.channels c where c.id=channel_id and c.owner_user_id=(select auth.uid())));
create policy revival_queue_owner on public.revival_queue for select to authenticated using(exists(select 1 from public.channels c where c.id=channel_id and c.owner_user_id=(select auth.uid())));
create policy revival_catalog_owner on public.revival_catalog for select to authenticated using(exists(select 1 from public.channels c where c.id=channel_id and c.owner_user_id=(select auth.uid())));
revoke all on public.revival_control,public.revival_queue,public.revival_catalog from anon,authenticated;
grant select on public.revival_control,public.revival_queue,public.revival_catalog to authenticated;
grant all on public.revival_control,public.revival_queue,public.revival_catalog to service_role;

create or replace function public.claim_revival(p_channel_id uuid,p_video_id text default null)
returns setof public.revival_queue language plpgsql security invoker set search_path=public as $$
declare ctl public.revival_control; item public.revival_queue;
begin
 select * into ctl from public.revival_control where channel_id=p_channel_id for update;
 if not found or ctl.pause_until>now() then return; end if;
 if exists(select 1 from public.revival_queue where channel_id=p_channel_id and state='processing' and lease_until>now()) then return; end if;
 select * into item from public.revival_queue where channel_id=p_channel_id and approved and
 (state='ready' or (state='processing' and lease_until<=now())) and (p_video_id is null or video_id=p_video_id)
 order by (state='processing') desc,rank limit 1 for update;
 if not found then return; end if;
 if item.state='ready' and ctl.last_publication_at>now()-interval '24 hours' then return; end if;
 return query update public.revival_queue set state='processing',lease_token=gen_random_uuid(),lease_until=now()+interval '15 minutes',attempts=attempts+1,last_attempt_at=now(),last_error=null
 where channel_id=p_channel_id and video_id=item.video_id returning *;
end $$;
revoke all on function public.claim_revival(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_revival(uuid,text) to service_role;

create or replace function public.finish_revival(p_channel_id uuid,p_video_id text,p_lease_token uuid,p_result text,p_error text default null,p_playlist_id text default null)
returns boolean language plpgsql security invoker set search_path=public as $$
declare n int;
begin
 perform 1 from public.revival_control where channel_id=p_channel_id for update;
 if p_result not in ('published','quota','failed','retry') then raise exception 'invalid result'; end if;
 update public.revival_queue set state=case when p_result='quota' then 'ready' when p_result='retry' then 'processing' else p_result end,
 lease_until=case when p_result='retry' then now()+interval '15 minutes' else null end,
 last_error=p_error,playlist_id=coalesce(p_playlist_id,playlist_id),published_at=case when p_result='published' then coalesce(published_at,now()) else published_at end
 where channel_id=p_channel_id and video_id=p_video_id and lease_token=p_lease_token and state='processing';
 get diagnostics n=row_count; if n=0 then return false; end if;
 if p_result='published' then update public.revival_control set last_publication_at=now() where channel_id=p_channel_id;
 elsif p_result='quota' then update public.revival_control set pause_until=((now() at time zone 'America/Los_Angeles')::date+1+time '00:10') at time zone 'America/Los_Angeles' where channel_id=p_channel_id; end if;
 return true;
end $$;
revoke all on function public.finish_revival(uuid,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_revival(uuid,text,uuid,text,text,text) to service_role;
