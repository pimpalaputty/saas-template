-- 0003_triggers.sql
-- Behavioral triggers:
--   1. on_auth_user_created → auto-create a public.profiles row.
--   2. on_tenant_created    → make the creator the first admin.
-- Both are SECURITY DEFINER so they bypass RLS on the rows they insert.
-- Source of truth: SPECIFICATION.md §4.2 and §5.2.

-- ─────────────────────────────────────────────────────────────────────────────
-- handle_new_user: mirrors auth.users → public.profiles on signup.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- bootstrap_tenant_owner: every new tenant gets its creator inserted as
-- admin in the same transaction. Prevents the "orphan tenant" race where a
-- tenant exists but has zero admins.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.bootstrap_tenant_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.memberships (tenant_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end $$;

drop trigger if exists on_tenant_created on public.tenants;
create trigger on_tenant_created
  after insert on public.tenants
  for each row execute function public.bootstrap_tenant_owner();
