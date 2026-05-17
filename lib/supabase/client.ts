import { createBrowserClient } from '@supabase/ssr';
import { supabaseCookieOptions } from './cookies';

/**
 * Supabase client for Client Components running in the browser.
 *
 * Use sparingly — the default in this codebase is to fetch data from Server
 * Components and mutate via Server Actions. The browser client is only
 * needed for realtime subscriptions or for code that genuinely cannot run
 * on the server.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseCookieOptions,
    },
  );
}
