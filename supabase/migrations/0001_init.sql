-- 0001_init.sql
-- Initial schema: enums, tables, indexes.
-- Source of truth: SPECIFICATION.md §4. Identifiers are lowercase per
-- supabase-postgres-best-practices/schema-lowercase-identifiers.

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.tenant_role as enum ('admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tenant_plan as enum ('free', 'pro', 'enterprise');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles — 1:1 with auth.users.
-- A row is created automatically by the on_auth_user_created trigger
-- (see 0003_triggers.sql).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  is_superadmin boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (lower(email));

-- ─────────────────────────────────────────────────────────────────────────────
-- tenants — one row per customer workspace, addressed by `slug` in the URL.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.tenants (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique
             check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$'),
  name       text not null check (char_length(name) between 1 and 60),
  plan       public.tenant_plan not null default 'free',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists tenants_created_by_idx on public.tenants (created_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- memberships — join table; carries the per-tenant role.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       public.tenant_role not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists memberships_tenant_id_idx on public.memberships (tenant_id);
create index if not exists memberships_user_id_idx   on public.memberships (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- invitations — pending tenant invitations. `token_hash` stores sha-256 of
-- the raw token; the raw token is only ever sent by email.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  email       text not null check (char_length(email) <= 254),
  role        public.tenant_role not null default 'member',
  invited_by  uuid not null references public.profiles(id),
  token_hash  text not null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (tenant_id, email)
);

create index if not exists invitations_tenant_id_idx on public.invitations (tenant_id);
create index if not exists invitations_email_idx     on public.invitations (lower(email));
create index if not exists invitations_token_idx     on public.invitations (token_hash);
