import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { protocol, rootDomain } from '@/lib/utils';

export type SessionUser = {
  id: string;
  email: string;
};

/**
 * Returns the authenticated user, or `null` if the request is anonymous.
 * Calls `getUser()` (server-validated) — never trust `getSession()` for
 * authorization decisions because it only inspects the cookie.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !data.user.email) return null;
  return { id: data.user.id, email: data.user.email };
}

/**
 * Returns the authenticated user, or redirects to the centralized login
 * on the apex domain. Use at the top of any Server Component or Server
 * Action that requires authentication.
 */
export async function requireUser(opts?: { next?: string }): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user) return user;

  const nextParam = opts?.next ? `?next=${encodeURIComponent(opts.next)}` : '';
  redirect(`${protocol}://${rootDomain}/login${nextParam}`);
}
