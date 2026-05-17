import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from './session';
import { protocol, rootDomain } from '@/lib/utils';

export type TenantRole = 'admin' | 'member';

function deny(): never {
  redirect(`${protocol}://${rootDomain}/no-access`);
}

/**
 * Guards a tenant-scoped page or Server Action. On failure, redirects to
 * /no-access on the apex; in Server Action contexts the browser follows the
 * redirect, in Server Component contexts Next.js short-circuits rendering.
 *
 * The DB-layer enforcement is RLS in supabase/migrations/0002_rls.sql. This
 * helper is the application-level guard that runs BEFORE we touch the
 * database, so the user gets a clean redirect instead of an opaque RLS denial.
 */
export async function requireRole(tenantId: string, role?: TenantRole) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) deny();
  if (role && data.role !== role) deny();

  return { user, role: data.role as TenantRole };
}

export async function requireSuperadmin() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .maybeSingle();

  if (!data?.is_superadmin) deny();
  return user;
}
