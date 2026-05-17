import { createClient } from '@/lib/supabase/server';
import { requireUser } from './session';

export type TenantRole = 'admin' | 'member';

/**
 * Throws if the current user is not a member of the tenant (with the given
 * role, when specified). The DB-layer enforcement is RLS in
 * supabase/migrations/0002_rls.sql — this helper is the application-level
 * guard that runs BEFORE we touch the database, so we can return a clean
 * 403 instead of an opaque RLS denial.
 */
export async function requireRole(tenantId: string, role?: TenantRole) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw new Error(`rbac: membership lookup failed: ${error.message}`);
  if (!data) throw new Error('rbac: forbidden — not a member of this tenant');
  if (role && data.role !== role) {
    throw new Error(`rbac: forbidden — requires role ${role}`);
  }

  return { user, role: data.role as TenantRole };
}

export async function requireSuperadmin() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw new Error(`rbac: superadmin lookup failed: ${error.message}`);
  if (!data?.is_superadmin) throw new Error('rbac: forbidden — superadmin only');
  return user;
}
