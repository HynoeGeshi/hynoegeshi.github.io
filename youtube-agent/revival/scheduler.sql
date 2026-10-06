create extension if not exists pg_cron with schema pg_catalog;
do $$begin
 if not exists(select 1 from vault.secrets where name='hynoe_revival_runner') then
 perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'hynoe_revival_runner','Server-only restricted revival runner credential');
 end if;
end $$;
create table if not exists private.revival_runner (token_hash bytea primary key);
insert into private.revival_runner select extensions.digest(decrypted_secret,'sha256') from vault.decrypted_secrets where name='hynoe_revival_runner' on conflict do nothing;
revoke all on private.revival_runner from public,anon,authenticated;
grant usage on schema private to service_role;grant select on private.revival_runner to service_role;
create or replace function public.validate_revival_runner(p_token text,p_channel_id uuid) returns boolean language sql security invoker set search_path=public as $$
 select p_token is not null and length(p_token)=64 and exists(select 1 from public.channels where id=p_channel_id and youtube_channel_id='UCjWR1CZVFkrVk3S-TRrOGGQ' and youtube_handle='@Hynoe') and exists(select 1 from private.revival_runner where token_hash=extensions.digest(p_token,'sha256'))
$$;
revoke all on function public.validate_revival_runner(text,uuid) from public,anon,authenticated;
grant execute on function public.validate_revival_runner(text,uuid) to service_role;
create or replace function private.dispatch_revival() returns void language plpgsql security definer set search_path='' as $$
declare ctl public.revival_control; target text; credential text;
begin
 select r.* into ctl from public.revival_control r join public.channels c on c.id=r.channel_id where c.youtube_channel_id='UCjWR1CZVFkrVk3S-TRrOGGQ';
 if not found or ctl.pause_until>now() then return;end if;
 if exists(select 1 from public.revival_sync where channel_id=ctl.channel_id and enumeration_complete and last_synced_at<now()-interval '7 days')then
 update public.revival_control set catalog_complete=false where channel_id=ctl.channel_id;
 update public.revival_sync set page_token=null,enumeration_complete=false where channel_id=ctl.channel_id;ctl.catalog_complete=false;
 end if;
 select decrypted_secret into credential from vault.decrypted_secrets where name='hynoe_revival_runner';
 if credential is null then return;end if;
 if not ctl.catalog_complete then target='youtube-revival-catalog-sync';
 elsif exists(select 1 from public.revival_queue where channel_id=ctl.channel_id and state='published' and published_at<now()-interval '8 days' and not coalesce((performance->>'verified')::boolean,false))then target='youtube-revival-performance-sync';
 else target='youtube-archive-revive';end if;
 perform net.http_post(url:='https://bgtxfzvzksgvradodafo.supabase.co/functions/v1/'||target,headers:=jsonb_build_object('Content-Type','application/json','x-revival-runner',credential),body:=jsonb_build_object('channel_id',ctl.channel_id),timeout_milliseconds:=120000);
end $$;
revoke all on function private.dispatch_revival() from public,anon,authenticated,service_role;
select cron.schedule('hynoe-controlled-revival','*/15 * * * *','select private.dispatch_revival()') where not exists(select 1 from cron.job where jobname='hynoe-controlled-revival');
