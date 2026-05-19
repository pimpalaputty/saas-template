-- 0004_invitations.sql
-- Helpers an invitee needs to read and accept their invitation BEFORE they
-- are a member of the tenant.
--
-- The RLS policies on `invitations` are admin-only (0002_rls.sql), so an
-- invitee — who is not yet a member — cannot select their own row. These
-- security-definer functions provide a narrow read/write path that returns
-- only the data needed for the invitation flow. See CLAUDE.md §4.5.

-- ─────────────────────────────────────────────────────────────────────────────
-- get_invitation_by_hash: look up an invitation by its sha-256 token hash
-- and return only the fields the acceptance page needs.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_invitation_by_hash(p_hash text)
returns table (
  id           uuid,
  tenant_id    uuid,
  tenant_name  text,
  tenant_slug  text,
  email        text,
  role         public.tenant_role,
  expires_at   timestamptz,
  accepted_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.tenant_id, t.name, t.slug,
         i.email, i.role, i.expires_at, i.accepted_at
  from public.invitations i
  join public.tenants t on t.id = i.tenant_id
  where i.token_hash = p_hash
  limit 1
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- accept_invitation: validates token, expiration, email match, then inserts
-- the membership and marks the invitation accepted. Returns the tenant slug
-- so the application can redirect to the new workspace.
--
-- Raises typed exceptions on failure so the application can surface a
-- precise error message:
--   not_authenticated | invalid_token | already_accepted | expired |
--   email_mismatch
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.accept_invitation(p_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid := auth.uid();
  v_user_email text;
  v_inv        public.invitations%rowtype;
  v_tenant_slug text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select email into v_user_email from auth.users where id = v_user_id;

  select * into v_inv from public.invitations where token_hash = p_hash;
  if not found then
    raise exception 'invalid_token' using errcode = 'P0001';
  end if;

  if v_inv.accepted_at is not null then
    raise exception 'already_accepted' using errcode = 'P0001';
  end if;

  if v_inv.expires_at < now() then
    raise exception 'expired' using errcode = 'P0001';
  end if;

  if lower(v_inv.email) <> lower(coalesce(v_user_email, '')) then
    raise exception 'email_mismatch' using errcode = 'P0001';
  end if;

  insert into public.memberships (tenant_id, user_id, role)
  values (v_inv.tenant_id, v_user_id, v_inv.role)
  on conflict (tenant_id, user_id) do nothing;

  update public.invitations set accepted_at = now() where id = v_inv.id;

  select slug into v_tenant_slug from public.tenants where id = v_inv.tenant_id;
  return v_tenant_slug;
end $$;

-- Allow authenticated clients to call these functions.
grant execute on function public.get_invitation_by_hash(text) to authenticated, anon;
grant execute on function public.accept_invitation(text)      to authenticated;
