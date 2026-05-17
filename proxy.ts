import { type NextRequest, NextResponse } from 'next/server';
import { protocol, rootDomain } from '@/lib/utils';
import { createMiddlewareClient } from '@/lib/supabase/middleware';

// Apex paths that are reachable without an authenticated session.
const PUBLIC_APEX_PATHS = new Set<string>([
  '/',
  '/login',
  '/signup',
  '/no-access',
]);

function isPublicApexPath(pathname: string): boolean {
  if (PUBLIC_APEX_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/auth/')) return true; // /auth/callback
  if (pathname.startsWith('/invite/')) return true; // /invite/[token]
  return false;
}

/**
 * Driven entirely by the `Host` header — `request.url` is normalized by
 * Next.js to the server's listen address (e.g. `http://localhost:3000`) and
 * therefore cannot be used to detect the public-facing subdomain.
 */
function extractSubdomain(request: NextRequest): string | null {
  const host = request.headers.get('host') ?? '';
  const hostname = host.split(':')[0];
  if (!hostname) return null;

  // Vercel preview deployment pattern: `tenant---branch.vercel.app`.
  if (hostname.endsWith('.vercel.app') && hostname.includes('---')) {
    return hostname.split('---')[0] || null;
  }

  const root = rootDomain.split(':')[0];
  if (hostname === root || hostname === `www.${root}`) return null;
  if (!hostname.endsWith(`.${root}`)) return null;

  const candidate = hostname.slice(0, -(root.length + 1));
  // Multi-level subdomains (`a.b.lvh.me`) are not valid tenants.
  if (!candidate || candidate.includes('.')) return null;
  return candidate;
}

/**
 * Reconstructs the public-facing URL of the request from the Host header.
 * Use this — not `request.url` — when building `?next=` parameters that
 * the browser will be redirected to.
 */
function publicRequestUrl(request: NextRequest): string {
  const host = request.headers.get('host') ?? rootDomain;
  const { pathname, search } = request.nextUrl;
  return `${protocol}://${host}${pathname}${search}`;
}

function loginRedirectUrl(originalUrl: string): URL {
  const url = new URL(`${protocol}://${rootDomain}/login`);
  url.searchParams.set('next', originalUrl);
  return url;
}

function copyCookies(target: NextResponse, source: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const subdomain = extractSubdomain(request);

  // Block direct access to internal tenant routes from the apex; they are
  // only legal as the target of an internal rewrite.
  if (!subdomain && pathname.startsWith('/s/')) {
    return new NextResponse(null, { status: 404 });
  }

  const { supabase, response } = createMiddlewareClient(request);
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  // ── Subdomain (tenant scope) ────────────────────────────────────────────
  if (subdomain) {
    if (!user) {
      return copyCookies(NextResponse.redirect(loginRedirectUrl(publicRequestUrl(request))), response);
    }

    // RLS filters this to tenants the caller is a member of. If we get a row,
    // membership is implicit; if not, the tenant either doesn't exist or the
    // caller isn't on it — both deserve the same "no access" response.
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', subdomain)
      .maybeSingle();

    if (!tenant) {
      return copyCookies(
        NextResponse.redirect(new URL(`${protocol}://${rootDomain}/no-access`)),
        response,
      );
    }

    // Block /admin (superadmin console) on subdomains; it only lives on apex.
    if (pathname.startsWith('/admin')) {
      return copyCookies(
        NextResponse.redirect(new URL(`${protocol}://${rootDomain}/admin`)),
        response,
      );
    }

    // Rewrite all subdomain paths to the tenant route group.
    const url = request.nextUrl.clone();
    url.pathname = `/s/${subdomain}${pathname === '/' ? '' : pathname}`;
    return copyCookies(NextResponse.rewrite(url), response);
  }

  // ── Apex domain ─────────────────────────────────────────────────────────
  if (isPublicApexPath(pathname)) {
    return response;
  }

  if (!user) {
    return copyCookies(NextResponse.redirect(loginRedirectUrl(publicRequestUrl(request))), response);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *   1. /api routes
     *   2. /_next internals
     *   3. files in /public (anything with an extension)
     */
    '/((?!api|_next|[\\w-]+\\.\\w+).*)',
  ],
};
