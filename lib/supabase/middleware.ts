import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseCookieOptions } from './cookies';

/**
 * Supabase client for use inside Next.js 16 `proxy.ts` (formerly middleware).
 *
 * Returns BOTH the client and the response object so the caller can:
 *   1. read the current user via `supabase.auth.getUser()`
 *   2. return the `response` we built — its `Set-Cookie` headers carry any
 *      rotated session tokens.
 *
 * Per CLAUDE.md §3.2 we deliberately do not call `setSession` here; we let
 * `@supabase/ssr` write whatever the validation step rotated, then bail.
 */
export function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
      cookieOptions: supabaseCookieOptions,
    },
  );

  return { supabase, response };
}
