'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { signInWithEmail } from '@/lib/auth/methods';
import { validateSlug } from '@/lib/tenants/slug';
import { protocol, rootDomain } from '@/lib/utils';

export type SignupState =
  | { status: 'idle' }
  | { status: 'sent'; email: string }
  | { status: 'error'; error: string };

// Keep in sync with PENDING_SIGNUP_COOKIE in app/auth/finalize-signup/route.ts.
// (Server Action files cannot export non-async values, so we duplicate the
// literal rather than re-export it.)
const PENDING_SIGNUP_COOKIE = 'pending-signup';
const PENDING_TTL_SECONDS = 15 * 60;

type PendingSignupPayload = {
  email: string;
  name: string;
  slug: string;
  ts: number;
};

export async function startSignupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase();

  if (!email.includes('@')) {
    return { status: 'error', error: 'Please enter a valid email address.' };
  }
  if (!name || name.length > 60) {
    return { status: 'error', error: 'Workspace name is required (1–60 characters).' };
  }
  const slugErr = validateSlug(slug);
  if (slugErr) {
    return { status: 'error', error: slugErrorMessage(slugErr) };
  }

  const payload: PendingSignupPayload = { email, name, slug, ts: Date.now() };
  const cookieStore = await cookies();
  cookieStore.set(PENDING_SIGNUP_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PENDING_TTL_SECONDS,
  });

  // After magic-link auth, /auth/callback validates next against our apex
  // and redirects here — where /auth/finalize-signup reads the cookie and
  // inserts the tenant.
  const finalizeUrl = `${protocol}://${rootDomain}/auth/finalize-signup`;
  const result = await signInWithEmail(email, finalizeUrl);
  if (!result.ok) {
    return { status: 'error', error: result.error };
  }
  return { status: 'sent', email };
}

function slugErrorMessage(err: NonNullable<ReturnType<typeof validateSlug>>): string {
  switch (err) {
    case 'too_short':
      return 'Subdomain must be at least 3 characters.';
    case 'too_long':
      return 'Subdomain must be 32 characters or fewer.';
    case 'invalid_chars':
      return 'Lowercase letters, numbers, and hyphens only. No leading or trailing hyphen.';
    case 'reserved':
      return 'That subdomain is reserved. Please pick another.';
  }
}

/**
 * Slug-availability probe for the unauthenticated signup form.
 *
 * Uses the `public.is_slug_available()` SQL function — a `security definer`
 * wrapper that exposes only a single boolean. This is the only safe way to
 * answer "is this slug taken?" before the user has a session, because RLS on
 * `tenants` hides every row from the anon role. Never reach for the service-
 * role key here (CLAUDE.md §0).
 */
export async function checkSlugAvailableAction(slug: string): Promise<boolean> {
  if (!slug || validateSlug(slug)) return false;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('is_slug_available', {
    p_slug: slug.trim().toLowerCase(),
  });

  if (error) return false;
  return data === true;
}
