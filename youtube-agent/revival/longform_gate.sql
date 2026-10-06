create or replace function public.claim_revival(p_channel_id uuid,p_video_id text default null)
returns setof public.revival_queue language plpgsql security invoker set search_path=public as $$
declare ctl public.revival_control; item public.revival_queue;
begin
 select * into ctl from public.revival_control where channel_id=p_channel_id for update;
 if not found or not ctl.catalog_complete or ctl.pause_until>now() then return; end if;
 if exists(select 1 from public.revival_queue where channel_id=p_channel_id and state='processing' and lease_until>now()) then return; end if;
 select * into item from public.revival_queue where channel_id=p_channel_id and approved and score>=90 and analytics_complete and exists(select 1 from public.revival_catalog c where c.channel_id=p_channel_id and c.video_id=revival_queue.video_id and c.analytics_complete and c.score>=90 and c.duration_seconds>180 and c.evidence->>'editorial_fit'='true' and c.evidence->>'score_version'='numeric-v1') and
 (state='ready' or (state='processing' and lease_until<=now())) and (p_video_id is null or video_id=p_video_id)
 order by (state='processing') desc,rank limit 1 for update;
 if not found then return; end if;
 if item.state='ready' and item.publication_started_at is null and ctl.last_publication_at>now()-interval '24 hours' then return; end if;
 return query update public.revival_queue set state='processing',lease_token=gen_random_uuid(),lease_until=now()+interval '15 minutes',attempts=attempts+1,last_attempt_at=now(),last_error=null
 where channel_id=p_channel_id and video_id=item.video_id returning *;
end $$;
revoke all on function public.claim_revival(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_revival(uuid,text) to service_role;
