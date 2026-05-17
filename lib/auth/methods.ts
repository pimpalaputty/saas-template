import { createClient } from '@/lib/supabase/server';
import { protocol, rootDomain } from '@/lib/utils';

/**
 * Auth method abstraction.
 *
 * v0.1 supports magic links only; the `signInWithProvider` stub is here so
 * that adding OAuth in v0.2 is a one-file change — flip the throw to a real
 * call against `supabase.auth.signInWithOAuth`.
 */

export type AuthMethodResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Sends a magic-link email to `email`. After the user clicks the link, they
 * land on `/auth/callback?next=<next>` on the apex domain.
 */
export async function signInWithEmail(
  email: string,
  next?: string,
): Promise<AuthMethodResult> {
  const supabase = await createClient();

  const callbackUrl = new URL(`${protocol}://${rootDomain}/auth/callback`);
  if (next) callbackUrl.searchParams.set('next', next);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Reserved for v0.2 — OAuth providers (Google, GitHub, ...).
 */
export async function signInWithProvider(
  _provider: 'google' | 'github',
): Promise<AuthMethodResult> {
  return { ok: false, error: 'oauth_not_enabled' };
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`auth: sign-out failed: ${error.message}`);
}
