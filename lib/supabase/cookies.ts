import type { CookieOptions } from '@supabase/ssr';

/**
 * Cookie options shared by every Supabase client in this app.
 *
 * The `domain` is the critical bit: in production we set it to the apex
 * (`.domain.com` with the leading dot) so the auth cookie is sent to
 * `domain.com` AND every `*.domain.com` subdomain — a single login session
 * works across the whole platform.
 *
 * In development on `localhost` we leave `domain` undefined; browsers share
 * cookies across `*.localhost` automatically when no explicit domain is set.
 */
function apexCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined;

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!root) return undefined;

  const host = root.split(':')[0];
  if (host === 'localhost' || /^[0-9.]+$/.test(host)) return undefined;

  return host.startsWith('.') ? host : `.${host}`;
}

export const supabaseCookieOptions: CookieOptions = {
  domain: apexCookieDomain(),
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};
