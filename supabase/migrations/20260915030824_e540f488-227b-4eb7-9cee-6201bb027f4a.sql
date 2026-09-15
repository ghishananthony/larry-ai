
-- 1. Remove blanket public read on institutions; expose only a safe directory view
drop policy if exists "Institution directory is publicly readable" on public.institutions;

create policy "Members read their own institution"
on public.institutions for select to authenticated
using (
  id = public.current_institution(auth.uid())
  or public.manages_institution(auth.uid(), id)
);

create or replace view public.institution_directory
with (security_invoker = off) as
  select id, slug, name, short_name, catalog_name
  from public.institutions
  where is_active;

revoke all on public.institution_directory from anon, authenticated;
grant select on public.institution_directory to anon, authenticated;

-- 2. Lock down anon: no direct table access anywhere except public pricing
revoke all on public.institutions from anon;
revoke all on public.institution_settings from anon;
revoke all on public.profiles from anon;
revoke all on public.user_roles from anon;
revoke all on public.resources from anon;
revoke all on public.usage_events from anon;
revoke all on public.admin_access_requests from anon;
revoke all on public.pricing_plans from anon;
grant select on public.pricing_plans to anon;

-- 3. Roles are never writable from the app
revoke insert, update, delete, truncate on public.user_roles from authenticated;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

-- 4. Institutions/pricing/settings are not student-writable
revoke insert, update, delete, truncate on public.institutions from authenticated;
grant select on public.institutions to authenticated;
revoke insert, delete, truncate on public.pricing_plans from authenticated;
revoke insert, delete, truncate on public.institution_settings from authenticated;
grant all on public.institutions, public.pricing_plans, public.institution_settings to service_role;

-- 5. Profiles: no self-insert (signup trigger owns creation); pin identity columns
drop policy if exists "Users insert own profile" on public.profiles;
revoke insert, delete, truncate on public.profiles from authenticated;
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

create or replace function public.guard_profile_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and not public.is_super_admin(auth.uid())
     and current_setting('public.allow_tenant_change', true) is distinct from 'on' then
    -- identity + tenancy columns are immutable for the account holder
    new.institution_id := old.institution_id;
    new.id := old.id;
    new.email := old.email;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

-- 6. Usage events: own user, own institution only
drop policy if exists "Students record their own usage" on public.usage_events;
create policy "Students record their own usage"
on public.usage_events for insert to authenticated
with check (
  user_id = auth.uid()
  and institution_id = public.current_institution(auth.uid())
);

drop policy if exists "Students read their own usage" on public.usage_events;
create policy "Students read their own usage"
on public.usage_events for select to authenticated
using (user_id = auth.uid());

revoke update, delete, truncate on public.usage_events from authenticated;
grant select, insert on public.usage_events to authenticated;
grant all on public.usage_events to service_role;

-- 7. Resources: read scoped to own institution (policy already correct); no anon, no student writes beyond managers
grant select, insert, update, delete on public.resources to authenticated;
grant all on public.resources to service_role;

-- 8. Admin access requests stay request-only for the requester
revoke update, delete, truncate on public.admin_access_requests from authenticated;
grant select, insert on public.admin_access_requests to authenticated;
grant all on public.admin_access_requests to service_role;

-- 9. Claim flow only works for an account with no institution yet
create or replace function public.claim_institution_access(_institution_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _email text;
  _confirmed timestamptz;
  _current uuid;
  _domain text;
  _domains text[];
begin
  if _uid is null then
    return jsonb_build_object('granted', false, 'reason', 'not_authenticated');
  end if;

  select institution_id into _current from public.profiles where id = _uid;
  if _current is not null then
    if _current = _institution_id then
      return jsonb_build_object('granted', true, 'institution_id', _current);
    end if;
    return jsonb_build_object('granted', false, 'reason', 'institution_locked');
  end if;

  select email, email_confirmed_at into _email, _confirmed from auth.users where id = _uid;
  if _confirmed is null then
    return jsonb_build_object('granted', false, 'reason', 'email_not_verified');
  end if;

  select email_domains into _domains from public.institutions where id = _institution_id and is_active;
  if _domains is null then
    return jsonb_build_object('granted', false, 'reason', 'unknown_institution');
  end if;

  _domain := lower(split_part(_email, '@', 2));
  if not (_domain = any (select lower(unnest(_domains)))) then
    return jsonb_build_object('granted', false, 'reason', 'domain_mismatch');
  end if;

  perform set_config('public.allow_tenant_change', 'on', true);
  update public.profiles set institution_id = _institution_id, updated_at = now() where id = _uid;
  perform set_config('public.allow_tenant_change', 'off', true);

  insert into public.user_roles (user_id, role, institution_id)
  values (_uid, 'student', _institution_id)
  on conflict (user_id, role, institution_id) do nothing;

  return jsonb_build_object('granted', true, 'institution_id', _institution_id);
end;
$$;

revoke execute on function public.claim_institution_access(uuid) from anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_tenant() from public, anon, authenticated;
