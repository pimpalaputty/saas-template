'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/rbac';
import { getTenantBySlug } from '@/lib/tenants/queries';
import { protocol, rootDomain } from '@/lib/utils';

export type SettingsState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; error: string };

export async function updateTenantNameAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const subdomain = String(formData.get('subdomain') ?? '');
  const name = String(formData.get('name') ?? '').trim();

  if (!name || name.length > 60) {
    return { status: 'error', error: 'Name must be 1–60 characters.' };
  }

  const tenant = await getTenantBySlug(subdomain);
  if (!tenant) return { status: 'error', error: 'Workspace not found.' };
  await requireRole(tenant.id, 'admin');

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenants')
    .update({ name })
    .eq('id', tenant.id);

  if (error) return { status: 'error', error: error.message };

  revalidatePath(`/s/${subdomain}/settings`);
  revalidatePath(`/s/${subdomain}`);
  return { status: 'success' };
}

export async function deleteTenantAction(formData: FormData): Promise<void> {
  const subdomain = String(formData.get('subdomain') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  const tenant = await getTenantBySlug(subdomain);
  if (!tenant) return;
  await requireRole(tenant.id, 'admin');

  if (confirm !== tenant.slug) return;

  const supabase = await createClient();
  await supabase.from('tenants').delete().eq('id', tenant.id);

  redirect(`${protocol}://${rootDomain}/choose-tenant`);
}
