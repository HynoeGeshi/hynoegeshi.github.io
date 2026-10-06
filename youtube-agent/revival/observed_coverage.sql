alter table public.revival_control add column if not exists observed_catalog_count int;
alter table public.revival_control add column if not exists catalog_count_discrepancy boolean not null default false;
drop function public.finish_catalog_sync(uuid,uuid,text,text,boolean);
create function public.finish_catalog_sync(p_channel_id uuid,p_lease_token uuid,p_uploads_playlist_id text,p_page_token text,p_done boolean,p_observed_count int default null) returns boolean language plpgsql security invoker set search_path=public as $$
declare n int;
begin
 perform 1 from public.revival_control where channel_id=p_channel_id for update;
 update public.revival_sync set uploads_playlist_id=p_uploads_playlist_id,page_token=p_page_token,enumeration_complete=p_done,last_synced_at=now(),lease_until=null where channel_id=p_channel_id and lease_token=p_lease_token;
 get diagnostics n=row_count;if n=0 then return false;end if;
 update public.revival_control set observed_catalog_count=p_observed_count,catalog_count_discrepancy=p_observed_count is not null and p_observed_count<>expected_catalog_count,
 catalog_complete=p_done and p_observed_count is not null and (select count(*) from public.revival_catalog where channel_id=p_channel_id)>=p_observed_count where channel_id=p_channel_id;
 return true;
end $$;
revoke all on function public.finish_catalog_sync(uuid,uuid,text,text,boolean,int) from public,anon,authenticated;
grant execute on function public.finish_catalog_sync(uuid,uuid,text,text,boolean,int) to service_role;
