-- 0005_rls_performance.sql
-- Performance + security hardening pass per supabase-postgres-best-practices:
--   1. Wrap `auth.uid()` in `(select ...)` everywhere — 100×+ faster RLS on
--      large tables. Postgres can cache a scalar subquery for the whole
--      statement; a bare `auth.uid()` is re-evaluated per row.
--   2. Index the `invitations.invited_by` foreign key (was missing).
--   3. Partial index for the hot "pending invitations" query path.
--   4. Drop the redundant `memberships_tenant_id_idx` — the
--      `unique (tenant_id, user_id)` constraint already provides a composite
--      index whose leftmost prefix covers tenant-only lookups.
--   5. Drop the unused `current_user_id()` helper.
--   6. Add `public.is_slug_available()` so the signup form can check slug
--      availability without resorting to the service-role key.
--
-- See CLAUDE.md §4 for the multi-tenancy + RLS rules.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Helper functions — wrap auth.uid() in (select ...)
-- ─────────────────────────────────────────────────────────────────────────────
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
       and user_id   = (select auth.uid())
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
       and user_id   = (select auth.uid())
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
    (select is_superadmin from public.profiles where id = (select auth.uid())),
    false
  );
$$;

-- Dead code — never referenced anywhere.
drop function if exists public.current_user_id();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Public slug-availability check.
-- Signup runs *before* the user authenticates, so the anon role needs a way
-- to ask "is this slug taken?" without reading the tenants table directly
-- (RLS hides it from anon). This function exposes a single boolean and
-- nothing else — safe to grant to anon.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.tenants where slug = p_slug
  );
$$;

grant execute on function public.is_slug_available(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Policies that reference auth.uid() directly — rewrap them.
-- Helper-function policies (is_member_of, is_admin_of, is_superadmin) already
-- benefit from step 1; they don't need re-creation.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select
  using (id = (select auth.uid()) or public.is_superadmin());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and is_superadmin = (
      select is_superadmin from public.profiles where id = (select auth.uid())
    )
    -- prevents self-elevation to superadmin
  );

drop policy if exists "tenants_authenticated_insert" on public.tenants;
create policy "tenants_authenticated_insert" on public.tenants
  for insert
  with check (
    (select auth.uid()) is not null
    and created_by = (select auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Index hygiene.
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. Index the missing FK — without this, a profile delete cascades through
-- a sequential scan of invitations.
create index if not exists invitations_invited_by_idx
  on public.invitations (invited_by);

-- 4b. The "list pending invitations for a tenant" query hits this table on
-- every Members page render. A partial index on the live subset keeps the
-- index small and cache-hot.
create index if not exists invitations_pending_idx
  on public.invitations (tenant_id, created_at desc)
  where accepted_at is null;

-- 4c. Redundant with `unique (tenant_id, user_id)` per the leftmost-prefix
-- rule. Removing it speeds up writes (one fewer index to maintain).
drop index if exists public.memberships_tenant_id_idx;
