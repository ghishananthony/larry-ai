
drop view if exists public.institution_directory;

revoke all on public.institutions from anon, authenticated;
grant select (id, slug, name, short_name, catalog_name, is_active) on public.institutions to anon, authenticated;
grant all on public.institutions to service_role;

drop policy if exists "Active institutions are listable" on public.institutions;
create policy "Active institutions are listable"
on public.institutions for select to anon, authenticated
using (is_active);
