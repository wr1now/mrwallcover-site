-- Private designer workspace. Only the verified Edge service and worker may
-- mutate these tables/RPCs. Browser reads are constrained by studio membership.
create table public.designer_settings (
  id boolean primary key default true check(id),
  uploads_enabled boolean not null default false,
  worker_enabled boolean not null default false,
  monthly_budget_pence bigint check(monthly_budget_pence between 1 and 1000000000),
  worst_case_job_pence bigint check(worst_case_job_pence between 1 and 100000000),
  max_file_bytes bigint not null default 104857600 check(max_file_bytes between 1 and 104857600),
  max_project_bytes bigint not null default 1073741824 check(max_project_bytes between 1 and 1073741824),
  max_project_documents integer not null default 50 check(max_project_documents between 1 and 50)
);
insert into public.designer_settings(id) values(true);
create table public.designer_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check(role in ('owner','staff')),
  created_at timestamptz not null default now()
);
create table public.designer_studios (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(name) between 1 and 120),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.designer_memberships (
  studio_id uuid not null references public.designer_studios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key(studio_id,user_id)
);
create table public.designer_invitations (
  studio_id uuid not null references public.designer_studios(id) on delete cascade,
  email text not null check(email=lower(email) and length(email) between 3 and 254),
  role text not null check(role in ('editor','viewer')),
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default now()+interval '14 days',
  primary key(studio_id,email)
);
create table public.designer_projects (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.designer_studios(id) on delete cascade,
  name text not null check(length(name) between 1 and 120),
  draft jsonb not null check(octet_length(draft::text)<=2000000),
  revision integer not null default 1 check(revision>0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,studio_id)
);
create table public.designer_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  studio_id uuid not null,
  number integer not null check(number>0),
  draft jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(project_id,studio_id) references public.designer_projects(id,studio_id) on delete cascade,
  unique(project_id,number)
);
create table public.designer_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  studio_id uuid not null,
  revision integer not null default 1 check(revision>0),
  supersedes_document_id uuid references public.designer_documents(id),
  file_name text not null check(length(file_name) between 1 and 180),
  declared_mime text not null,
  bytes bigint not null check(bytes between 1 and 104857600),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text not null unique,
  state text not null default 'reserved' check(state in ('reserved','queued','verifying','ready','review_required','quarantined','failed')),
  verified boolean not null default false,
  actual_mime text,
  review_required boolean not null default true,
  error text,
  reservation_expires_at timestamptz not null default now()+interval '1 hour',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(project_id,studio_id) references public.designer_projects(id,studio_id) on delete cascade,
  unique(id,project_id,studio_id)
);
create table public.designer_evidence (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  project_id uuid not null,
  studio_id uuid not null,
  evidence jsonb not null check(octet_length(evidence::text)<=2000000),
  created_at timestamptz not null default now(),
  foreign key(document_id,project_id,studio_id) references public.designer_documents(id,project_id,studio_id) on delete cascade,
  unique(id,project_id,studio_id)
);
create table public.designer_evidence_checks (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null,
  project_id uuid not null,
  studio_id uuid not null,
  project_revision integer not null check(project_revision>0),
  checked_by uuid not null references auth.users(id),
  checked_at timestamptz not null default now(),
  foreign key(evidence_id,project_id,studio_id) references public.designer_evidence(id,project_id,studio_id) on delete cascade,
  unique(evidence_id,project_revision)
);
create table public.designer_configs (
  id uuid primary key default gen_random_uuid(),
  version integer generated always as identity unique,
  config jsonb not null check(octet_length(config::text)<=2000000),
  active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index designer_one_active_config on public.designer_configs(active) where active;
create table public.designer_estimates (
  id uuid primary key,
  project_id uuid not null,
  studio_id uuid not null,
  project_revision integer not null,
  config_id uuid not null references public.designer_configs(id),
  snapshot jsonb not null check(octet_length(snapshot::text)<=3000000),
  source_manifest jsonb not null default '{}',
  public_projection jsonb not null,
  idempotency_key text not null check(length(idempotency_key) between 8 and 100),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(project_id,studio_id) references public.designer_projects(id,studio_id) on delete cascade,
  unique(studio_id,idempotency_key),
  unique(id,project_id,studio_id)
);
create table public.designer_estimate_files (
  estimate_id uuid primary key references public.designer_estimates(id) on delete cascade,
  project_id uuid not null,
  studio_id uuid not null,
  storage_path text not null unique,
  state text not null default 'pending' check(state in ('pending','ready','failed')),
  bytes bigint,
  sha256 text,
  updated_at timestamptz not null default now(),
  foreign key(project_id,studio_id) references public.designer_projects(id,studio_id) on delete cascade
);
create table public.designer_shares (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null,
  project_id uuid not null,
  studio_id uuid not null,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(estimate_id,project_id,studio_id) references public.designer_estimates(id,project_id,studio_id) on delete cascade
);
create table public.designer_budget_months (
  month date primary key,
  reserved_pence bigint not null default 0 check(reserved_pence>=0),
  committed_pence bigint not null default 0 check(committed_pence>=0)
);
create table public.designer_jobs (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null,
  project_id uuid not null,
  type text not null check(type in ('document.verify','document.extract','estimate.pdf')),
  identity text not null,
  input jsonb not null,
  output jsonb,
  state text not null default 'queued' check(state in ('queued','running','succeeded','failed','cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3 check(max_attempts between 1 and 3),
  reserved_pence bigint not null default 0 check(reserved_pence>=0),
  budget_month date references public.designer_budget_months(month),
  lease_token uuid,
  lease_until timestamptz,
  available_at timestamptz not null default now(),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(project_id,studio_id) references public.designer_projects(id,studio_id) on delete cascade,
  check(attempts between 0 and max_attempts),
  unique(studio_id,type,identity)
);
create index designer_jobs_queue on public.designer_jobs(state,available_at,created_at);
create table public.designer_outbox (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.designer_studios(id) on delete cascade,
  event_type text not null,
  identity text not null unique,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  attempts integer not null default 0 check(attempts between 0 and 3),
  lease_token uuid,
  lease_until timestamptz,
  error text
);

create function public.designer_is_staff(p_actor uuid,p_owner_only boolean default false)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from designer_staff where user_id=p_actor and (not p_owner_only or role='owner'))
$$;
create function public.designer_has_access(p_actor uuid,p_studio uuid,p_write boolean default false,p_owner_only boolean default false)
returns boolean language sql stable security definer set search_path=public as $$
  select designer_is_staff(p_actor,p_owner_only) or exists(select 1 from designer_memberships where user_id=p_actor and studio_id=p_studio
    and (not p_write or role in ('owner','editor')) and (not p_owner_only or role='owner'))
$$;
create function public.designer_my_studio(p_studio uuid)
returns boolean language sql stable security definer set search_path=public as $$ select designer_has_access(auth.uid(),p_studio,false,false) $$;

alter table public.designer_settings enable row level security;
alter table public.designer_staff enable row level security;
alter table public.designer_studios enable row level security;
alter table public.designer_memberships enable row level security;
alter table public.designer_invitations enable row level security;
alter table public.designer_projects enable row level security;
alter table public.designer_revisions enable row level security;
alter table public.designer_documents enable row level security;
alter table public.designer_evidence enable row level security;
alter table public.designer_evidence_checks enable row level security;
alter table public.designer_configs enable row level security;
alter table public.designer_estimates enable row level security;
alter table public.designer_estimate_files enable row level security;
alter table public.designer_shares enable row level security;
alter table public.designer_jobs enable row level security;
alter table public.designer_budget_months enable row level security;
alter table public.designer_outbox enable row level security;
create policy designer_studios_read on public.designer_studios for select to authenticated using(designer_my_studio(id));
create policy designer_memberships_read on public.designer_memberships for select to authenticated using(designer_my_studio(studio_id));
create policy designer_projects_read on public.designer_projects for select to authenticated using(designer_my_studio(studio_id));
create policy designer_revisions_read on public.designer_revisions for select to authenticated using(designer_my_studio(studio_id));
create policy designer_documents_read on public.designer_documents for select to authenticated using(designer_my_studio(studio_id));
create policy designer_evidence_read on public.designer_evidence for select to authenticated using(designer_my_studio(studio_id));
create policy designer_checks_read on public.designer_evidence_checks for select to authenticated using(designer_my_studio(studio_id));
create policy designer_estimates_read on public.designer_estimates for select to authenticated using(designer_my_studio(studio_id));
create policy designer_files_read on public.designer_estimate_files for select to authenticated using(designer_my_studio(studio_id));
-- Shares/tokens, raw jobs/input, staff allowlists, configs and outbox have no
-- browser policy. The API exposes only the explicitly permitted projections.
revoke all on public.designer_settings,public.designer_staff,public.designer_studios,public.designer_memberships,public.designer_invitations,public.designer_projects,public.designer_revisions,public.designer_documents,public.designer_evidence,public.designer_evidence_checks,public.designer_configs,public.designer_estimates,public.designer_estimate_files,public.designer_shares,public.designer_jobs,public.designer_outbox,public.designer_budget_months from anon,authenticated;
grant select on public.designer_studios,public.designer_memberships,public.designer_projects,public.designer_revisions,public.designer_documents,public.designer_evidence,public.designer_evidence_checks,public.designer_estimates,public.designer_estimate_files to authenticated;
grant all on public.designer_settings,public.designer_staff,public.designer_studios,public.designer_memberships,public.designer_invitations,public.designer_projects,public.designer_revisions,public.designer_documents,public.designer_evidence,public.designer_evidence_checks,public.designer_configs,public.designer_estimates,public.designer_estimate_files,public.designer_shares,public.designer_jobs,public.designer_outbox,public.designer_budget_months to service_role;
grant usage,select on sequence public.designer_configs_version_seq to service_role;

create function public.designer_immutable() returns trigger language plpgsql as $$ begin raise exception 'Issued snapshots and evidence are immutable'; end $$;
create trigger designer_revision_immutable before update or delete on public.designer_revisions for each row execute function public.designer_immutable();
create trigger designer_estimate_immutable before update or delete on public.designer_estimates for each row execute function public.designer_immutable();
create trigger designer_evidence_immutable before update or delete on public.designer_evidence for each row execute function public.designer_immutable();
create trigger designer_check_immutable before update or delete on public.designer_evidence_checks for each row execute function public.designer_immutable();
create function public.designer_config_immutable_body() returns trigger language plpgsql as $$
begin
  if new.config is distinct from old.config or new.id is distinct from old.id or new.version is distinct from old.version or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then raise exception 'Pricing configuration versions are immutable'; end if;
  return new;
end $$;
create trigger designer_config_version_immutable before update on public.designer_configs for each row execute function public.designer_config_immutable_body();

create function public.designer_set_staff(p_user uuid,p_email text,p_role text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_role not in ('owner','staff') then raise exception 'Invalid staff role'; end if;
  insert into designer_staff(user_id,email,role) values(p_user,lower(p_email),p_role)
    on conflict(user_id) do update set email=excluded.email,role=excluded.role;
end $$;
create function public.designer_accept_invitations(p_actor uuid,p_email text)
returns void language plpgsql security definer set search_path=public as $$
begin
  insert into designer_memberships(studio_id,user_id,role)
    select studio_id,p_actor,role from designer_invitations where email=lower(p_email) and expires_at>now()
    on conflict(studio_id,user_id) do update set role=excluded.role where designer_memberships.role<>'owner';
  delete from designer_invitations where email=lower(p_email) and expires_at>now();
end $$;
create function public.designer_remove_member(p_actor uuid,p_studio uuid,p_user uuid default null,p_email text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not designer_has_access(p_actor,p_studio,true,true) then raise exception 'Owner permission required'; end if;
  if p_user is not null then
    if exists(select 1 from designer_memberships where studio_id=p_studio and user_id=p_user and role='owner') then raise exception 'The studio owner cannot be removed'; end if;
    delete from designer_memberships where studio_id=p_studio and user_id=p_user;
  end if;
  if p_email is not null then delete from designer_invitations where studio_id=p_studio and email=lower(p_email); end if;
end $$;
create function public.designer_list_members(p_actor uuid,p_studio uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare members jsonb; invitations jsonb;
begin
  if not designer_has_access(p_actor,p_studio,true,true) then raise exception 'Owner permission required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('userId',m.user_id,'role',m.role,'createdAt',m.created_at,
    'email',case when u.email_confirmed_at is not null then u.email else null end,
    'name',case when u.email_confirmed_at is not null then left(coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name',''),120) else null end) order by m.created_at,m.user_id),'[]'::jsonb)
    into members from designer_memberships m join auth.users u on u.id=m.user_id where m.studio_id=p_studio;
  select coalesce(jsonb_agg(jsonb_build_object('email',email,'role',role,'expiresAt',expires_at) order by email),'[]'::jsonb)
    into invitations from designer_invitations where studio_id=p_studio;
  return jsonb_build_object('members',members,'invitations',invitations);
end $$;
create function public.designer_create_studio(p_actor uuid,p_name text)
returns public.designer_studios language plpgsql security definer set search_path=public as $$
declare v public.designer_studios;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,724));
  if (select count(*) from designer_memberships where user_id=p_actor and role='owner')>=5 then raise exception 'Studio limit reached'; end if;
  insert into designer_studios(name,created_by) values(p_name,p_actor) returning * into v;
  insert into designer_memberships(studio_id,user_id,role) values(v.id,p_actor,'owner');
  return v;
end $$;
create function public.designer_invite_member(p_actor uuid,p_studio uuid,p_email text,p_role text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not designer_has_access(p_actor,p_studio,true,true) then raise exception 'Owner permission required'; end if;
  if p_role not in ('editor','viewer') then raise exception 'Invalid membership role'; end if;
  insert into designer_invitations(studio_id,email,role,invited_by) values(p_studio,lower(p_email),p_role,p_actor)
    on conflict(studio_id,email) do update set role=excluded.role,expires_at=now()+interval '14 days',invited_by=p_actor;
end $$;
create function public.designer_save_project(p_actor uuid,p_studio uuid,p_id uuid,p_name text,p_draft jsonb,p_expected_revision integer)
returns public.designer_projects language plpgsql security definer set search_path=public as $$
declare v public.designer_projects;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_studio::text,725));
  if not designer_has_access(p_actor,p_studio,true,false) then raise exception 'Project unavailable'; end if;
  select * into v from designer_projects where id=p_id for update;
  if found then
    if v.studio_id<>p_studio then raise exception 'Project unavailable'; end if;
    if v.revision<>p_expected_revision then raise exception 'Revision conflict: reload the saved project'; end if;
    update designer_projects set name=p_name,draft=p_draft,revision=revision+1,updated_at=now() where id=p_id returning * into v;
  else
    if p_expected_revision<>0 then raise exception 'Revision conflict: project unavailable'; end if;
    if (select count(*) from designer_projects where studio_id=p_studio)>=100 then raise exception 'Project limit reached'; end if;
    insert into designer_projects(id,studio_id,name,draft,created_by) values(p_id,p_studio,p_name,p_draft,p_actor) returning * into v;
  end if;
  insert into designer_revisions(project_id,studio_id,number,draft,created_by) values(v.id,v.studio_id,v.revision,p_draft,p_actor);
  return v;
end $$;
create function public.designer_reserve_document(p_actor uuid,p_project uuid,p_id uuid,p_name text,p_mime text,p_bytes bigint,p_sha text,p_extension text,p_previous uuid default null)
returns public.designer_documents language plpgsql security definer set search_path=public as $$
declare v public.designer_documents; previous public.designer_documents; p public.designer_projects; s public.designer_settings; document_revision integer:=1;
begin
  select * into p from designer_projects where id=p_project for update;
  if not found or not designer_has_access(p_actor,p.studio_id,true,false) then raise exception 'Project unavailable'; end if;
  select * into s from designer_settings where id;
  if not s.uploads_enabled then raise exception 'Uploads are disabled'; end if;
  if p_bytes<1 or p_bytes>s.max_file_bytes then raise exception 'File size limit exceeded'; end if;
  if p_extension not in ('pdf','jpg','jpeg','png','webp','heic','heif','tif','tiff','docx','xlsx','pptx','doc','xls','ppt','dwg','dxf','csv','txt','ifc','rvt','mpp') then raise exception 'Unsupported file'; end if;
  if p_previous is not null then
    select * into previous from designer_documents where id=p_previous and project_id=p_project and studio_id=p.studio_id;
    if not found then raise exception 'Document unavailable'; end if;
    if exists(select 1 from designer_documents where supersedes_document_id=p_previous) then raise exception 'Document revision conflict'; end if;
    document_revision:=previous.revision+1;
  end if;
  if (select count(*) from designer_documents where project_id=p_project)>=s.max_project_documents then raise exception 'Document limit reached'; end if;
  if (select coalesce(sum(bytes),0) from designer_documents where project_id=p_project)+p_bytes>s.max_project_bytes then raise exception 'Project storage limit exceeded'; end if;
  insert into designer_documents(id,project_id,studio_id,revision,supersedes_document_id,file_name,declared_mime,bytes,sha256,storage_path,created_by)
  values(p_id,p_project,p.studio_id,document_revision,p_previous,p_name,p_mime,p_bytes,p_sha,p.studio_id::text||'/'||p_project::text||'/'||p_id::text||'/source.'||p_extension,p_actor) returning * into v;
  return v;
end $$;
create function public.designer_confirm_evidence(p_actor uuid,p_project uuid,p_evidence uuid,p_expected_revision integer)
returns public.designer_evidence_checks language plpgsql security definer set search_path=public as $$
declare p public.designer_projects; e public.designer_evidence; c public.designer_evidence_checks;
begin
  select * into p from designer_projects where id=p_project for update;
  if not found or not designer_has_access(p_actor,p.studio_id,true,false) then raise exception 'Project unavailable'; end if;
  if p.revision<>p_expected_revision then raise exception 'Revision conflict: reload the saved project'; end if;
  select * into e from designer_evidence where id=p_evidence and project_id=p.id and studio_id=p.studio_id;
  if not found then raise exception 'Evidence unavailable'; end if;
  if not exists(select 1 from designer_documents where id=e.document_id and verified and state in ('ready','review_required')) then raise exception 'Verified document required'; end if;
  insert into designer_evidence_checks(evidence_id,project_id,studio_id,project_revision,checked_by)
    values(e.id,p.id,p.studio_id,p.revision,p_actor) on conflict(evidence_id,project_revision) do nothing;
  select * into c from designer_evidence_checks where evidence_id=e.id and project_revision=p.revision;
  return c;
end $$;
create function public.designer_complete_upload(p_actor uuid,p_document uuid)
returns public.designer_jobs language plpgsql security definer set search_path=public as $$
declare d public.designer_documents; j public.designer_jobs;
begin
  select * into d from designer_documents where id=p_document for update;
  if not found or not designer_has_access(p_actor,d.studio_id,true,false) then raise exception 'Document unavailable'; end if;
  select * into j from designer_jobs where studio_id=d.studio_id and type='document.verify' and identity=d.id::text;
  if found then return j; end if;
  if d.state<>'reserved' or d.reservation_expires_at<now() then raise exception 'Upload reservation expired'; end if;
  insert into designer_jobs(studio_id,project_id,type,identity,input) values(d.studio_id,d.project_id,'document.verify',d.id::text,
    jsonb_build_object('documentId',d.id,'storagePath',d.storage_path,'bucket','designer-portal','declaredMime',d.declared_mime,'bytes',d.bytes,'sha256',d.sha256,'fileName',d.file_name)) returning * into j;
  update designer_documents set state='queued',updated_at=now() where id=d.id;
  insert into designer_outbox(studio_id,event_type,identity,payload) values(d.studio_id,'job.queued',j.id::text,jsonb_build_object('jobId',j.id));
  return j;
end $$;
create function public.designer_enqueue_extract(p_actor uuid,p_document uuid)
returns public.designer_jobs language plpgsql security definer set search_path=public as $$
declare d public.designer_documents; j public.designer_jobs;
begin
  select * into d from designer_documents where id=p_document for update;
  if not found or not designer_has_access(p_actor,d.studio_id,true,false) then raise exception 'Document unavailable'; end if;
  if not d.verified or d.state not in ('ready','review_required') then raise exception 'Verified document required'; end if;
  if d.actual_mime in ('application/acad','image/vnd.dwg','application/dwg','application/dxf','image/vnd.dxf') or d.file_name ~* '\.(dwg|dxf)$' then raise exception 'Native CAD requires manual review'; end if;
  insert into designer_jobs(studio_id,project_id,type,identity,input) values(d.studio_id,d.project_id,'document.extract',d.id::text,
    jsonb_build_object('documentId',d.id,'storagePath',d.storage_path,'bucket','designer-portal','mime',d.actual_mime,'bytes',d.bytes,'sha256',d.sha256,'fileName',d.file_name))
    on conflict(studio_id,type,identity) do update set identity=excluded.identity returning * into j;
  return j;
end $$;
create function public.designer_save_config(p_actor uuid,p_expected_version integer,p_config jsonb)
returns public.designer_configs language plpgsql security definer set search_path=public as $$
declare v public.designer_configs; n integer;
begin
  if not designer_is_staff(p_actor,true) then raise exception 'Owner administrator required'; end if;
  perform pg_advisory_xact_lock(72418002);
  select coalesce(max(version),0) into n from designer_configs;
  if n<>p_expected_version then raise exception 'Configuration conflict'; end if;
  update designer_configs set active=false where active;
  insert into designer_configs(config,created_by) values(p_config,p_actor) returning * into v;
  return v;
end $$;
create function public.designer_save_operations(p_actor uuid,p_uploads boolean,p_worker boolean,p_budget bigint,p_job_cost bigint)
returns public.designer_settings language plpgsql security definer set search_path=public as $$
declare s public.designer_settings;
begin
  if not designer_is_staff(p_actor,true) then raise exception 'Owner administrator required'; end if;
  if p_worker and (p_budget is null or p_job_cost is null) then raise exception 'Worker budget must be configured'; end if;
  update designer_settings set uploads_enabled=p_uploads,worker_enabled=p_worker,monthly_budget_pence=p_budget,worst_case_job_pence=p_job_cost where id returning * into s;
  return s;
end $$;
create function public.designer_issue_estimate(p_actor uuid,p_project uuid,p_expected_revision integer,p_estimate_id uuid,p_config_id uuid,p_snapshot jsonb,p_projection jsonb,p_idempotency text)
returns public.designer_estimates language plpgsql security definer set search_path=public as $$
declare p public.designer_projects; e public.designer_estimates; j public.designer_jobs; c public.designer_configs; path text; projection jsonb; manifest jsonb;
begin
  select * into p from designer_projects where id=p_project for update;
  if not found or not designer_has_access(p_actor,p.studio_id,true,false) then raise exception 'Project unavailable'; end if;
  select * into e from designer_estimates where studio_id=p.studio_id and idempotency_key=p_idempotency;
  if found then
    if e.project_id<>p_project or e.project_revision<>p_expected_revision then raise exception 'Idempotency key already used'; end if;
    return e;
  end if;
  if p.revision<>p_expected_revision then raise exception 'Revision conflict: reload the saved project'; end if;
  perform pg_advisory_xact_lock(72418002);
  select * into c from designer_configs where id=p_config_id and active;
  if not found or coalesce(c.config->>'version','')='' or p_snapshot->>'configVersion' is distinct from c.config->>'version' then raise exception 'Configuration conflict'; end if;
  if p_snapshot->>'status' is distinct from 'ready' or p_snapshot->>'projectId' is distinct from p.id::text or (p_snapshot->>'projectRevision')::integer is distinct from p.revision or p_snapshot->>'id' is distinct from p_estimate_id::text then raise exception 'Estimate requires review'; end if;
  -- Top-level public allowlist. Never expose the full private draft/contact,
  -- property value, config, rates, approvals or worker source document paths.
  projection:=jsonb_build_object('schemaVersion',p_projection->'schemaVersion','estimateId',to_jsonb(p_estimate_id),'projectName',p_projection->'projectName','projectAddress',p_projection->'projectAddress','createdAt',p_projection->'createdAt','validUntil',p_projection->'validUntil','status',p_projection->'status','currency',p_projection->'currency','lines',p_projection->'lines','subtotalPence',p_projection->'subtotalPence','vatPence',p_projection->'vatPence','totalPence',p_projection->'totalPence','vatStatus',p_projection->'vatStatus','vatRateBps',p_projection->'vatRateBps','reviewReasons',p_projection->'reviewReasons','assumptions',p_projection->'assumptions');
  -- One statement snapshot freezes the inventory/checks available at issue time.
  -- This is provenance, not a claim that every available source was used to
  -- calculate this estimate. No manifest is passed to the client share or PDF.
  select jsonb_build_object('schemaVersion',1,'recordedAt',now(),'scope','available-evidence-at-issue',
    'note','Recorded source inventory when issued; inclusion does not assert that a document was used or verified.',
    'documents',(select coalesce(jsonb_agg(jsonb_build_object('documentId',d.id,'revision',d.revision,'supersedesDocumentId',d.supersedes_document_id,
      'fileName',d.file_name,'sha256',d.sha256,'bytes',d.bytes,'mime',coalesce(d.actual_mime,d.declared_mime),'state',d.state,'verified',d.verified,
      'createdAt',d.created_at) order by d.created_at,d.id),'[]'::jsonb) from designer_documents d where d.project_id=p.id and d.studio_id=p.studio_id),
    'confirmedEvidence',(select coalesce(jsonb_agg(jsonb_build_object('checkId',k.id,'evidenceId',k.evidence_id,'documentId',v.document_id,
      'projectRevision',k.project_revision,'checkedBy',k.checked_by,'checkedAt',k.checked_at,'evidence',v.evidence) order by k.checked_at,k.id),'[]'::jsonb)
      from designer_evidence_checks k join designer_evidence v on v.id=k.evidence_id
      where k.project_id=p.id and k.studio_id=p.studio_id and k.project_revision=p.revision)) into manifest;
  insert into designer_estimates(id,project_id,studio_id,project_revision,config_id,snapshot,source_manifest,public_projection,idempotency_key,created_by)
    values(p_estimate_id,p.id,p.studio_id,p.revision,p_config_id,p_snapshot,manifest,projection,p_idempotency,p_actor) returning * into e;
  path:=p.studio_id::text||'/'||p.id::text||'/estimates/'||e.id::text||'.pdf';
  insert into designer_estimate_files(estimate_id,project_id,studio_id,storage_path) values(e.id,p.id,p.studio_id,path);
  insert into designer_jobs(studio_id,project_id,type,identity,input) values(p.studio_id,p.id,'estimate.pdf',e.id::text,
    jsonb_build_object('estimateId',e.id,'publicEstimate',projection,'storagePath',path,'bucket','designer-portal')) returning * into j;
  insert into designer_outbox(studio_id,event_type,identity,payload) values(p.studio_id,'estimate.issued',e.id::text,jsonb_build_object('estimateId',e.id,'jobId',j.id));
  return e;
end $$;
create function public.designer_create_share(p_actor uuid,p_estimate uuid,p_hash text,p_days integer)
returns public.designer_shares language plpgsql security definer set search_path=public as $$
declare e public.designer_estimates; s public.designer_shares;
begin
  select * into e from designer_estimates where id=p_estimate;
  if not found or not designer_has_access(p_actor,e.studio_id,true,false) then raise exception 'Estimate unavailable'; end if;
  if e.snapshot->>'status' is distinct from 'ready' or e.public_projection->>'status' is distinct from 'ready' then raise exception 'Estimate requires review'; end if;
  if p_days<1 or p_days>30 then raise exception 'Share duration must be 1 to 30 days'; end if;
  insert into designer_shares(estimate_id,project_id,studio_id,token_hash,expires_at,created_by)
    values(e.id,e.project_id,e.studio_id,p_hash,least(now()+make_interval(days=>p_days),(e.snapshot->>'validUntil')::timestamptz),p_actor) returning * into s;
  if s.expires_at<=now() then raise exception 'Estimate has expired'; end if;
  return s;
end $$;
create function public.designer_revoke_share(p_actor uuid,p_share uuid)
returns void language plpgsql security definer set search_path=public as $$
declare s public.designer_shares;
begin
  select * into s from designer_shares where id=p_share for update;
  if not found or not designer_has_access(p_actor,s.studio_id,true,false) then raise exception 'Share unavailable'; end if;
  update designer_shares set revoked_at=coalesce(revoked_at,now()) where id=p_share;
end $$;
create function public.designer_resolve_share(p_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.designer_shares; e public.designer_estimates; f public.designer_estimate_files;
begin
  select * into s from designer_shares where token_hash=p_hash and revoked_at is null and expires_at>now();
  if not found then return null; end if;
  select * into e from designer_estimates where id=s.estimate_id;
  if (e.snapshot->>'validUntil')::timestamptz<=now() then return null; end if;
  select * into f from designer_estimate_files where estimate_id=e.id and state='ready';
  return jsonb_build_object('estimate',e.public_projection,'pdfAvailable',f.estimate_id is not null);
end $$;

-- Durable worker API. Every completion is fenced by an unexpired lease token.
-- Timed-out work is recovered; max three attempts, and stale workers cannot
-- change a document or publish an estimate file.
create function public.designer_claim_job(p_types text[] default array['document.verify','document.extract','estimate.pdf'],p_lease_seconds integer default 120)
returns public.designer_jobs language plpgsql security definer set search_path=public as $$
declare j public.designer_jobs; s public.designer_settings; b public.designer_budget_months; m date; amount bigint;
begin
  select * into s from designer_settings where id;
  if not s.worker_enabled or s.monthly_budget_pence is null or s.worst_case_job_pence is null then return null; end if;
  if p_lease_seconds<30 or p_lease_seconds>900 then raise exception 'Lease must be 30 to 900 seconds'; end if;
  for j in select * from designer_jobs where state='running' and lease_until<=now() for update skip locked loop
    update designer_jobs set state=case when attempts<max_attempts then 'queued' else 'failed' end,lease_token=null,lease_until=null,error='Worker lease expired',updated_at=now() where id=j.id;
    if j.attempts>=j.max_attempts then
      if j.reserved_pence>0 then update designer_budget_months set reserved_pence=reserved_pence-j.reserved_pence,committed_pence=committed_pence+j.reserved_pence where month=j.budget_month; end if;
      if j.type='document.verify' then update designer_documents set state='failed',error='Verification worker timed out',updated_at=now() where id=(j.input->>'documentId')::uuid;
      elsif j.type='estimate.pdf' then update designer_estimate_files set state='failed',updated_at=now() where estimate_id=(j.input->>'estimateId')::uuid; end if;
    end if;
  end loop;
  select * into j from designer_jobs where state='queued' and type=any(p_types) and attempts<max_attempts and available_at<=now() order by created_at,id for update skip locked limit 1;
  if not found then return null; end if;
  if j.reserved_pence=0 then
    perform pg_advisory_xact_lock(72418003);
    m:=date_trunc('month',now() at time zone 'UTC')::date;
    amount:=s.worst_case_job_pence*j.max_attempts;
    insert into designer_budget_months(month) values(m) on conflict do nothing;
    select * into b from designer_budget_months where month=m for update;
    if b.reserved_pence+b.committed_pence+amount>s.monthly_budget_pence then return null; end if;
    update designer_budget_months set reserved_pence=reserved_pence+amount where month=m;
    update designer_jobs set reserved_pence=amount,budget_month=m where id=j.id;
  end if;
  update designer_jobs set state='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+make_interval(secs=>p_lease_seconds),updated_at=now() where id=j.id returning * into j;
  if j.type='document.verify' then update designer_documents set state='verifying',updated_at=now() where id=(j.input->>'documentId')::uuid; end if;
  return j;
end $$;
create function public.designer_finish_job(p_id uuid,p_token uuid,p_success boolean,p_output jsonb,p_error text default null,p_retryable boolean default false)
returns public.designer_jobs language plpgsql security definer set search_path=public as $$
declare j public.designer_jobs; d public.designer_documents; f public.designer_estimate_files; ev jsonb;
begin
  select * into j from designer_jobs where id=p_id for update;
  if not found or j.state<>'running' or j.lease_token is distinct from p_token or j.lease_until<=now() then raise exception 'Worker lease is no longer valid'; end if;
  if octet_length(coalesce(p_output,'{}'::jsonb)::text)>2000000 then raise exception 'Worker output too large'; end if;
  if p_success and j.type='document.verify' then
    select * into d from designer_documents where id=(j.input->>'documentId')::uuid for update;
    if not found or d.project_id<>j.project_id or d.studio_id<>j.studio_id then raise exception 'Document unavailable'; end if;
    if p_output->'verified' is distinct from 'true'::jsonb or p_output->>'sha256' is distinct from d.sha256 or (p_output->>'bytes')::bigint is distinct from d.bytes or coalesce(length(p_output->>'mime'),0)=0 then raise exception 'Invalid verification output'; end if;
    update designer_documents set verified=true,actual_mime=p_output->>'mime',review_required=coalesce((p_output->>'reviewRequired')::boolean,true),
      state=case when coalesce((p_output->>'reviewRequired')::boolean,true) then 'review_required' else 'ready' end,error=null,updated_at=now() where id=d.id;
  elsif p_success and j.type='document.extract' then
    select * into d from designer_documents where id=(j.input->>'documentId')::uuid and verified for update;
    if not found or d.project_id<>j.project_id or d.studio_id<>j.studio_id then raise exception 'Verified document required'; end if;
    if jsonb_typeof(p_output->'evidence') is distinct from 'array' or jsonb_array_length(p_output->'evidence')>2000 then raise exception 'Invalid evidence output'; end if;
    for ev in select value from jsonb_array_elements(p_output->'evidence') loop
      if coalesce(ev->>'kind','') not in ('text','dimension','product_reference') or jsonb_typeof(ev->'value') is distinct from 'string' or length(ev->>'value')>20000 or ev->'source'->>'documentId' is distinct from d.id::text then raise exception 'Invalid evidence provenance'; end if;
      insert into designer_evidence(document_id,project_id,studio_id,evidence) values(d.id,d.project_id,d.studio_id,ev||jsonb_build_object('confirmed',false));
    end loop;
  elsif p_success and j.type='estimate.pdf' then
    select * into f from designer_estimate_files where estimate_id=(j.input->>'estimateId')::uuid for update;
    if not found or f.project_id<>j.project_id or f.studio_id<>j.studio_id or p_output->>'storagePath' is distinct from regexp_replace(j.input->>'storagePath','\.pdf$','.'||j.lease_token::text||'.pdf') or p_output->>'mime' is distinct from 'application/pdf' or coalesce(p_output->>'sha256','') !~ '^[a-f0-9]{64}$' or coalesce((p_output->>'bytes')::bigint,0) not between 1 and 20971520 then raise exception 'Invalid PDF output'; end if;
    update designer_estimate_files set state='ready',storage_path=p_output->>'storagePath',bytes=(p_output->>'bytes')::bigint,sha256=p_output->>'sha256',updated_at=now() where estimate_id=f.estimate_id;
  end if;
  if not p_success and p_retryable and j.attempts<j.max_attempts then
    update designer_jobs set state='queued',lease_token=null,lease_until=null,available_at=now()+make_interval(secs=>j.attempts*10),error=left(coalesce(p_error,'Worker failed'),500),updated_at=now() where id=j.id returning * into j;
    if j.type='document.verify' then update designer_documents set state='queued',updated_at=now() where id=(j.input->>'documentId')::uuid; end if;
    return j;
  end if;
  update designer_jobs set state=case when p_success then 'succeeded' else 'failed' end,output=case when p_success then p_output else null end,error=case when p_success then null else left(coalesce(p_error,'Worker failed'),500) end,lease_token=null,lease_until=null,updated_at=now() where id=j.id returning * into j;
  if j.reserved_pence>0 then update designer_budget_months set reserved_pence=reserved_pence-j.reserved_pence,committed_pence=committed_pence+j.reserved_pence where month=j.budget_month; end if;
  if not p_success and j.type='document.verify' then update designer_documents set state=case when p_output->>'quarantined'='true' then 'quarantined' else 'failed' end,verified=false,error=left(coalesce(p_error,'Verification failed'),500),updated_at=now() where id=(j.input->>'documentId')::uuid;
  elsif not p_success and j.type='estimate.pdf' then update designer_estimate_files set state='failed',updated_at=now() where estimate_id=(j.input->>'estimateId')::uuid; end if;
  insert into designer_outbox(studio_id,event_type,identity,payload) values(j.studio_id,'job.'||j.state,j.id::text||':'||j.state,jsonb_build_object('jobId',j.id)) on conflict(identity) do nothing;
  return j;
end $$;

-- All RPCs above take actor IDs from the verified server, never from a browser.
-- Do not grant arbitrary-actor helpers to client roles.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'designer_%' loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
grant execute on function public.designer_my_studio(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('designer-portal','designer-portal',false,104857600,null)
on conflict(id) do update set public=false,file_size_limit=104857600;
-- Restrictive policy also fences this bucket if another feature has a broad
-- permissive Storage policy. Signed upload/download routes are service-issued.
create policy designer_private_bucket on storage.objects as restrictive for all to anon,authenticated
using(bucket_id<>'designer-portal') with check(bucket_id<>'designer-portal');
