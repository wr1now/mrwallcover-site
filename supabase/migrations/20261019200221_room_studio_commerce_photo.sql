-- Checkout is an independent gate. NULL prices, tax approval, operating allowance
-- or compute ceilings fail closed. Customer money never reduces compute spend.
alter table public.room_studio_settings add column checkout_enabled boolean not null default false,
 add column render_price_pence integer check(render_price_pence>0),
 add column currency text not null default 'gbp' check(currency='gbp'),
 add column tax_profile jsonb,
 add column operating_allowance_pence integer check(operating_allowance_pence>0);
alter table public.room_projects add column document_kind text not null default 'room' check(document_kind in ('room','photo'));
alter table public.room_assets drop constraint room_assets_kind_check;
alter table public.room_assets add constraint room_assets_kind_check check(kind in ('artwork','plan','room-photo','mask','package','output'));
create table public.room_render_orders (
 id uuid primary key default gen_random_uuid(), confirmed_project_id uuid not null,confirmed_revision_id uuid not null, owner_id uuid not null references auth.users(id),
 project_id uuid not null references public.room_projects(id), revision_id uuid not null references public.room_revisions(id),
 state text not null default 'checkout_pending' check(state in ('checkout_pending','expired','queued','running','delivered','refund_pending','refund_failed','refunded')),
 amount_pence integer not null check(amount_pence>0), currency text not null check(currency='gbp'), tax_profile jsonb not null,
 package_asset_id uuid not null references public.room_assets(id), package_sha256 text not null check(package_sha256~'^[a-f0-9]{64}$'),
 output_spec jsonb not null default '{"stills":2,"width":1920,"height":1080,"panoramaWidth":4096,"panoramaHeight":2048}',
 compiler_version text not null, source_hashes jsonb not null,
 checkout_session_id text unique, checkout_url text, payment_intent_id text unique,payment_check_at timestamptz not null default now(),
 -- Ten seconds of provider-clock/network safety above Stripe's 30-minute floor.
 -- Freeze the requested expiry so retries use identical idempotency parameters.
 checkout_expires_at timestamptz not null default date_trunc('second',now())+interval '30 minutes 10 seconds',
 expires_at timestamptz not null default now()+interval '31 minutes',
 budget_month date not null references public.room_budget_months(month), reserved_pence integer not null check(reserved_pence>0),
 reservation_active boolean not null default true, output_reserved_bytes bigint not null default 62914560 check(output_reserved_bytes>=0),
 job_id uuid unique references public.room_jobs(id), cancelled_at timestamptz, started_at timestamptz,support_requested_at timestamptz,
 refund_id text, refund_attempts integer not null default 0, refund_next_at timestamptz,
 refund_token uuid, refund_lease_until timestamptz, error text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function public.room_order_immutable() returns trigger language plpgsql as $$
begin
 if (new.owner_id,new.confirmed_project_id,new.confirmed_revision_id,new.amount_pence,new.currency,new.tax_profile,new.package_sha256,new.output_spec,new.compiler_version,new.source_hashes)
 is distinct from (old.owner_id,old.confirmed_project_id,old.confirmed_revision_id,old.amount_pence,old.currency,old.tax_profile,old.package_sha256,old.output_spec,old.compiler_version,old.source_hashes) then raise exception 'Purchased order specification is immutable';end if;
 return new;
end $$;
create trigger room_order_no_spec_update before update on public.room_render_orders for each row execute function public.room_order_immutable();
create unique index room_one_pending_checkout on public.room_render_orders(owner_id) where state='checkout_pending';
alter table public.room_jobs add column order_id uuid unique references public.room_render_orders(id);
alter table public.room_assets add column job_id uuid references public.room_jobs(id) on delete set null;
-- Fence any pre-commerce unpaid work during upgrade. Completed historical
-- packages remain readable; no orphan queued job may block its account forever.
with cancelled as (
 select budget_month,sum(reserved_pence)::integer amount,
 sum(case when attempts>0 then reserved_pence else 0 end)::integer consumed
 from public.room_jobs where type='render' and state in ('queued','running') and order_id is null group by budget_month
)
update public.room_budget_months b set reserved_pence=b.reserved_pence-c.amount,committed_pence=b.committed_pence+c.consumed from cancelled c where b.month=c.budget_month;
update public.room_jobs set state='cancelled',lease_token=null,lease_until=null,error='Reconfirm this design and purchase a render package',updated_at=now()
 where type='render' and state in ('queued','running') and order_id is null;
create table public.room_payment_events(id text primary key, order_id uuid not null references public.room_render_orders(id), kind text not null, received_at timestamptz not null default now());
alter table public.room_render_orders enable row level security;
alter table public.room_payment_events enable row level security;
create policy room_owner_orders on public.room_render_orders for select to authenticated using(auth.uid()=owner_id);
revoke all on public.room_render_orders,public.room_payment_events from public,anon,authenticated;
grant select on public.room_render_orders to authenticated;
grant all on public.room_render_orders,public.room_payment_events to service_role;

create function public.room_checkout_available() returns boolean language sql stable security definer set search_path=public as $$
 select coalesce(checkout_enabled and paid_jobs_enabled and monthly_cap_pence>0 and render_reservation_pence>0
 and render_price_pence>0 and operating_allowance_pence>0 and tax_profile->>'approved'='true'
 and tax_profile->>'mode' in ('inclusive','automatic') and tax_profile->>'taxCode'~'^txcd_[0-9]+$'
 and length(tax_profile->>'version')>0,false) from room_studio_settings where id
$$;

create function public.room_expire_checkouts() returns void language plpgsql security definer set search_path=public as $$
declare o room_render_orders;
begin
 perform pg_advisory_xact_lock(72666831);
 for o in select * from room_render_orders where state='checkout_pending' and expires_at<=now() for update loop
  if o.reservation_active then update room_budget_months set reserved_pence=reserved_pence-o.reserved_pence where month=o.budget_month; end if;
  update room_render_orders set state='expired',reservation_active=false,output_reserved_bytes=0,updated_at=now() where id=o.id;
 end loop;
end $$;

create function public.room_prepare_order(p_owner uuid,p_project uuid,p_revision uuid,p_package uuid,p_compiler text,p_sources jsonb)
returns public.room_render_orders language plpgsql security definer set search_path=public as $$
declare o room_render_orders; s room_studio_settings; a room_assets; m date; b room_budget_months;
begin
 perform pg_advisory_xact_lock(72666831);perform pg_advisory_xact_lock(hashtextextended(p_owner::text,41));
 perform room_expire_checkouts();
 if not room_checkout_available() then raise exception 'Checkout is disabled until pricing, tax and operating allowances are configured'; end if;
 if not exists(select 1 from room_projects where id=p_project and owner_id=p_owner and document_kind='room' and not deleting)
 or not exists(select 1 from room_revisions where id=p_revision and project_id=p_project and owner_id=p_owner) then raise exception 'Confirm a saved room revision first'; end if;
 select * into a from room_assets where id=p_package and owner_id=p_owner and project_id=p_project and kind='package' and state='ready';
 if not found then raise exception 'Approved render package unavailable'; end if;
 select * into o from room_render_orders where owner_id=p_owner and state='checkout_pending';
 if found then
  if o.revision_id=p_revision and o.package_sha256=a.sha256 then return o; end if;
  raise exception 'One checkout or processing job per account';
 end if;
 if exists(select 1 from room_jobs where owner_id=p_owner and state in ('queued','running')) then raise exception 'One checkout or processing job per account'; end if;
 if exists(select 1 from room_render_orders where owner_id=p_owner and revision_id=p_revision and state='delivered') then raise exception 'This version is already purchased: open its existing results'; end if;
 if exists(select 1 from room_render_orders where owner_id=p_owner and revision_id=p_revision and state in ('refund_pending','refund_failed')) then raise exception 'Complete the pending refund before purchasing this design again';end if;
 if (select coalesce(sum(case when kind in ('artwork','plan','room-photo','mask') and state in ('pending','cancelled') then 20971520 else bytes end),0) from room_assets where project_id=p_project)+(select coalesce(sum(output_reserved_bytes),0) from room_render_orders where project_id=p_project)+62914560>104857600 then raise exception 'Project storage cannot accommodate the complete render package'; end if;
 select * into s from room_studio_settings where id;m:=date_trunc('month',now() at time zone 'UTC')::date;
 insert into room_budget_months(month) values(m) on conflict do nothing;select * into b from room_budget_months where month=m for update;
 if b.reserved_pence+b.committed_pence+s.render_reservation_pence>s.monthly_cap_pence then raise exception 'Monthly processing allowance reached'; end if;
 update room_budget_months set reserved_pence=reserved_pence+s.render_reservation_pence where month=m;
 insert into room_render_orders(confirmed_project_id,confirmed_revision_id,owner_id,project_id,revision_id,amount_pence,currency,tax_profile,package_asset_id,package_sha256,compiler_version,source_hashes,budget_month,reserved_pence)
 values(p_project,p_revision,p_owner,p_project,p_revision,s.render_price_pence,s.currency,s.tax_profile,p_package,a.sha256,p_compiler,p_sources,m,s.render_reservation_pence) returning * into o;
 return o;
end $$;

create function public.room_bind_checkout(p_owner uuid,p_order uuid,p_session text,p_url text,p_expires bigint)
returns public.room_render_orders language plpgsql security definer set search_path=public as $$
declare o room_render_orders;
begin
 perform pg_advisory_xact_lock(72666831);
 select * into o from room_render_orders where id=p_order and owner_id=p_owner for update;
 if not found or o.state<>'checkout_pending' or o.expires_at<=now() then raise exception 'Checkout reservation expired'; end if;
 if p_session !~ '^cs_[A-Za-z0-9_]+$' or p_url !~ '^https://checkout[.]stripe[.]com/' or (p_expires>floor(extract(epoch from o.expires_at)) or p_expires<floor(extract(epoch from now()+interval '29 minutes'))) then raise exception 'Checkout identity or expiry mismatch'; end if;
 if o.checkout_session_id is not null and o.checkout_session_id<>p_session then raise exception 'Checkout already attached'; end if;
 update room_render_orders set checkout_session_id=p_session,checkout_url=p_url,expires_at=to_timestamp(p_expires),updated_at=now() where id=p_order returning * into o;return o;
end $$;

create function public.room_receive_payment(p_event text,p_kind text,p_order uuid,p_session text,p_payment text,p_amount integer,p_currency text,p_owner uuid,p_project uuid,p_revision uuid,p_hash text)
returns public.room_render_orders language plpgsql security definer set search_path=public as $$
declare o room_render_orders; s room_studio_settings; b room_budget_months; m date; j room_jobs; capacity boolean;
begin
 perform pg_advisory_xact_lock(72666831);perform pg_advisory_xact_lock(hashtextextended(p_owner::text,41));
 select * into o from room_render_orders where id=p_order for update;
 if not found or o.owner_id<>p_owner or o.confirmed_project_id<>p_project or o.confirmed_revision_id<>p_revision or o.package_sha256<>p_hash
 or o.amount_pence<>p_amount or o.currency<>p_currency or (o.checkout_session_id is not null and o.checkout_session_id<>p_session)
 or p_payment !~ '^pi_[A-Za-z0-9_]+$' then raise exception 'Payment does not match the immutable order'; end if;
 if exists(select 1 from room_payment_events where id=p_event and order_id<>o.id) then raise exception 'Payment event identity mismatch'; end if;
 insert into room_payment_events(id,order_id,kind) values(p_event,o.id,p_kind) on conflict do nothing;
 if o.payment_intent_id is not null then
  if o.payment_intent_id<>p_payment then raise exception 'Payment already recorded'; end if;
  return o;
 end if;
 update room_render_orders set payment_intent_id=p_payment,checkout_session_id=p_session,updated_at=now() where id=o.id;
 -- Stripe can confirm after our hold expired. Release stale holds, then reserve
 -- current capacity afresh, or record an automatic refund obligation.
 perform room_expire_checkouts();select * into o from room_render_orders where id=p_order for update;
 capacity:=o.cancelled_at is null and room_checkout_available() and exists(select 1 from room_projects where id=o.project_id and not deleting)
 and not exists(select 1 from room_jobs where owner_id=o.owner_id and state in ('queued','running'))
 and not exists(select 1 from room_render_orders where owner_id=o.owner_id and state='checkout_pending' and id<>o.id);
 if capacity and not o.reservation_active then
  select * into s from room_studio_settings where id;m:=date_trunc('month',now() at time zone 'UTC')::date;
  insert into room_budget_months(month) values(m) on conflict do nothing;select * into b from room_budget_months where month=m for update;
  capacity:=b.reserved_pence+b.committed_pence+o.reserved_pence<=s.monthly_cap_pence
   and (select coalesce(sum(case when kind in ('artwork','plan','room-photo','mask') and state in ('pending','cancelled') then 20971520 else bytes end),0) from room_assets where project_id=o.project_id)+(select coalesce(sum(output_reserved_bytes),0) from room_render_orders where project_id=o.project_id)+62914560<=104857600;
  if capacity then
   update room_budget_months set reserved_pence=reserved_pence+o.reserved_pence where month=m;
   update room_render_orders set budget_month=m,reservation_active=true,output_reserved_bytes=62914560 where id=o.id returning * into o;
  end if;
 end if;
 if not capacity then
  if o.reservation_active then update room_budget_months set reserved_pence=reserved_pence-o.reserved_pence where month=o.budget_month; end if;
  update room_render_orders set state='refund_pending',reservation_active=false,output_reserved_bytes=0,error='Rendering capacity unavailable; full refund pending',refund_next_at=now(),updated_at=now() where id=o.id returning * into o;return o;
 end if;
 insert into room_jobs(owner_id,project_id,revision_id,type,input_identity,input,reserved_pence,budget_month,order_id)
 values(o.owner_id,o.project_id,o.revision_id,'render',o.id::text,jsonb_build_object('packageAssetId',o.package_asset_id,'packageSha256',o.package_sha256,'orderId',o.id),o.reserved_pence,o.budget_month,o.id) returning * into j;
 update room_render_orders set state='queued',job_id=j.id,updated_at=now() where id=o.id returning * into o;return o;
end $$;

-- Legacy endpoints cannot create free render jobs. Only room_receive_payment
-- inserts paid render work, bound to its own order identity rather than revision.
create or replace function public.room_enqueue_job(p_owner uuid,p_project uuid,p_type text,p_identity text,p_revision uuid,p_input jsonb)
returns public.room_jobs language plpgsql security definer set search_path=public as $$
declare j room_jobs;s room_studio_settings;m date;b room_budget_months;
begin
 perform pg_advisory_xact_lock(72666831);perform pg_advisory_xact_lock(hashtextextended(p_owner::text,41));
 if p_type<>'analysis' then raise exception 'A paid render order is required'; end if;
 if not exists(select 1 from room_projects where id=p_project and owner_id=p_owner and document_kind='room' and not deleting) then raise exception 'Project unavailable'; end if;
 select * into j from room_jobs where owner_id=p_owner and type=p_type and input_identity=p_identity;if found then return j;end if;
 select * into s from room_studio_settings where id;
 if not s.paid_jobs_enabled or s.monthly_cap_pence is null or s.analysis_reservation_pence is null then raise exception 'Paid processing is disabled until a budget is configured'; end if;
 if not s.live_ai_enabled then raise exception 'Live AI analysis is disabled'; end if;
 perform room_expire_checkouts();
 if exists(select 1 from room_jobs where owner_id=p_owner and state in ('queued','running')) or exists(select 1 from room_render_orders where owner_id=p_owner and state='checkout_pending') then raise exception 'One active job per account'; end if;
 if (select count(*) from room_jobs where owner_id=p_owner and type='analysis' and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=2 then raise exception 'Daily allowance reached'; end if;
 m:=date_trunc('month',now() at time zone 'UTC')::date;insert into room_budget_months(month) values(m) on conflict do nothing;
 select * into b from room_budget_months where month=m for update;
 if b.reserved_pence+b.committed_pence+s.analysis_reservation_pence>s.monthly_cap_pence then raise exception 'Monthly processing allowance reached';end if;
 update room_budget_months set reserved_pence=reserved_pence+s.analysis_reservation_pence where month=m;
 insert into room_jobs(owner_id,project_id,type,input_identity,input,reserved_pence,budget_month) values(p_owner,p_project,'analysis',p_identity,p_input,s.analysis_reservation_pence,m) returning * into j;return j;
end $$;

create function public.room_cancel_order(p_owner uuid,p_order uuid) returns public.room_render_orders language plpgsql security definer set search_path=public as $$
declare o room_render_orders;j room_jobs;
begin
 perform pg_advisory_xact_lock(72666831);select * into o from room_render_orders where id=p_order and owner_id=p_owner for update;
 if not found then raise exception 'Order unavailable';end if;
 select * into j from room_jobs where id=o.job_id for update;
 if o.state in ('delivered','refunded','refund_pending','refund_failed') then return o;end if;
 if j.attempts>0 then update room_render_orders set support_requested_at=now(),updated_at=now() where id=o.id returning * into o;return o;end if;
 if o.reservation_active then update room_budget_months set reserved_pence=reserved_pence-o.reserved_pence where month=o.budget_month;end if;
 update room_jobs set state='cancelled',lease_token=null,lease_until=null,updated_at=now() where id=j.id;
 update room_render_orders set state=case when payment_intent_id is null then 'expired' else 'refund_pending' end,cancelled_at=now(),reservation_active=false,output_reserved_bytes=0,refund_next_at=now(),updated_at=now() where id=o.id returning * into o;return o;
end $$;

create or replace function public.room_finish_job(p_id uuid,p_token uuid,p_success boolean,p_outputs jsonb,p_error text,p_retryable boolean default false)
returns public.room_jobs language plpgsql security definer set search_path=public as $$
declare j room_jobs;
begin
 perform pg_advisory_xact_lock(72666831);select * into j from room_jobs where id=p_id for update;
 if not found or j.state<>'running' or j.lease_token is distinct from p_token then raise exception 'Worker lease is no longer valid';end if;
 if not p_success and p_retryable and j.attempts<2 then update room_jobs set state='queued',lease_token=null,lease_until=null,error=left(p_error,500),updated_at=now() where id=p_id returning * into j;return j;end if;
 if p_success and j.order_id is not null and (jsonb_array_length(p_outputs)<>3 or not p_outputs@>'[{"kind":"still-1"},{"kind":"still-2"},{"kind":"panorama"}]'::jsonb) then raise exception 'Complete render package required';end if;
 if p_success and j.order_id is not null and exists(
  select 1 from jsonb_array_elements(p_outputs) output where not exists(
   select 1 from room_assets a where a.job_id=j.id and a.owner_id=j.owner_id and a.project_id=j.project_id
   and a.kind='output' and a.state='ready' and a.storage_path=output->>'storagePath' and a.sha256=output->>'sha256'
  )
 ) then raise exception 'Complete ready output assets required';end if;
 update room_jobs set state=case when p_success then 'succeeded' else 'failed' end,outputs=case when p_success then p_outputs else '[]'::jsonb end,error=case when p_success then null else left(p_error,500) end,lease_token=null,lease_until=null,updated_at=now() where id=p_id returning * into j;
 update room_budget_months set reserved_pence=reserved_pence-j.reserved_pence,committed_pence=committed_pence+j.reserved_pence where month=j.budget_month;
 if j.order_id is not null then update room_render_orders set state=case when p_success then 'delivered' else 'refund_pending' end,reservation_active=false,output_reserved_bytes=0,refund_next_at=case when p_success then null else now() end,error=case when p_success then null else 'Rendering failed; full refund pending' end,updated_at=now() where id=j.order_id;end if;
 return j;
end $$;

create or replace function public.room_claim_job(p_type text) returns public.room_jobs language plpgsql security definer set search_path=public as $$
declare j room_jobs;s room_studio_settings;
begin
 perform pg_advisory_xact_lock(72666831);select * into s from room_studio_settings where id;
 if not s.paid_jobs_enabled or s.monthly_cap_pence is null or (p_type='analysis' and not s.live_ai_enabled) then return null;end if;
 for j in select * from room_jobs where state='running' and lease_until<now() for update loop perform room_finish_job(j.id,j.lease_token,false,'[]','Processing timed out',true);end loop;
 select q.* into j from room_jobs q join room_projects p on p.id=q.project_id left join room_render_orders o on o.id=q.order_id
 where q.state='queued' and q.type=p_type and q.attempts<2 and not p.deleting and (q.type='analysis' or (o.payment_intent_id is not null and o.state in ('queued','running') and o.reservation_active)) order by q.created_at for update of q limit 1;
 if not found then return null;end if;
 update room_jobs set state='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '15 minutes',updated_at=now() where id=j.id returning * into j;
 if j.order_id is not null then update room_render_orders set state='running',started_at=coalesce(started_at,now()),updated_at=now() where id=j.order_id;end if;return j;
end $$;

create function public.room_expire_worker_leases() returns void language plpgsql security definer set search_path=public as $$
declare j room_jobs;enabled boolean;
begin
 perform pg_advisory_xact_lock(72666831);select paid_jobs_enabled into enabled from room_studio_settings where id;
 for j in select * from room_jobs where state='running' and lease_until<now() for update loop
  perform room_finish_job(j.id,j.lease_token,false,'[]','Processing timed out',enabled);
 end loop;
end $$;

create or replace function public.room_reserve_asset(p_owner uuid,p_project uuid,p_id uuid,p_kind text,p_mime text,p_bytes bigint,p_sha text,p_extension text)
returns public.room_assets language plpgsql security definer set search_path=public as $$
declare a room_assets;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,41));
 if not exists(select 1 from room_projects where id=p_project and owner_id=p_owner and not deleting) then raise exception 'Project unavailable';end if;
 if p_extension not in ('png','jpg','webp','pdf','json') then raise exception 'Unsupported file';end if;
 if (select coalesce(sum(case when kind in ('artwork','plan','room-photo','mask') and state in ('pending','cancelled') then 20971520 else bytes end),0) from room_assets where project_id=p_project)+(select coalesce(sum(output_reserved_bytes),0) from room_render_orders where project_id=p_project)+(case when p_kind in ('artwork','plan','room-photo','mask') then 20971520 else p_bytes end)>104857600 then raise exception 'Project storage limit reached';end if;
 insert into room_assets(id,project_id,owner_id,storage_path,kind,mime,bytes,sha256) values(p_id,p_project,p_owner,p_owner::text||'/'||p_project::text||'/'||p_id::text||'.'||p_extension,p_kind,p_mime,p_bytes,p_sha) returning * into a;return a;
end $$;

-- Standard authenticated uploads can be revoked immediately. Two-hour signed
-- upload tokens would remain valid after abort/delete and could recreate an
-- orphan object. No SELECT/UPDATE/DELETE storage policy is added for customers.
create schema if not exists room_studio_private;
revoke all on schema room_studio_private from public,anon;
grant usage on schema room_studio_private to authenticated,service_role;
create function room_studio_private.upload_allowed(p_path text) returns boolean language plpgsql security definer set search_path='' as $$
declare a public.room_assets;
begin
 if auth.uid() is null then return false;end if;
 select assets.* into a from public.room_assets assets join public.room_projects p on p.id=assets.project_id
 where assets.storage_path=p_path and assets.owner_id=auth.uid() and p.owner_id=auth.uid() and not p.deleting
 and assets.kind in ('artwork','plan','room-photo','mask') and assets.state='pending' and assets.created_at>now()-interval '2 hours'
 for share of assets,p;
 return found;
end $$;
revoke all on function room_studio_private.upload_allowed(text) from public,anon;
grant execute on function room_studio_private.upload_allowed(text) to authenticated,service_role;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant insert on storage.objects to authenticated;
create policy room_pending_upload_insert on storage.objects for insert to authenticated
 with check(bucket_id='room-studio' and room_studio_private.upload_allowed(name));
-- Restrictive guards keep unrelated buckets' permissive policies from granting
-- access to this private bucket. They confer no customer read/update/delete.
create policy room_studio_insert_guard on storage.objects as restrictive for insert to authenticated
 with check(bucket_id<>'room-studio' or room_studio_private.upload_allowed(name));
create policy room_studio_read_guard on storage.objects as restrictive for select to authenticated using(bucket_id<>'room-studio');
create policy room_studio_update_guard on storage.objects as restrictive for update to authenticated using(bucket_id<>'room-studio') with check(bucket_id<>'room-studio');
create policy room_studio_delete_guard on storage.objects as restrictive for delete to authenticated using(bucket_id<>'room-studio');

create function public.room_reserve_output(p_job uuid,p_token uuid,p_id uuid,p_mime text,p_bytes bigint,p_sha text,p_extension text)
returns public.room_assets language plpgsql security definer set search_path=public as $$
declare j room_jobs;o room_render_orders;a room_assets;
begin
 perform pg_advisory_xact_lock(72666831);select * into j from room_jobs where id=p_job for update;
 if not found or j.state<>'running' or j.lease_token is distinct from p_token then raise exception 'Worker lease is no longer valid';end if;
 if j.order_id is not null then
  select * into o from room_render_orders where id=j.order_id for update;
  if o.output_reserved_bytes<p_bytes then raise exception 'Output storage reservation exceeded';end if;
  update room_render_orders set output_reserved_bytes=output_reserved_bytes-p_bytes where id=o.id;
 end if;
 a:=room_reserve_asset(j.owner_id,j.project_id,p_id,'output',p_mime,p_bytes,p_sha,p_extension);
 update room_assets set job_id=j.id where id=a.id returning * into a;return a;
end $$;

create function public.room_claim_output_cleanup(p_job uuid,p_asset uuid) returns public.room_assets language plpgsql security definer set search_path=public as $$
declare a room_assets;j room_jobs;
begin
 perform pg_advisory_xact_lock(72666831);select * into j from room_jobs where id=p_job for update;
 if not found or j.state='succeeded' then return null;end if;
 select * into a from room_assets where id=p_asset and job_id=p_job and kind='output' for update;
 if not found then return null;end if;
 -- Publication requires ready assets. Whichever transaction wins this lock
 -- therefore prevents the other from deleting a delivered result or delivering
 -- an output whose cleanup is already in progress.
 update room_assets set state='cancelled' where id=a.id returning * into a;return a;
end $$;

create function public.room_release_output(p_job uuid,p_asset uuid) returns void language plpgsql security definer set search_path=public as $$
declare a room_assets;j room_jobs;
begin
 perform pg_advisory_xact_lock(72666831);select * into a from room_assets where id=p_asset and job_id=p_job and kind='output' and state='cancelled' for update;
 if not found then return;end if;select * into j from room_jobs where id=p_job;
 if j.state='succeeded' then raise exception 'Delivered outputs cannot be removed by a worker';end if;
 delete from room_assets where id=a.id;
 update room_render_orders set output_reserved_bytes=output_reserved_bytes+a.bytes where id=j.order_id and reservation_active;
end $$;

create function public.room_save_photo_project(p_owner uuid,p_id uuid,p_name text,p_snapshot jsonb,p_expected_revision integer,p_prepare boolean default false)
returns public.room_projects language plpgsql security definer set search_path=public as $$
declare p room_projects;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,41));
 select * into p from room_projects where id=p_id;
 if found and (p.owner_id<>p_owner or p.document_kind<>'photo' or p.deleting) then raise exception 'Photo project unavailable';end if;
 if p_prepare then p:=room_prepare_project(p_owner,p_id,p_name,p_snapshot);else p:=room_save_project(p_owner,p_id,p_name,p_snapshot,p_expected_revision);end if;
 update room_projects set document_kind='photo',revision=case when p_prepare then revision else revision+1 end where id=p_id returning * into p;return p;
end $$;

create or replace function public.room_finish_upload(p_owner uuid,p_asset uuid,p_cancel boolean default false)
returns public.room_assets language plpgsql security definer set search_path=public as $$
declare a room_assets;
begin
 select * into a from room_assets where id=p_asset and owner_id=p_owner and kind in ('artwork','plan','room-photo','mask') for update;
 if not found then raise exception 'Private asset unavailable';end if;
 if p_cancel then if a.state='ready' then return null;end if;update room_assets set state='cancelled' where id=p_asset returning * into a;
 else if a.state='cancelled' then raise exception 'Upload was cancelled';end if;update room_assets set state='ready' where id=p_asset returning * into a;end if;return a;
end $$;

create function public.room_claim_refund() returns public.room_render_orders language plpgsql security definer set search_path=public as $$
declare o room_render_orders;
begin
 select * into o from room_render_orders where state in ('refund_pending','refund_failed') and payment_intent_id is not null
 and coalesce(refund_next_at,now())<=now() and (refund_lease_until is null or refund_lease_until<now()) order by updated_at for update skip locked limit 1;
 if not found then return null;end if;
 update room_render_orders set refund_token=gen_random_uuid(),refund_lease_until=now()+interval '2 minutes',refund_attempts=refund_attempts+1 where id=o.id returning * into o;return o;
end $$;
create function public.room_finish_refund(p_order uuid,p_token uuid,p_refund text,p_status text) returns public.room_render_orders language plpgsql security definer set search_path=public as $$
declare o room_render_orders;
begin
 select * into o from room_render_orders where id=p_order for update;
 if not found or o.refund_token is distinct from p_token or o.refund_lease_until<now() then raise exception 'Refund lease expired';end if;
 update room_render_orders set state=case when p_status='succeeded' then 'refunded' when p_status='pending' then 'refund_pending' else 'refund_failed' end,
 refund_id=coalesce(p_refund,refund_id),refund_token=null,refund_lease_until=null,refund_next_at=now()+interval '15 minutes',
 error=case when p_status='succeeded' then null when p_status='pending' then 'Full refund submitted; confirmation pending' else 'Refund needs retry or operator attention' end,updated_at=now() where id=o.id returning * into o;return o;
end $$;

-- Paid orders keep a minimal fulfilment/accounting record. Source deletion is
-- refused until work/refunds finish; then private project content may disappear.
alter table public.room_render_orders alter column project_id drop not null,alter column revision_id drop not null,alter column package_asset_id drop not null;
alter table public.room_render_orders drop constraint room_render_orders_project_id_fkey,drop constraint room_render_orders_revision_id_fkey,drop constraint room_render_orders_package_asset_id_fkey;
alter table public.room_render_orders add foreign key(project_id) references public.room_projects(id) on delete set null,
 add foreign key(revision_id) references public.room_revisions(id) on delete set null,
 add foreign key(package_asset_id) references public.room_assets(id) on delete set null;
alter table public.room_render_orders drop constraint room_render_orders_job_id_fkey;
alter table public.room_render_orders add foreign key(job_id) references public.room_jobs(id) on delete set null;
create or replace function public.room_mark_delete(p_owner uuid,p_project uuid,p_expired_only boolean default false)
returns text[] language plpgsql security definer set search_path=public as $$
declare paths text[];j room_jobs;
begin
 perform pg_advisory_xact_lock(72666831);perform pg_advisory_xact_lock(hashtextextended(p_owner::text,41));
 if exists(select 1 from room_render_orders where owner_id=p_owner and project_id=p_project and state in ('checkout_pending','queued','running','refund_pending','refund_failed')) then raise exception 'Cancel unfinished orders and complete refunds before deleting this project';end if;
 if p_expired_only and not exists(select 1 from room_projects where id=p_project and owner_id=p_owner and (deleting or(expires_at<=now() and expiry_notice_at is not null and expiry_notice_at<=now()-interval '7 days'))) then return null;end if;
 update room_projects set deleting=true where id=p_project and owner_id=p_owner;if not found then raise exception 'Project unavailable';end if;
 for j in select * from room_jobs where project_id=p_project and state in ('queued','running') for update loop
  update room_budget_months set reserved_pence=reserved_pence-j.reserved_pence,committed_pence=committed_pence+case when j.attempts>0 then j.reserved_pence else 0 end where month=j.budget_month;
  update room_jobs set state='cancelled',lease_token=null,lease_until=null,updated_at=now() where id=j.id;
 end loop;
 select coalesce(array_agg(storage_path),'{}') into paths from room_assets where project_id=p_project;return paths;
end $$;

revoke all on function public.room_checkout_available(),public.room_expire_checkouts(),public.room_prepare_order(uuid,uuid,uuid,uuid,text,jsonb),public.room_bind_checkout(uuid,uuid,text,text,bigint),
 public.room_receive_payment(text,text,uuid,text,text,integer,text,uuid,uuid,uuid,text),public.room_cancel_order(uuid,uuid),public.room_reserve_output(uuid,uuid,uuid,text,bigint,text,text),public.room_claim_output_cleanup(uuid,uuid),public.room_release_output(uuid,uuid),public.room_save_photo_project(uuid,uuid,text,jsonb,integer,boolean),public.room_expire_worker_leases(),public.room_claim_refund(),public.room_finish_refund(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.room_checkout_available(),public.room_expire_checkouts(),public.room_prepare_order(uuid,uuid,uuid,uuid,text,jsonb),public.room_bind_checkout(uuid,uuid,text,text,bigint),
 public.room_receive_payment(text,text,uuid,text,text,integer,text,uuid,uuid,uuid,text),public.room_cancel_order(uuid,uuid),public.room_reserve_output(uuid,uuid,uuid,text,bigint,text,text),public.room_claim_output_cleanup(uuid,uuid),public.room_release_output(uuid,uuid),public.room_save_photo_project(uuid,uuid,text,jsonb,integer,boolean),public.room_expire_worker_leases(),public.room_claim_refund(),public.room_finish_refund(uuid,uuid,text,text) to service_role;
