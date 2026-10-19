-- Transactional workspace notifications only. Disabled in DB and worker env by
-- default. The client cannot choose recipients, message contents or send times.
alter table public.designer_settings
  add column notifications_enabled boolean not null default false,
  add column notifications_enabled_at timestamptz,
  add column notification_provider text check(notification_provider='resend'),
  add column notification_sender text,
  add column notification_workspace_url text,
  add column notification_monthly_cap integer check(notification_monthly_cap between 1 and 10000),
  add column notification_daily_studio_cap integer check(notification_daily_studio_cap between 1 and 100),
  add column notification_monthly_budget_pence bigint check(notification_monthly_budget_pence between 1 and 1000000000),
  add column notification_worst_case_attempt_pence bigint check(notification_worst_case_attempt_pence between 1 and 1000000);
alter table public.designer_outbox add column notifications_enqueued_at timestamptz;
create table public.designer_notification_usage (
  month date primary key,
  reserved_count integer not null default 0 check(reserved_count>=0),
  committed_count integer not null default 0 check(committed_count>=0),
  reserved_pence bigint not null default 0 check(reserved_pence>=0),
  committed_pence bigint not null default 0 check(committed_pence>=0)
);
create table public.designer_notifications (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references public.designer_outbox(id),
  studio_id uuid not null,
  project_id uuid not null,
  recipient_user_id uuid not null references auth.users(id),
  recipient_email text not null,
  provider text not null check(provider='resend'),
  provider_payload jsonb not null,
  idempotency_key text not null unique,
  state text not null default 'queued' check(state in ('queued','running','provider_accepted','delivered','bounced','complained','failed','uncertain','cancelled')),
  attempts integer not null default 0 check(attempts between 0 and 3),
  first_attempt_at timestamptz,
  available_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  reserved_pence bigint not null default 0 check(reserved_pence>=0),
  budget_month date references public.designer_notification_usage(month),
  budget_settled boolean not null default false,
  provider_email_id text,
  provider_accepted_at timestamptz,
  delivered_at timestamptz,
  provider_event text,
  delivery_checks integer not null default 0 check(delivery_checks between 0 and 12),
  delivery_lease_token uuid,
  delivery_lease_until timestamptz,
  next_delivery_check_at timestamptz,
  last_delivery_check_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(outbox_id,recipient_user_id),
  foreign key(project_id,studio_id) references public.designer_projects(id,studio_id)
);
create index designer_notifications_queue on public.designer_notifications(state,available_at,created_at);
alter table public.designer_notifications enable row level security;
alter table public.designer_notification_usage enable row level security;
revoke all on public.designer_notifications,public.designer_notification_usage from public,anon,authenticated;
grant all on public.designer_notifications,public.designer_notification_usage to service_role;

create function public.designer_notification_payload_immutable() returns trigger language plpgsql as $$
begin
  if new.provider_payload is distinct from old.provider_payload or new.idempotency_key is distinct from old.idempotency_key or new.recipient_email is distinct from old.recipient_email or new.recipient_user_id is distinct from old.recipient_user_id or new.outbox_id is distinct from old.outbox_id or new.project_id is distinct from old.project_id or new.studio_id is distinct from old.studio_id or new.provider is distinct from old.provider then raise exception 'Notification payload and identity are immutable'; end if;
  return new;
end $$;
create trigger designer_notification_payload_fixed before update on public.designer_notifications for each row execute function public.designer_notification_payload_immutable();

create function public.designer_save_notification_settings(p_actor uuid,p_config jsonb)
returns public.designer_settings language plpgsql security definer set search_path=public as $$
declare s public.designer_settings; enabled boolean; sender text; url text;
begin
  if not designer_is_staff(p_actor,true) then raise exception 'Owner administrator required'; end if;
  enabled:=(p_config->>'enabled')::boolean; sender:=lower(p_config->>'sender'); url:=p_config->>'workspaceUrl';
  if enabled is null or (p_config->>'provider') is distinct from 'resend' then raise exception 'Invalid notification configuration'; end if;
  if sender is not null and (length(sender)>254 or sender !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') then raise exception 'Invalid notification sender'; end if;
  if url is not null and (length(url)>300 or url !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?/designer-portal/?$') then raise exception 'Invalid notification workspace URL'; end if;
  if enabled and (sender is null or url is null or (p_config->>'monthlyCap') is null or (p_config->>'dailyStudioCap') is null or (p_config->>'monthlyBudgetPence') is null or (p_config->>'worstCaseAttemptPence') is null or (p_config->>'monthlyBudgetPence')::bigint < 3*(p_config->>'worstCaseAttemptPence')::bigint) then raise exception 'Notification caps and budget must be configured'; end if;
  update designer_settings set notifications_enabled=enabled,
    notifications_enabled_at=case when enabled and not notifications_enabled then now() else notifications_enabled_at end,
    notification_provider='resend',notification_sender=sender,notification_workspace_url=url,
    notification_monthly_cap=(p_config->>'monthlyCap')::integer,notification_daily_studio_cap=(p_config->>'dailyStudioCap')::integer,
    notification_monthly_budget_pence=(p_config->>'monthlyBudgetPence')::bigint,notification_worst_case_attempt_pence=(p_config->>'worstCaseAttemptPence')::bigint
    where id returning * into s;
  return s;
end $$;

create function public.designer_queue_notifications(p_limit integer default 25)
returns integer language plpgsql security definer set search_path=public as $$
declare s public.designer_settings; o public.designer_outbox; project uuid; member record; n integer:=0; notification_id uuid;
begin
  select * into s from designer_settings where id;
  if not s.notifications_enabled or s.notification_provider is distinct from 'resend' or s.notification_sender is null or s.notification_workspace_url is null then return 0; end if;
  if p_limit<1 or p_limit>100 then raise exception 'Invalid notification batch size'; end if;
  for o in select * from designer_outbox where notifications_enqueued_at is null and created_at>=s.notifications_enabled_at and created_at>=now()-interval '24 hours'
    and event_type in ('estimate.issued','job.succeeded','job.failed') order by created_at,id for update skip locked limit p_limit loop
    project:=null;
    if o.event_type='estimate.issued' then select project_id into project from designer_estimates where id=(o.payload->>'estimateId')::uuid and studio_id=o.studio_id;
    else select project_id into project from designer_jobs where id=(o.payload->>'jobId')::uuid and studio_id=o.studio_id and type in ('document.verify','document.extract'); end if;
    if project is not null then
      for member in select m.user_id,lower(u.email) as email from designer_memberships m join auth.users u on u.id=m.user_id
        where m.studio_id=o.studio_id and u.email_confirmed_at is not null and u.email is not null loop
        notification_id:=gen_random_uuid();
        insert into designer_notifications(id,outbox_id,studio_id,project_id,recipient_user_id,recipient_email,provider,idempotency_key,provider_payload)
          values(notification_id,o.id,o.studio_id,project,member.user_id,member.email,'resend','designer-workspace/'||notification_id::text,
            jsonb_build_object('from',s.notification_sender,'to',jsonb_build_array(member.email),'subject','Your Mr Wallcover workspace has an update',
              'text','An update is available in your Mr Wallcover workspace. Sign in to review it: '||s.notification_workspace_url))
          on conflict(outbox_id,recipient_user_id) do nothing;
        if found then n:=n+1; end if;
      end loop;
    end if;
    update designer_outbox set notifications_enqueued_at=now() where id=o.id;
  end loop;
  return n;
end $$;

create function public.designer_settle_notification_budget(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare n public.designer_notifications;
begin
  select * into n from designer_notifications where id=p_id for update;
  if n.reserved_pence>0 and not n.budget_settled then
    update designer_notification_usage set reserved_count=reserved_count-1,committed_count=committed_count+1,
      reserved_pence=reserved_pence-n.reserved_pence,committed_pence=committed_pence+n.reserved_pence where month=n.budget_month;
    update designer_notifications set budget_settled=true where id=n.id;
  end if;
end $$;

create function public.designer_claim_notification(p_lease_seconds integer default 120)
returns public.designer_notifications language plpgsql security definer set search_path=public as $$
declare s public.designer_settings; n public.designer_notifications; b public.designer_notification_usage; m date; amount bigint;
begin
  select * into s from designer_settings where id;
  if not s.notifications_enabled or s.notification_provider is distinct from 'resend' or s.notification_monthly_cap is null or s.notification_daily_studio_cap is null or s.notification_monthly_budget_pence is null or s.notification_worst_case_attempt_pence is null then return null; end if;
  if p_lease_seconds<30 or p_lease_seconds>300 then raise exception 'Invalid notification lease'; end if;
  for n in select * from designer_notifications where state='running' and lease_until<=now() for update skip locked loop
    update designer_notifications set state=case when attempts>=3 or first_attempt_at<=now()-interval '23 hours' then 'uncertain' else 'queued' end,
      lease_token=null,lease_until=null,error='Notification worker lease expired',updated_at=now() where id=n.id;
    if n.attempts>=3 or n.first_attempt_at<=now()-interval '23 hours' then perform designer_settle_notification_budget(n.id); end if;
  end loop;
  -- No automatic send is allowed to outlive the provider's idempotency window.
  for n in select * from designer_notifications where state='queued' and first_attempt_at<=now()-interval '23 hours' for update skip locked loop
    update designer_notifications set state='uncertain',error='Idempotency retry window expired; manual reconciliation required',updated_at=now() where id=n.id;
    perform designer_settle_notification_budget(n.id);
  end loop;
  select q.* into n from designer_notifications q where q.state='queued' and q.attempts<3 and q.available_at<=now()
    and (q.reserved_pence>0 or (select count(*) from designer_notifications used where used.studio_id=q.studio_id and used.first_attempt_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')<s.notification_daily_studio_cap)
    order by q.created_at,q.id for update of q skip locked limit 1;
  if not found then return null; end if;
  if not exists(select 1 from designer_memberships m join auth.users u on u.id=m.user_id where m.studio_id=n.studio_id and m.user_id=n.recipient_user_id and lower(u.email)=n.recipient_email and u.email_confirmed_at is not null)
    or n.provider_payload->>'from' is distinct from s.notification_sender or n.provider_payload->>'text' is distinct from 'An update is available in your Mr Wallcover workspace. Sign in to review it: '||s.notification_workspace_url then
    update designer_notifications set state=case when attempts>0 then 'uncertain' else 'cancelled' end,error='Recipient access or approved sender configuration changed',updated_at=now() where id=n.id;
    perform designer_settle_notification_budget(n.id); return null;
  end if;
  if n.reserved_pence=0 then
    perform pg_advisory_xact_lock(72418004);
    m:=date_trunc('month',now() at time zone 'UTC')::date; amount:=s.notification_worst_case_attempt_pence*3;
    insert into designer_notification_usage(month) values(m) on conflict do nothing;
    select * into b from designer_notification_usage where month=m for update;
    if b.reserved_count+b.committed_count>=s.notification_monthly_cap or b.reserved_pence+b.committed_pence+amount>s.notification_monthly_budget_pence then return null; end if;
    if (select count(*) from designer_notifications where studio_id=n.studio_id and first_attempt_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=s.notification_daily_studio_cap then return null; end if;
    update designer_notification_usage set reserved_count=reserved_count+1,reserved_pence=reserved_pence+amount where month=m;
    update designer_notifications set reserved_pence=amount,budget_month=m where id=n.id;
  end if;
  update designer_notifications set state='running',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),lease_token=gen_random_uuid(),lease_until=now()+make_interval(secs=>p_lease_seconds),updated_at=now() where id=n.id returning * into n;
  return n;
end $$;
create function public.designer_notification_send_authorized(p_id uuid,p_token uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from designer_notifications n join designer_settings s on s.id
    join designer_memberships m on m.studio_id=n.studio_id and m.user_id=n.recipient_user_id
    join auth.users u on u.id=m.user_id
    where n.id=p_id and n.state='running' and n.lease_token=p_token and n.lease_until>now()+interval '25 seconds'
      and n.first_attempt_at>now()-interval '23 hours' and s.notifications_enabled and s.notification_provider='resend'
      and lower(u.email)=n.recipient_email and u.email_confirmed_at is not null
      and n.provider_payload->>'from'=s.notification_sender
      and n.provider_payload->>'text'='An update is available in your Mr Wallcover workspace. Sign in to review it: '||s.notification_workspace_url)
$$;

create function public.designer_finish_notification(p_id uuid,p_token uuid,p_outcome text,p_provider_id text default null,p_error text default null)
returns public.designer_notifications language plpgsql security definer set search_path=public as $$
declare n public.designer_notifications;
begin
  select * into n from designer_notifications where id=p_id for update;
  if not found or n.state<>'running' or n.lease_token is distinct from p_token or n.lease_until<=now() then raise exception 'Notification worker lease is no longer valid'; end if;
  if p_outcome not in ('accepted','retry','failed','uncertain') then raise exception 'Invalid notification outcome'; end if;
  if p_outcome='accepted' and (p_provider_id is null or p_provider_id !~ '^[A-Za-z0-9_-]{1,100}$') then raise exception 'Invalid provider email ID'; end if;
  update designer_notifications set state=case when p_outcome='accepted' then 'provider_accepted' when p_outcome='retry' and attempts<3 and first_attempt_at>now()-interval '23 hours' then 'queued' when p_outcome='failed' then 'failed' else 'uncertain' end,
    provider_email_id=case when p_outcome='accepted' then p_provider_id else provider_email_id end,
    provider_accepted_at=case when p_outcome='accepted' then now() else provider_accepted_at end,
    next_delivery_check_at=case when p_outcome='accepted' then now()+interval '1 minute' else null end,
    available_at=now()+make_interval(secs=>attempts*30),lease_token=null,lease_until=null,error=case when p_outcome='accepted' then null else left(coalesce(p_error,'Notification requires review'),500) end,updated_at=now()
    where id=n.id returning * into n;
  if n.state<>'queued' then perform designer_settle_notification_budget(n.id); end if;
  return n;
end $$;

create function public.designer_claim_delivery_check(p_lease_seconds integer default 120)
returns public.designer_notifications language plpgsql security definer set search_path=public as $$
declare n public.designer_notifications;
begin
  if not exists(select 1 from designer_settings where id and notifications_enabled and notification_provider='resend') then return null; end if;
  if p_lease_seconds<30 or p_lease_seconds>300 then raise exception 'Invalid notification lease'; end if;
  select * into n from designer_notifications where state='provider_accepted' and provider_email_id is not null and delivery_checks<12 and next_delivery_check_at<=now()
    and (delivery_lease_until is null or delivery_lease_until<=now()) order by next_delivery_check_at,id for update skip locked limit 1;
  if not found then return null; end if;
  update designer_notifications set delivery_checks=delivery_checks+1,delivery_lease_token=gen_random_uuid(),delivery_lease_until=now()+make_interval(secs=>p_lease_seconds),updated_at=now() where id=n.id returning * into n;
  return n;
end $$;
create function public.designer_finish_delivery_check(p_id uuid,p_token uuid,p_event text default null,p_error text default null)
returns public.designer_notifications language plpgsql security definer set search_path=public as $$
declare n public.designer_notifications;
begin
  select * into n from designer_notifications where id=p_id for update;
  if not found or n.state<>'provider_accepted' or n.delivery_lease_token is distinct from p_token or n.delivery_lease_until<=now() then raise exception 'Delivery check lease is no longer valid'; end if;
  if p_event is not null and p_event !~ '^[a-z_]{1,40}$' then raise exception 'Invalid provider event'; end if;
  update designer_notifications set state=case when p_event in ('delivered','bounced','complained') then p_event else 'provider_accepted' end,
    provider_event=coalesce(p_event,provider_event),delivered_at=case when p_event='delivered' then now() else delivered_at end,
    last_delivery_check_at=now(),next_delivery_check_at=case when p_event in ('delivered','bounced','complained') or delivery_checks>=12 then null else now()+interval '1 hour' end,
    delivery_lease_token=null,delivery_lease_until=null,error=case when p_error is null then null else left(p_error,500) end,updated_at=now() where id=n.id returning * into n;
  return n;
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname like 'designer_%' and (p.proname like '%notification%' or p.proname like '%delivery_check%') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
