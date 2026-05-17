import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { protocol, rootDomain } from '@/lib/utils';

/**
 * Validates a `next` URL against this app's apex + wildcard. Used to prevent
 * open-redirect attacks where a magic link is hand-crafted with
 * `?next=https://attacker.com`.
 */
function isSafeNext(rawNext: string): boolean {
  try {
    const url = new URL(rawNext);
    const root = rootDomain.split(':')[0];
    return url.hostname === root || url.hostname.endsWith(`.${root}`);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  const loginUrl = new URL(`${protocol}://${rootDomain}/login`);

  if (!code) {
    loginUrl.searchParams.set('error', 'missing_code');
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (next && isSafeNext(next)) {
      try {
        const nextUrl = new URL(next);
        if (nextUrl.pathname.startsWith('/invite/')) {
          return NextResponse.redirect(next);
        }
      } catch {}
    }
    if (next) loginUrl.searchParams.set('next', next);
    loginUrl.searchParams.set('error', 'exchange_failed');
    return NextResponse.redirect(loginUrl);
  }

  if (next && isSafeNext(next)) {
    return NextResponse.redirect(next);
  }

  return NextResponse.redirect(new URL(`${protocol}://${rootDomain}/choose-tenant`));
}
