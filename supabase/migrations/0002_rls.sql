-- 0002_rls.sql
-- Row Level Security: helper functions + policies on every tenant-scoped table.
-- Source of truth: SPECIFICATION.md §5.
--
-- Recursion note: helpers that query `memberships` / `profiles` are marked
-- SECURITY DEFINER so they bypass RLS on those tables when a policy on another
-- table calls them. Without this, a policy on `tenants` that calls
-- is_member_of() would re-enter `memberships` policies and deadlock.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid()
$$;

create or replace function public.is_member_of(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.memberships
     where tenant_id = p_tenant
       and user_id   = auth.uid()
  );
$$;

create or replace function public.is_admin_of(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.memberships
     where tenant_id = p_tenant
       and user_id   = auth.uid()
       and role      = 'admin'
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_superadmin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles    enable row level security;
alter table public.tenants     enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select
  using (id = auth.uid() or public.is_superadmin());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and is_superadmin = (
      select is_superadmin from public.profiles where id = auth.uid()
    )
    -- prevents self-elevation to superadmin
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- tenants
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "tenants_member_select" on public.tenants;
create policy "tenants_member_select" on public.tenants
  for select
  using (public.is_member_of(id) or public.is_superadmin());

drop policy if exists "tenants_authenticated_insert" on public.tenants;
create policy "tenants_authenticated_insert" on public.tenants
  for insert
  with check (auth.uid() is not null and created_by = auth.uid());

drop policy if exists "tenants_admin_update" on public.tenants;
create policy "tenants_admin_update" on public.tenants
  for update
  using (public.is_admin_of(id) or public.is_superadmin())
  with check (public.is_admin_of(id) or public.is_superadmin());

drop policy if exists "tenants_admin_delete" on public.tenants;
create policy "tenants_admin_delete" on public.tenants
  for delete
  using (public.is_admin_of(id) or public.is_superadmin());

-- ─────────────────────────────────────────────────────────────────────────────
-- memberships
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "memberships_member_select" on public.memberships;
create policy "memberships_member_select" on public.memberships
  for select
  using (public.is_member_of(tenant_id) or public.is_superadmin());

drop policy if exists "memberships_admin_write" on public.memberships;
create policy "memberships_admin_write" on public.memberships
  for all
  using (public.is_admin_of(tenant_id) or public.is_superadmin())
  with check (public.is_admin_of(tenant_id) or public.is_superadmin());

-- ─────────────────────────────────────────────────────────────────────────────
-- invitations
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "invitations_admin_all" on public.invitations;
create policy "invitations_admin_all" on public.invitations
  for all
  using (public.is_admin_of(tenant_id) or public.is_superadmin())
  with check (public.is_admin_of(tenant_id) or public.is_superadmin());
