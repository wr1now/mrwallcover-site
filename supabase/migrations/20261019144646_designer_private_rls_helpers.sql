-- Keep the RLS-only helper out of the Data API's exposed public schema.
-- ALTER SET SCHEMA and same-signature replacement retain its OID, owner and
-- policy dependencies; do not drop/recreate the helper or its nine policies.
create schema designer_private;
revoke all on schema designer_private from public, anon, authenticated;
grant usage on schema designer_private to authenticated, service_role;

alter function public.designer_my_studio(uuid) set schema designer_private;
create or replace function designer_private.designer_my_studio(p_studio uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.designer_has_access(auth.uid(), p_studio, false, false)
$$;
revoke all on function designer_private.designer_my_studio(uuid) from public, anon;
grant execute on function designer_private.designer_my_studio(uuid) to authenticated, service_role;

-- These trigger bodies use only NEW/OLD and built-in expressions. An empty
-- fixed path preserves their behaviour without inheriting a caller's path.
alter function public.designer_immutable() set search_path = '';
alter function public.designer_config_immutable_body() set search_path = '';
alter function public.designer_notification_payload_immutable() set search_path = '';
alter function public.designer_reopen_changed_project() set search_path = '';
