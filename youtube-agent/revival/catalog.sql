create table public.revival_sync (
 channel_id uuid primary key references public.channels(id),uploads_playlist_id text,page_token text,
 enumeration_complete boolean not null default false,lease_token uuid,lease_until timestamptz,
 started_at timestamptz,last_synced_at timestamptz,last_error text
);
alter table public.revival_sync enable row level security;
create policy revival_sync_owner on public.revival_sync for select to authenticated using(exists(select 1 from public.channels c where c.id=channel_id and c.owner_user_id=(select auth.uid())));
revoke all on public.revival_sync from public,anon,authenticated;
grant select on public.revival_sync to authenticated;grant all on public.revival_sync to service_role;
create or replace function public.claim_catalog_sync(p_channel_id uuid) returns setof public.revival_sync language plpgsql security invoker set search_path=public as $$
begin
 perform 1 from public.revival_control where channel_id=p_channel_id for update;
 if exists(select 1 from public.revival_control where channel_id=p_channel_id and pause_until>now())then return;end if;
 insert into public.revival_sync(channel_id) values(p_channel_id) on conflict do nothing;
 if exists(select 1 from public.revival_sync where channel_id=p_channel_id and lease_until>now())then return;end if;
 return query update public.revival_sync set lease_token=gen_random_uuid(),lease_until=now()+interval '10 minutes',started_at=coalesce(started_at,now()),last_error=null
 where channel_id=p_channel_id returning *;
end $$;
create or replace function public.finish_catalog_sync(p_channel_id uuid,p_lease_token uuid,p_uploads_playlist_id text,p_page_token text,p_done boolean) returns boolean language plpgsql security invoker set search_path=public as $$
declare n int;
begin
 perform 1 from public.revival_control where channel_id=p_channel_id for update;
 update public.revival_sync set uploads_playlist_id=p_uploads_playlist_id,page_token=p_page_token,enumeration_complete=p_done,last_synced_at=now(),lease_until=null where channel_id=p_channel_id and lease_token=p_lease_token;
 get diagnostics n=row_count;if n=0 then return false;end if;
 update public.revival_control set catalog_complete=p_done and (select count(*) from public.revival_catalog where channel_id=p_channel_id)>=expected_catalog_count where channel_id=p_channel_id;
 return true;
end $$;
create or replace function public.fail_catalog_sync(p_channel_id uuid,p_error text,p_quota boolean,p_lease_token uuid) returns boolean language plpgsql security invoker set search_path=public as $$
begin
 perform 1 from public.revival_control where channel_id=p_channel_id for update;
 update public.revival_sync set lease_until=null,last_error=p_error where channel_id=p_channel_id and lease_token=p_lease_token;
 if p_quota then update public.revival_control set pause_until=((now() at time zone 'America/Los_Angeles')::date+1+time '00:10') at time zone 'America/Los_Angeles' where channel_id=p_channel_id;end if;return true;
end $$;
revoke all on function public.claim_catalog_sync(uuid),public.finish_catalog_sync(uuid,uuid,text,text,boolean),public.fail_catalog_sync(uuid,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.claim_catalog_sync(uuid),public.finish_catalog_sync(uuid,uuid,text,text,boolean),public.fail_catalog_sync(uuid,text,boolean,uuid) to service_role;
