-- Private Room Studio. All writes go through authenticated Edge actions or
-- service-only atomic functions. Public website build has no service credential.
create table public.room_studio_settings (
  id boolean primary key default true check (id),
  paid_jobs_enabled boolean not null default false,
  live_ai_enabled boolean not null default false,
  monthly_cap_pence integer check (monthly_cap_pence > 0),
  analysis_reservation_pence integer check (analysis_reservation_pence > 0),
  render_reservation_pence integer check (render_reservation_pence > 0)
);
insert into public.room_studio_settings(id) values(true);

create table public.room_projects (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  snapshot jsonb not null,
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  expiry_notice_at timestamptz,
  deleting boolean not null default false,
  check (octet_length(snapshot::text) <= 2000000)
);
create index room_projects_owner on public.room_projects(owner_id);

create table public.room_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.room_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  number integer not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique(project_id, number)
);
create function public.room_revision_immutable() returns trigger language plpgsql as $$
begin raise exception 'Confirmed revisions are immutable'; end $$;
create trigger room_revisions_no_update before update on public.room_revisions for each row execute function public.room_revision_immutable();
create table public.room_assets (
  id uuid primary key,
  project_id uuid not null references public.room_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  kind text not null check (kind in ('artwork','plan','package','output')),
  mime text not null,
  bytes bigint not null check (bytes between 1 and 20971520),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  state text not null default 'pending' check (state in ('pending','ready','cancelled')),
  created_at timestamptz not null default now()
);
create table public.room_budget_months (
  month date primary key,
  reserved_pence integer not null default 0 check (reserved_pence >= 0),
  committed_pence integer not null default 0 check (committed_pence >= 0)
);
create table public.room_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.room_projects(id) on delete cascade,
  revision_id uuid references public.room_revisions(id) on delete cascade,
  type text not null check(type in ('analysis','render')),
  input_identity text not null,
  input jsonb not null,
  state text not null default 'queued' check (state in ('queued','running','succeeded','failed','cancelled')),
  reserved_pence integer not null check (reserved_pence > 0),
  budget_month date not null references public.room_budget_months(month),
  attempts integer not null default 0 check(attempts between 0 and 2),
  lease_token uuid,
  lease_until timestamptz,
  outputs jsonb not null default '[]',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, type, input_identity)
);
create unique index room_one_active_job on public.room_jobs(owner_id) where state in ('queued','running');
create index room_jobs_queue on public.room_jobs(state, created_at);
create table public.room_expiry_notices (
  project_id uuid primary key references public.room_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.room_studio_settings enable row level security;
alter table public.room_budget_months enable row level security;
alter table public.room_projects enable row level security;
alter table public.room_revisions enable row level security;
alter table public.room_assets enable row level security;
alter table public.room_jobs enable row level security;
alter table public.room_expiry_notices enable row level security;
create policy room_owner_projects on public.room_projects for select to authenticated using (auth.uid() = owner_id and not deleting);
create policy room_owner_revisions on public.room_revisions for select to authenticated using (auth.uid() = owner_id);
create policy room_owner_assets on public.room_assets for select to authenticated using (auth.uid() = owner_id);
create policy room_owner_jobs on public.room_jobs for select to authenticated using (auth.uid() = owner_id);
create policy room_owner_notices on public.room_expiry_notices for select to authenticated using (auth.uid() = owner_id);
revoke all on public.room_studio_settings, public.room_budget_months from anon, authenticated;
revoke all on public.room_projects, public.room_revisions, public.room_assets, public.room_jobs, public.room_expiry_notices from anon, authenticated;
grant select on public.room_projects, public.room_revisions, public.room_assets, public.room_jobs, public.room_expiry_notices to authenticated;
grant all on public.room_studio_settings, public.room_budget_months, public.room_projects, public.room_revisions, public.room_assets, public.room_jobs, public.room_expiry_notices to service_role;

-- Each owner lock serialises project quotas, revision numbering and active-job
-- admission. Global budget lock protects the cap even across different accounts.
create function public.room_save_project(p_owner uuid, p_id uuid, p_name text, p_snapshot jsonb, p_expected_revision integer)
returns public.room_projects language plpgsql security definer set search_path = public as $$
declare v_project public.room_projects;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 41));
  select * into v_project from room_projects where id = p_id for update;
  if found then
    if v_project.owner_id <> p_owner or v_project.deleting then raise exception 'Project unavailable'; end if;
    if v_project.revision <> p_expected_revision then raise exception 'Revision conflict: reload the saved project'; end if;
    update room_projects set name=p_name, snapshot=p_snapshot, updated_at=now(),
      expires_at=now()+interval '90 days', expiry_notice_at=null where id=p_id returning * into v_project;
    delete from room_expiry_notices where project_id=p_id;
  else
    if (select count(*) from room_projects where owner_id=p_owner and not deleting) >= 5 then raise exception 'Five project limit reached'; end if;
    insert into room_projects(id,owner_id,name,snapshot) values(p_id,p_owner,p_name,p_snapshot) returning * into v_project;
  end if;
  return v_project;
end $$;

create function public.room_confirm_revision(p_owner uuid, p_project uuid, p_snapshot jsonb, p_expected_revision integer)
returns public.room_revisions language plpgsql security definer set search_path = public as $$
declare v_project public.room_projects; v_revision public.room_revisions;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,41));
  select * into v_project from room_projects where id=p_project and owner_id=p_owner and not deleting for update;
  if not found then raise exception 'Project unavailable'; end if;
  -- A repeated confirmation of the current exact snapshot is idempotent.
  select * into v_revision from room_revisions where project_id=p_project and number=v_project.revision
    and (snapshot-'updatedAt'-'revision')=(p_snapshot-'updatedAt'-'revision');
  if found then return v_revision; end if;
  if v_project.revision <> p_expected_revision then raise exception 'Revision conflict: reload the saved project'; end if;
  insert into room_revisions(project_id,owner_id,number,snapshot)
    values(p_project,p_owner,v_project.revision+1,p_snapshot) returning * into v_revision;
  update room_projects set revision=v_revision.number,snapshot=p_snapshot,updated_at=now(),
    expires_at=now()+interval '90 days',expiry_notice_at=null where id=p_project;
  delete from room_expiry_notices where project_id=p_project;
  return v_revision;
end $$;

create function public.room_prepare_project(p_owner uuid,p_id uuid,p_name text,p_snapshot jsonb)
returns public.room_projects language plpgsql security definer set search_path = public as $$
declare v_project public.room_projects;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,41));
  select * into v_project from room_projects where id=p_id;
  if found then
    if v_project.owner_id<>p_owner or v_project.deleting then raise exception 'Project unavailable'; end if;
    return v_project;
  end if;
  return room_save_project(p_owner,p_id,p_name,p_snapshot,0);
end $$;

create function public.room_reserve_asset(p_owner uuid,p_project uuid,p_id uuid,p_kind text,p_mime text,p_bytes bigint,p_sha text,p_extension text)
returns public.room_assets language plpgsql security definer set search_path = public as $$
declare v_asset public.room_assets;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,41));
  if not exists(select 1 from room_projects where id=p_project and owner_id=p_owner and not deleting) then raise exception 'Project unavailable'; end if;
  if p_extension not in ('png','jpg','webp','pdf','json') then raise exception 'Unsupported file'; end if;
  if (select coalesce(sum(bytes),0) from room_assets where project_id=p_project)+p_bytes > 104857600 then raise exception 'Project storage limit reached'; end if;
  insert into room_assets(id,project_id,owner_id,storage_path,kind,mime,bytes,sha256)
    values(p_id,p_project,p_owner,p_owner::text||'/'||p_project::text||'/'||p_id::text||'.'||p_extension,p_kind,p_mime,p_bytes,p_sha)
    returning * into v_asset;
  return v_asset;
end $$;

create function public.room_enqueue_job(p_owner uuid,p_project uuid,p_type text,p_identity text,p_revision uuid,p_input jsonb)
returns public.room_jobs language plpgsql security definer set search_path = public as $$
declare v_job public.room_jobs; v_settings public.room_studio_settings; v_month date; v_amount integer; v_limit integer; v_budget public.room_budget_months;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,41));
  if not exists(select 1 from room_projects where id=p_project and owner_id=p_owner and not deleting) then raise exception 'Project unavailable'; end if;
  select * into v_job from room_jobs where owner_id=p_owner and type=p_type and input_identity=p_identity;
  if found then return v_job; end if;
  if p_type not in ('analysis','render') then raise exception 'Unknown job type'; end if;
  select * into v_settings from room_studio_settings where id;
  if not v_settings.paid_jobs_enabled or v_settings.monthly_cap_pence is null then raise exception 'Paid processing is disabled until a budget is configured'; end if;
  if p_type='analysis' and not v_settings.live_ai_enabled then raise exception 'Live AI analysis is disabled'; end if;
  if p_type='render' and not exists(select 1 from room_revisions where id=p_revision and project_id=p_project and owner_id=p_owner) then raise exception 'Confirm a saved revision first'; end if;
  if exists(select 1 from room_jobs where owner_id=p_owner and state in ('queued','running')) then raise exception 'One active job per account'; end if;
  v_limit := case when p_type='analysis' then 2 else 1 end;
  if (select count(*) from room_jobs where owner_id=p_owner and type=p_type and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC') >= v_limit then raise exception 'Daily allowance reached'; end if;
  v_amount := case when p_type='analysis' then v_settings.analysis_reservation_pence else v_settings.render_reservation_pence end;
  if v_amount is null then raise exception 'Maximum job cost is not configured'; end if;
  v_month := date_trunc('month',now() at time zone 'UTC')::date;
  perform pg_advisory_xact_lock(72666831);
  insert into room_budget_months(month) values(v_month) on conflict do nothing;
  select * into v_budget from room_budget_months where month=v_month for update;
  if v_budget.reserved_pence+v_budget.committed_pence+v_amount > v_settings.monthly_cap_pence then raise exception 'Monthly processing allowance reached'; end if;
  update room_budget_months set reserved_pence=reserved_pence+v_amount where month=v_month;
  insert into room_jobs(owner_id,project_id,revision_id,type,input_identity,input,reserved_pence,budget_month)
    values(p_owner,p_project,p_revision,p_type,p_identity,p_input,v_amount,v_month) returning * into v_job;
  return v_job;
end $$;

create function public.room_finish_upload(p_owner uuid,p_asset uuid,p_cancel boolean default false)
returns public.room_assets language plpgsql security definer set search_path = public as $$
declare v_asset public.room_assets;
begin
  select * into v_asset from room_assets where id=p_asset and owner_id=p_owner and kind in ('artwork','plan') for update;
  if not found then raise exception 'Private asset unavailable'; end if;
  if p_cancel then
    if v_asset.state='ready' then return null; end if;
    update room_assets set state='cancelled' where id=p_asset returning * into v_asset;
  else
    if v_asset.state='cancelled' then raise exception 'Upload was cancelled'; end if;
    update room_assets set state='ready' where id=p_asset returning * into v_asset;
  end if;
  return v_asset;
end $$;

create function public.room_finish_job(p_id uuid,p_token uuid,p_success boolean,p_outputs jsonb,p_error text,p_retryable boolean default false)
returns public.room_jobs language plpgsql security definer set search_path = public as $$
declare v_job public.room_jobs;
begin
  select * into v_job from room_jobs where id=p_id for update;
  if not found or v_job.state <> 'running' or v_job.lease_token is distinct from p_token then raise exception 'Worker lease is no longer valid'; end if;
  if not p_success and p_retryable and v_job.attempts < 2 then
    update room_jobs set state='queued',lease_token=null,lease_until=null,error=left(p_error,500),updated_at=now() where id=p_id returning * into v_job;
    return v_job;
  end if;
  update room_jobs set state=case when p_success then 'succeeded' else 'failed' end,outputs=case when p_success then p_outputs else '[]'::jsonb end,
    error=case when p_success then null else left(p_error,500) end,lease_token=null,lease_until=null,updated_at=now() where id=p_id returning * into v_job;
  -- Conservatively book the complete reservation once execution began. This is a
  -- budget ceiling, not a claim about the vendor's actual invoice.
  update room_budget_months set reserved_pence=reserved_pence-v_job.reserved_pence,committed_pence=committed_pence+v_job.reserved_pence where month=v_job.budget_month;
  return v_job;
end $$;

create function public.room_claim_job(p_type text)
returns public.room_jobs language plpgsql security definer set search_path = public as $$
declare v_job public.room_jobs; v_settings public.room_studio_settings;
begin
  select * into v_settings from room_studio_settings where id;
  if not v_settings.paid_jobs_enabled or v_settings.monthly_cap_pence is null or (p_type='analysis' and not v_settings.live_ai_enabled) then return null; end if;
  -- A hard worker timeout is shorter than the lease. Expired leases can retry
  -- once; stale workers cannot publish because their token has been invalidated.
  for v_job in select * from room_jobs where state='running' and lease_until<now() for update skip locked loop
    perform room_finish_job(v_job.id,v_job.lease_token,false,'[]','Processing timed out',true);
  end loop;
  select j.* into v_job from room_jobs j join room_projects p on p.id=j.project_id
    where j.state='queued' and j.type=p_type and j.attempts<2 and not p.deleting order by j.created_at for update of j skip locked limit 1;
  if not found then return null; end if;
  update room_jobs set state='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '15 minutes',updated_at=now()
    where id=v_job.id returning * into v_job;
  return v_job;
end $$;

create function public.room_mark_delete(p_owner uuid,p_project uuid,p_expired_only boolean default false)
returns text[] language plpgsql security definer set search_path = public as $$
declare v_paths text[]; v_job public.room_jobs;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,41));
  if p_expired_only and not exists(select 1 from room_projects where id=p_project and owner_id=p_owner and
    (deleting or (expires_at<=now() and expiry_notice_at is not null and expiry_notice_at<=now()-interval '7 days'))) then return null; end if;
  update room_projects set deleting=true where id=p_project and owner_id=p_owner;
  if not found then raise exception 'Project unavailable'; end if;
  for v_job in select * from room_jobs where project_id=p_project and state in ('queued','running') for update loop
    update room_budget_months set reserved_pence=reserved_pence-v_job.reserved_pence,
      committed_pence=committed_pence+case when v_job.attempts>0 then v_job.reserved_pence else 0 end where month=v_job.budget_month;
    update room_jobs set state='cancelled',lease_token=null,lease_until=null,updated_at=now() where id=v_job.id;
  end loop;
  select coalesce(array_agg(storage_path),'{}') into v_paths from room_assets where project_id=p_project;
  return v_paths;
end $$;

create function public.room_retention_candidates()
returns setof public.room_projects language plpgsql security definer set search_path = public as $$
begin
  insert into room_expiry_notices(project_id,owner_id,expires_at)
    select id,owner_id,expires_at from room_projects where not deleting and expires_at<=now()+interval '7 days'
    on conflict(project_id) do nothing;
  -- Never expire a project before a delivered seven-day advance notice.
  return query select * from room_projects where deleting or
    (expires_at<=now() and expiry_notice_at is not null and expiry_notice_at<=now()-interval '7 days');
end $$;

-- No client may call privileged RPCs directly with an arbitrary owner ID.
revoke all on function public.room_save_project(uuid,uuid,text,jsonb,integer),public.room_prepare_project(uuid,uuid,text,jsonb),public.room_confirm_revision(uuid,uuid,jsonb,integer),
 public.room_reserve_asset(uuid,uuid,uuid,text,text,bigint,text,text),public.room_finish_upload(uuid,uuid,boolean),public.room_enqueue_job(uuid,uuid,text,text,uuid,jsonb),
 public.room_finish_job(uuid,uuid,boolean,jsonb,text,boolean),public.room_claim_job(text),public.room_mark_delete(uuid,uuid,boolean),public.room_retention_candidates()
 from public, anon, authenticated;
grant execute on function public.room_save_project(uuid,uuid,text,jsonb,integer),public.room_prepare_project(uuid,uuid,text,jsonb),public.room_confirm_revision(uuid,uuid,jsonb,integer),
 public.room_reserve_asset(uuid,uuid,uuid,text,text,bigint,text,text),public.room_finish_upload(uuid,uuid,boolean),public.room_enqueue_job(uuid,uuid,text,text,uuid,jsonb),
 public.room_finish_job(uuid,uuid,boolean,jsonb,text,boolean),public.room_claim_job(text),public.room_mark_delete(uuid,uuid,boolean),public.room_retention_candidates()
 to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('room-studio','room-studio',false,20971520,array['image/png','image/jpeg','image/webp','application/pdf','application/json'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Deliberately no authenticated storage-object policy: the Edge function checks
-- the asset's owner, then gives a short-lived signed URL for that one object.
