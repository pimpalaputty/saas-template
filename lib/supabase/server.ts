import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseCookieOptions } from './cookies';

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Reads cookies via Next.js's async `cookies()` API and writes them back
 * when Supabase rotates the session.
 *
 * The `setAll` call is wrapped in a try/catch because Server Components are
 * not allowed to mutate cookies — only Server Actions and Route Handlers are.
 * When called from a Server Component, the write silently no-ops; the next
 * Server Action or Route Handler invocation will persist the rotated token.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — see JSDoc above.
          }
        },
      },
      cookieOptions: supabaseCookieOptions,
    },
  );
}
