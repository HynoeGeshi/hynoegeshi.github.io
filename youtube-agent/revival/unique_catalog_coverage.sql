alter table public.revival_control
  add column if not exists observed_unique_catalog_count integer;

alter table public.revival_control
  add column if not exists duplicate_upload_count integer not null default 0;

create or replace function public.claim_catalog_sync(p_channel_id uuid)
returns setof public.revival_sync
language plpgsql
security invoker
set search_path=public
as $$
begin
  perform 1 from public.revival_control where channel_id=p_channel_id for update;
  if exists(select 1 from public.revival_control where channel_id=p_channel_id and pause_until>now()) then
    return;
  end if;

  insert into public.revival_sync(channel_id) values(p_channel_id) on conflict do nothing;

  if exists(select 1 from public.revival_sync where channel_id=p_channel_id and lease_until>now()) then
    return;
  end if;

  return query
  update public.revival_sync
  set lease_token=gen_random_uuid(),
      lease_until=now()+interval '10 minutes',
      started_at=case
        when page_token is null then now()
        else coalesce(started_at,now())
      end,
      enumeration_complete=case
        when page_token is null then false
        else enumeration_complete
      end,
      last_error=null
  where channel_id=p_channel_id
  returning *;
end
$$;

create or replace function public.finish_catalog_sync(
  p_channel_id uuid,
  p_lease_token uuid,
  p_uploads_playlist_id text,
  p_page_token text,
  p_done boolean,
  p_observed_count integer default null
) returns boolean
language plpgsql
security invoker
set search_path=public
as $$
declare
  n integer;
  scan_started_at timestamptz;
  unique_rows integer;
  duplicate_rows integer;
  scan_complete boolean;
begin
  perform 1 from public.revival_control where channel_id=p_channel_id for update;

  update public.revival_sync
  set uploads_playlist_id=p_uploads_playlist_id,
      page_token=p_page_token,
      enumeration_complete=p_done,
      last_synced_at=now(),
      lease_until=null
  where channel_id=p_channel_id and lease_token=p_lease_token
  returning started_at into scan_started_at;

  get diagnostics n=row_count;
  if n=0 then return false; end if;

  select count(*) into unique_rows
  from public.revival_catalog
  where channel_id=p_channel_id
    and evidence ? 'synced_at'
    and (evidence->>'synced_at')::timestamptz >= scan_started_at;

  duplicate_rows := greatest(coalesce(p_observed_count,0)-unique_rows,0);
  scan_complete := p_done
    and p_observed_count is not null
    and unique_rows > 0
    and unique_rows <= p_observed_count;

  update public.revival_control
  set observed_catalog_count=p_observed_count,
      observed_unique_catalog_count=unique_rows,
      duplicate_upload_count=duplicate_rows,
      catalog_complete=scan_complete,
      expected_catalog_count=case
        when scan_complete then unique_rows
        else expected_catalog_count
      end,
      catalog_count_discrepancy=not scan_complete
  where channel_id=p_channel_id;

  return true;
end
$$;

revoke all on function public.claim_catalog_sync(uuid) from public,anon,authenticated;
grant execute on function public.claim_catalog_sync(uuid) to service_role;
revoke all on function public.finish_catalog_sync(uuid,uuid,text,text,boolean,integer) from public,anon,authenticated;
grant execute on function public.finish_catalog_sync(uuid,uuid,text,text,boolean,integer) to service_role;
