'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/rbac';
import { signInWithEmail } from '@/lib/auth/methods';
import { getTenantBySlug } from '@/lib/tenants/queries';
import { generateInviteToken } from '@/lib/invitations/tokens';
import { protocol, rootDomain } from '@/lib/utils';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ActionResult =
  | { status: 'idle' }
  | { status: 'success'; message?: string }
  | { status: 'error'; error: string };

async function loadTenant(subdomain: string) {
  const tenant = await getTenantBySlug(subdomain);
  if (!tenant) throw new Error('Workspace not found');
  await requireRole(tenant.id, 'admin');
  return tenant;
}

export async function inviteMemberAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const subdomain = String(formData.get('subdomain') ?? '');
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'member') as 'admin' | 'member';

  if (!email.includes('@')) return { status: 'error', error: 'Invalid email.' };
  if (role !== 'admin' && role !== 'member') {
    return { status: 'error', error: 'Invalid role.' };
  }

  try {
    const tenant = await loadTenant(subdomain);
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { status: 'error', error: 'Not authenticated.' };

    const { count: memberCount } = await supabase
      .from('memberships')
      .select('id, profiles!inner(email)', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .eq('profiles.email', email);

    if (memberCount && memberCount > 0) {
      return { status: 'error', error: 'User is already a member of this workspace.' };
    }

    const { count: inviteCount } = await supabase
      .from('invitations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .eq('email', email)
      .is('accepted_at', null);

    if (inviteCount && inviteCount > 0) {
      return { status: 'error', error: 'An invitation has already been sent to this email address.' };
    }

    const { raw, hash } = generateInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

    const { error } = await supabase.from('invitations').upsert(
      {
        tenant_id: tenant.id,
        email,
        role,
        invited_by: userData.user.id,
        token_hash: hash,
        expires_at: expiresAt,
        accepted_at: null,
      },
      { onConflict: 'tenant_id,email' },
    );

    if (error) return { status: 'error', error: error.message };

    // The invitee clicks the magic link → /auth/callback → next=/invite/<raw>.
    // Same flow whether they have an account yet or not.
    const inviteUrl = `${protocol}://${rootDomain}/invite/${raw}`;
    const sent = await signInWithEmail(email, inviteUrl);
    if (!sent.ok) {
      return { status: 'error', error: `Invite stored, but email failed: ${sent.error}` };
    }

    revalidatePath(`/s/${subdomain}/settings/members`);
    return { status: 'success', message: `Invitation sent to ${email}.` };
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : 'Failed.' };
  }
}

export async function cancelInvitationAction(formData: FormData): Promise<void> {
  const subdomain = String(formData.get('subdomain') ?? '');
  const invitationId = String(formData.get('invitation_id') ?? '');

  const tenant = await loadTenant(subdomain);
  const supabase = await createClient();
  await supabase.from('invitations').delete().eq('id', invitationId).eq('tenant_id', tenant.id);

  revalidatePath(`/s/${subdomain}/settings/members`);
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const subdomain = String(formData.get('subdomain') ?? '');
  const userId = String(formData.get('user_id') ?? '');

  const tenant = await loadTenant(subdomain);
  const supabase = await createClient();
  const { data: caller } = await supabase.auth.getUser();
  if (!caller.user) return;

  await enforceSoleAdminRule(tenant.id, userId);

  await supabase
    .from('memberships')
    .delete()
    .eq('tenant_id', tenant.id)
    .eq('user_id', userId);

  revalidatePath(`/s/${subdomain}/settings/members`);
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const subdomain = String(formData.get('subdomain') ?? '');
  const userId = String(formData.get('user_id') ?? '');
  const role = String(formData.get('role') ?? '') as 'admin' | 'member';
  if (role !== 'admin' && role !== 'member') return;

  const tenant = await loadTenant(subdomain);
  const supabase = await createClient();

  // Demoting an admin to member counts as "removing an admin" for the
  // sole-admin guard — same shape of risk.
  if (role === 'member') await enforceSoleAdminRule(tenant.id, userId);

  await supabase
    .from('memberships')
    .update({ role })
    .eq('tenant_id', tenant.id)
    .eq('user_id', userId);

  revalidatePath(`/s/${subdomain}/settings/members`);
}

/**
 * Throws if the action would leave the tenant with zero admins.
 * Per SPECIFICATION.md D3: a sole admin cannot be removed or demoted.
 */
async function enforceSoleAdminRule(tenantId: string, targetUserId: string) {
  const supabase = await createClient();
  const { data: admins } = await supabase
    .from('memberships')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'admin');

  const isTargetAdmin = admins?.some((a) => a.user_id === targetUserId) ?? false;
  if (isTargetAdmin && (admins?.length ?? 0) <= 1) {
    throw new Error('Cannot remove the sole admin of this workspace.');
  }
}
