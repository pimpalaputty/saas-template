import type { CookieOptions } from '@supabase/ssr';

/**
 * Cookie options shared by every Supabase client in this app.
 *
 * `domain` is set to a leading-dot apex (e.g. `.domain.com`, `.lvh.me`) so
 * the auth cookie is sent to the apex AND every `*.apex` subdomain — a
 * single login session works across the whole platform.
 *
 * Plain `localhost` and IP literals are exceptions: browsers refuse to set
 * `Domain=localhost`, and we have no real apex to anchor on. In that mode
 * the cookie is host-only and DOES NOT share across `*.localhost`
 * subdomains. Use a wildcard-resolvable domain like `lvh.me` for local dev
 * (NEXT_PUBLIC_ROOT_DOMAIN=lvh.me:3000) — it points at 127.0.0.1 via DNS
 * and behaves identically to production cookie-wise.
 *
 * `secure` is true only in production (HTTPS); secure cookies would never
 * be transmitted over http://lvh.me:3000 in dev.
 */
function apexCookieDomain(): string | undefined {
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
