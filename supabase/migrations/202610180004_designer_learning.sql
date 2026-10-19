-- Private historical scope evidence, current-price pilot comparisons and actual work.
-- None of these records updates a selling rate or is projected into client shares.
alter table public.designer_projects add column completed_on date;

create table public.designer_historical_scopes (
  id uuid primary key default gen_random_uuid(),
  external_ref text not null,
  source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
  body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=150000),
  imported_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(external_ref,source_sha256)
);
create table public.designer_actuals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  studio_id uuid not null,
  project_revision integer not null,
  estimate_id uuid references public.designer_estimates(id),
  supersedes_id uuid references public.designer_actuals(id),
  idempotency_key text not null check(length(idempotency_key) between 1 and 120),
  body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=150000),
  analysis jsonb not null check(jsonb_typeof(analysis)='object' and analysis->'rateChangesApplied'='false'),
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(project_id,studio_id) references public.designer_projects(id,studio_id),
  foreign key(project_id,project_revision) references public.designer_revisions(project_id,number),
  unique(project_id,idempotency_key)
);
create table public.designer_actual_reviews (
  id uuid primary key default gen_random_uuid(),
  actual_id uuid not null references public.designer_actuals(id),
  project_id uuid not null,
  studio_id uuid not null,
  decision text not null check(decision in ('reviewed','rate-card-review-needed')),
  note text not null check(length(note) between 1 and 4000),
  reviewed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(project_id,studio_id) references public.designer_projects(id,studio_id)
);
create table public.designer_pilot_comparisons (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  studio_id uuid not null,
  estimate_id uuid not null references public.designer_estimates(id),
  historical_scope_id uuid references public.designer_historical_scopes(id),
  body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<=150000),
  comparison jsonb not null check(jsonb_typeof(comparison)='object'),
  reviewed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(project_id,studio_id) references public.designer_projects(id,studio_id)
);
create index designer_actuals_project on public.designer_actuals(project_id,created_at desc);
create index designer_pilots_project on public.designer_pilot_comparisons(project_id,created_at desc);

alter table public.designer_historical_scopes enable row level security;
alter table public.designer_actuals enable row level security;
alter table public.designer_actual_reviews enable row level security;
alter table public.designer_pilot_comparisons enable row level security;
revoke all on public.designer_historical_scopes,public.designer_actuals,public.designer_actual_reviews,public.designer_pilot_comparisons from public,anon,authenticated;
grant all on public.designer_historical_scopes,public.designer_actuals,public.designer_actual_reviews,public.designer_pilot_comparisons to service_role;
create trigger designer_history_immutable before update or delete on public.designer_historical_scopes for each row execute function public.designer_immutable();
create trigger designer_actual_immutable before update or delete on public.designer_actuals for each row execute function public.designer_immutable();
create trigger designer_actual_review_immutable before update or delete on public.designer_actual_reviews for each row execute function public.designer_immutable();
create trigger designer_pilot_immutable before update or delete on public.designer_pilot_comparisons for each row execute function public.designer_immutable();

create function public.designer_reopen_changed_project() returns trigger language plpgsql as $$
begin
  if new.draft is distinct from old.draft then new.completed_on:=null; end if;
  return new;
end $$;
create trigger designer_project_scope_reopened before update of draft on public.designer_projects for each row execute function public.designer_reopen_changed_project();

create function public.designer_import_historical_scopes(p_actor uuid,p_entries jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb; h designer_historical_scopes; results jsonb:='[]';
begin
  if not designer_is_staff(p_actor,true) then raise exception 'Owner permission required'; end if;
  if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries) not between 1 and 50 then raise exception 'Historical import limit'; end if;
  for v in select value from jsonb_array_elements(p_entries) loop
    if not(v ?& array['externalRef','title','classification','source','scopeNotes','quantityBasis','amounts','warnings'])
      or v->>'classification' not in ('selling-quotation','worker-cost','unpriced-schedule','mixed-schedule')
      or jsonb_typeof(v->'source'->'locations')<>'array' or jsonb_array_length(v->'source'->'locations')=0
      or coalesce(v->'source'->>'sha256','') !~ '^[a-f0-9]{64}$' then raise exception 'Historical source provenance required'; end if;
    select * into h from designer_historical_scopes where external_ref=v->>'externalRef' and source_sha256=v->'source'->>'sha256' for update;
    if found then
      if h.body is distinct from v then raise exception 'Historical import conflict'; end if;
    else
      insert into designer_historical_scopes(external_ref,source_sha256,body,imported_by) values(v->>'externalRef',v->'source'->>'sha256',v,p_actor) returning * into h;
    end if;
    results:=results||jsonb_build_array(to_jsonb(h));
  end loop;
  return jsonb_build_object('records',results,'count',jsonb_array_length(results),'ratesImported',false);
end $$;

create function public.designer_record_actuals(p_actor uuid,p_project uuid,p_expected_revision integer,p_estimate uuid,p_supersedes uuid,p_key text,p_body jsonb,p_analysis jsonb)
returns public.designer_actuals language plpgsql security definer set search_path=public as $$
declare p designer_projects; e designer_estimates; a designer_actuals; latest designer_actuals; target_revision integer;
begin
  if not designer_is_staff(p_actor,false) then raise exception 'Business staff permission required'; end if;
  select * into p from designer_projects where id=p_project for update;
  if not found then raise exception 'Project unavailable'; end if;
  select * into a from designer_actuals where project_id=p.id and idempotency_key=p_key;
  if found then
    if a.body is distinct from p_body or a.estimate_id is distinct from p_estimate or a.supersedes_id is distinct from p_supersedes then raise exception 'Idempotency key already used'; end if;
    return a;
  end if;
  if p.revision<>p_expected_revision then raise exception 'Revision conflict'; end if;
  if p_estimate is not null then
    select * into e from designer_estimates where id=p_estimate and project_id=p.id and studio_id=p.studio_id;
    if not found then raise exception 'Estimate unavailable'; end if;
    target_revision:=e.project_revision;
  else target_revision:=p.revision; end if;
  select * into latest from designer_actuals where project_id=p.id order by created_at desc,id desc limit 1;
  if p_supersedes is distinct from latest.id then raise exception 'Actual record conflict'; end if;
  if jsonb_typeof(p_body->'labour')<>'array' or jsonb_array_length(p_body->'labour') not between 1 and 500
    or jsonb_typeof(p_body->'vehicles')<>'array' or jsonb_array_length(p_body->'vehicles')>1000
    or jsonb_typeof(p_body->'installationDates')<>'array' or jsonb_array_length(p_body->'installationDates') not between 1 and 730
    or (p_body->>'completedOn')::date>current_date or p_analysis->'rateChangesApplied' is distinct from 'false'::jsonb then raise exception 'Actual work requires review'; end if;
  insert into designer_actuals(project_id,studio_id,project_revision,estimate_id,supersedes_id,idempotency_key,body,analysis,recorded_by)
    values(p.id,p.studio_id,target_revision,p_estimate,p_supersedes,p_key,p_body,p_analysis,p_actor) returning * into a;
  if target_revision=p.revision then update designer_projects set completed_on=(p_body->>'completedOn')::date where id=p.id; end if;
  return a;
end $$;

create function public.designer_review_actuals(p_actor uuid,p_project uuid,p_actual uuid,p_decision text,p_note text)
returns public.designer_actual_reviews language plpgsql security definer set search_path=public as $$
declare a designer_actuals; r designer_actual_reviews;
begin
  if not designer_is_staff(p_actor,true) then raise exception 'Owner permission required'; end if;
  select * into a from designer_actuals where id=p_actual and project_id=p_project;
  if not found then raise exception 'Actual record unavailable'; end if;
  insert into designer_actual_reviews(actual_id,project_id,studio_id,decision,note,reviewed_by) values(a.id,a.project_id,a.studio_id,p_decision,p_note,p_actor) returning * into r;
  -- A review records a decision only; selling-price versions require designer_save_config.
  return r;
end $$;

create function public.designer_record_pilot(p_actor uuid,p_project uuid,p_estimate uuid,p_history uuid,p_body jsonb,p_comparison jsonb)
returns public.designer_pilot_comparisons language plpgsql security definer set search_path=public as $$
declare e designer_estimates; r designer_pilot_comparisons;
begin
  if not designer_is_staff(p_actor,true) then raise exception 'Owner permission required'; end if;
  select * into e from designer_estimates where id=p_estimate and project_id=p_project;
  if not found or e.snapshot->>'status'<>'ready' then raise exception 'Estimate unavailable'; end if;
  if p_history is not null and not exists(select 1 from designer_historical_scopes where id=p_history) then raise exception 'Historical scope unavailable'; end if;
  if p_body->'independentlyPrepared' is distinct from 'true'::jsonb or p_body->'scopeChecked' is distinct from 'true'::jsonb or p_body->>'priceBasis'<>'current-owner-prices' then raise exception 'Current owner comparison required'; end if;
  insert into designer_pilot_comparisons(project_id,studio_id,estimate_id,historical_scope_id,body,comparison,reviewed_by) values(e.project_id,e.studio_id,e.id,p_history,p_body,p_comparison,p_actor) returning * into r;
  return r;
end $$;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('designer_import_historical_scopes','designer_record_actuals','designer_review_actuals','designer_record_pilot','designer_reopen_changed_project') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
