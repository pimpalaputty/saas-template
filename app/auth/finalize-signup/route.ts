import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { validateSlug } from '@/lib/tenants/slug';
import { protocol, rootDomain } from '@/lib/utils';

// Mirror of the constant in app/signup/actions.ts (see comment there).
const PENDING_SIGNUP_COOKIE = 'pending-signup';

type PendingSignupPayload = {
  email: string;
  name: string;
  slug: string;
  ts: number;
};

function apex(path: string, params?: Record<string, string>): string {
  const url = new URL(`${protocol}://${rootDomain}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  return url.toString();
}

export async function GET(_request: NextRequest) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PENDING_SIGNUP_COOKIE)?.value;

  // No pending signup → fall through to the regular chooser.
  if (!raw) {
    return NextResponse.redirect(apex('/choose-tenant'));
  }

  let payload: PendingSignupPayload;
  try {
    payload = JSON.parse(raw) as PendingSignupPayload;
  } catch {
    cookieStore.delete(PENDING_SIGNUP_COOKIE);
    return NextResponse.redirect(apex('/signup', { error: 'invalid_pending_signup' }));
  }

  // Re-validate slug — the cookie is signed only by httpOnly + secure, so
  // we still treat its contents as untrusted user input.
  if (validateSlug(payload.slug)) {
    cookieStore.delete(PENDING_SIGNUP_COOKIE);
    return NextResponse.redirect(apex('/signup', { error: 'invalid_slug' }));
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.redirect(apex('/login'));
  }

  if (user.email?.toLowerCase() !== payload.email.toLowerCase()) {
    cookieStore.delete(PENDING_SIGNUP_COOKIE);
    return NextResponse.redirect(
      apex('/signup', {
        error: 'The magic link was opened by a different email than the one you signed up with.',
      }),
    );
  }

  // The bootstrap_tenant_owner trigger (migrations/0003) inserts a
  // memberships row making the creator an admin in the same transaction.
  const { error } = await supabase.from('tenants').insert({
    slug: payload.slug,
    name: payload.name,
    created_by: user.id,
  });

  cookieStore.delete(PENDING_SIGNUP_COOKIE);

  if (error) {
    // Likely the slug was claimed between the form submit and the click;
    // also catches CHECK / unique-constraint violations.
    const msg =
      error.code === '23505'
        ? `The subdomain "${payload.slug}" is already taken.`
        : error.message;
    return NextResponse.redirect(apex('/signup', { error: msg }));
  }

  return NextResponse.redirect(`${protocol}://${payload.slug}.${rootDomain}/`);
}
