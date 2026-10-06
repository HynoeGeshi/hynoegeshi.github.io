alter table public.revival_control add column if not exists last_publication_video_id text;
create or replace function public.reserve_revival_publication(p_channel_id uuid,p_video_id text,p_lease_token uuid) returns boolean language plpgsql security invoker set search_path=public as $$
declare ctl public.revival_control; item public.revival_queue;
begin
 select * into ctl from public.revival_control where channel_id=p_channel_id for update;
 if not found or ctl.pause_until>now() then return false;end if;
 select * into item from public.revival_queue where channel_id=p_channel_id and video_id=p_video_id and lease_token=p_lease_token and state='processing' and lease_until>now() for update;
 if not found then return false;end if;
 if ctl.last_publication_at>now()-interval '24 hours' then
 return ctl.last_publication_video_id=p_video_id and item.publication_started_at=ctl.last_publication_at;
 end if;
 update public.revival_queue set publication_started_at=now() where channel_id=p_channel_id and video_id=p_video_id;
 update public.revival_control set last_publication_at=now(),last_publication_video_id=p_video_id where channel_id=p_channel_id;
 return true;
end $$;
revoke all on function public.reserve_revival_publication(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_revival_publication(uuid,text,uuid) to service_role;
