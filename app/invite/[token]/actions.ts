'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hashInviteToken } from '@/lib/invitations/tokens';
import { protocol, rootDomain } from '@/lib/utils';

export type AcceptResult =
  | { status: 'idle' }
  | { status: 'error'; error: string };

export async function acceptInvitationAction(
  _prev: AcceptResult,
  formData: FormData,
): Promise<AcceptResult> {
  const rawToken = String(formData.get('token') ?? '');
  if (!rawToken) return { status: 'error', error: 'Missing invitation token.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('accept_invitation', {
    p_hash: hashInviteToken(rawToken),
  });

  if (error) {
    return { status: 'error', error: friendlyError(error.message) };
  }

  const tenantSlug = data as unknown as string;
  redirect(`${protocol}://${tenantSlug}.${rootDomain}/`);
}

function friendlyError(raw: string): string {
  if (raw.includes('not_authenticated')) return 'Please sign in first.';
  if (raw.includes('invalid_token')) return 'This invitation is invalid or has been revoked.';
  if (raw.includes('already_accepted')) return 'This invitation has already been used.';
  if (raw.includes('expired')) return 'This invitation has expired.';
  if (raw.includes('email_mismatch')) {
    return 'The invitation was sent to a different email than the one you are signed in with.';
  }
  return raw;
}
