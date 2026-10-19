-- Run only on the verified isolated staging project after all portal migrations.
-- Requires an empty designer workspace and a privileged SQL operator. It does
-- not call Auth/email, set passwords, approve rates or enqueue document work.
-- Transaction-local settings retain baseline counts across fixture rollback;
-- the final full rollback clears those settings too. There is no schema DDL.
-- If any statement fails, issue ROLLBACK before further work in that session.
begin;
set local statement_timeout = '10s';
set local lock_timeout = '2s';

do $$ declare s jsonb; begin
  s:=jsonb_build_object('user_a',gen_random_uuid(),'user_b',gen_random_uuid(),
    'studio_a',gen_random_uuid(),'studio_b',gen_random_uuid(),
    'project_a',gen_random_uuid(),'project_b',gen_random_uuid(),
    'users_before',(select count(*) from auth.users),
    'studios_before',(select count(*) from public.designer_studios),
    'memberships_before',(select count(*) from public.designer_memberships),
    'projects_before',(select count(*) from public.designer_projects));
  if (s->>'studios_before')::bigint<>0 or (s->>'memberships_before')::bigint<>0
    or (s->>'projects_before')::bigint<>0 then
    raise exception 'Smoke test requires an empty isolated designer workspace';
  end if;
  perform set_config('designer_smoke.state',s::text,true);
  perform set_config('designer_smoke.user_a',s->>'user_a',true);
  perform set_config('designer_smoke.user_b',s->>'user_b',true);
  perform set_config('designer_smoke.studio_a',s->>'studio_a',true);
  perform set_config('designer_smoke.studio_b',s->>'studio_b',true);
  perform set_config('designer_smoke.project_a',s->>'project_a',true);
  perform set_config('designer_smoke.project_b',s->>'project_b',true);
end $$;

savepoint designer_rls_fixtures;

do $$ declare s jsonb:=current_setting('designer_smoke.state')::jsonb; begin
  insert into auth.users(id,email,email_confirmed_at) values
    ((s->>'user_a')::uuid,'synthetic-rls-a-'||(s->>'user_a')||'@designer-staging.invalid',now()),
    ((s->>'user_b')::uuid,'synthetic-rls-b-'||(s->>'user_b')||'@designer-staging.invalid',now());
  insert into public.designer_studios(id,name,created_by) values
    ((s->>'studio_a')::uuid,'SYNTHETIC QA RLS A',(s->>'user_a')::uuid),
    ((s->>'studio_b')::uuid,'SYNTHETIC QA RLS B',(s->>'user_b')::uuid);
  insert into public.designer_memberships(studio_id,user_id,role) values
    ((s->>'studio_a')::uuid,(s->>'user_a')::uuid,'owner'),
    ((s->>'studio_b')::uuid,(s->>'user_b')::uuid,'owner');
  insert into public.designer_projects(id,studio_id,name,draft,created_by) values
    ((s->>'project_a')::uuid,(s->>'studio_a')::uuid,'SYNTHETIC QA RLS A','{}'::jsonb,(s->>'user_a')::uuid),
    ((s->>'project_b')::uuid,(s->>'studio_b')::uuid,'SYNTHETIC QA RLS B','{}'::jsonb,(s->>'user_b')::uuid);
  perform set_config('request.jwt.claim.sub',s->>'user_a',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',s->>'user_a','role','authenticated')::text,true);
end $$;

set local role authenticated;
do $$ begin
  if not designer_private.designer_my_studio(current_setting('designer_smoke.studio_a')::uuid)
    or designer_private.designer_my_studio(current_setting('designer_smoke.studio_b')::uuid) then
    raise exception 'Studio A helper allow/deny failed';
  end if;
  if (select count(*) from public.designer_studios)<>1
    or (select count(*) from public.designer_projects where id=current_setting('designer_smoke.project_a')::uuid)<>1
    or exists(select 1 from public.designer_projects where id=current_setting('designer_smoke.project_b')::uuid) then
    raise exception 'Studio A row isolation failed';
  end if;
end $$;

select set_config('request.jwt.claim.sub',current_setting('designer_smoke.user_b'),true),
  set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('designer_smoke.user_b'),'role','authenticated')::text,true);
do $$ begin
  if not designer_private.designer_my_studio(current_setting('designer_smoke.studio_b')::uuid)
    or designer_private.designer_my_studio(current_setting('designer_smoke.studio_a')::uuid) then
    raise exception 'Studio B helper allow/deny failed';
  end if;
  if (select count(*) from public.designer_studios)<>1
    or (select count(*) from public.designer_projects where id=current_setting('designer_smoke.project_b')::uuid)<>1
    or exists(select 1 from public.designer_projects where id=current_setting('designer_smoke.project_a')::uuid) then
    raise exception 'Studio B row isolation failed';
  end if;
end $$;
rollback to savepoint designer_rls_fixtures;

do $$ declare s jsonb:=current_setting('designer_smoke.state')::jsonb; begin
  if (s->>'users_before')::bigint<>(select count(*) from auth.users)
    or (s->>'studios_before')::bigint<>(select count(*) from public.designer_studios)
    or (s->>'memberships_before')::bigint<>(select count(*) from public.designer_memberships)
    or (s->>'projects_before')::bigint<>(select count(*) from public.designer_projects)
    or exists(select 1 from auth.users where id in ((s->>'user_a')::uuid,(s->>'user_b')::uuid)) then
    raise exception 'Synthetic RLS fixtures did not return to the clean baseline';
  end if;
end $$;
rollback;
select true as rls_own_and_cross_studio_passed, true as rollback_clean_baseline;
