'use server';

import { signInWithEmail } from '@/lib/auth/methods';

export type LoginState =
  | { status: 'idle' }
  | { status: 'success'; email: string }
  | { status: 'error'; error: string };

export async function sendMagicLinkAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const nextRaw = String(formData.get('next') ?? '');
  const next = nextRaw.length > 0 ? nextRaw : undefined;

  if (!email || !email.includes('@')) {
    return { status: 'error', error: 'Please enter a valid email address.' };
  }

  const result = await signInWithEmail(email, next);
  if (!result.ok) {
    return { status: 'error', error: result.error };
  }
  return { status: 'success', email };
}
