import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { signOut } from '@/lib/auth/methods';
import { createClient } from '@/lib/supabase/server';
import { getTenantBySlug } from '@/lib/tenants/queries';
import { protocol, rootDomain } from '@/lib/utils';

async function signOutAction() {
  'use server';
  await signOut();
  redirect(`${protocol}://${rootDomain}/login`);
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;

  const user = await requireUser({
    next: `${protocol}://${subdomain}.${rootDomain}/`,
  });

  // Defense in depth — proxy.ts already gates this, but the layout enforces
  // it again at the page level so RLS can never be the only thing standing
  // between an authenticated non-member and a tenant page.
  const tenant = await getTenantBySlug(subdomain);
  if (!tenant) {
    redirect(`${protocol}://${rootDomain}/no-access`);
  }

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenant.id)
    .eq('user_id', user.id)
    .maybeSingle();
  const isAdmin = membership?.role === 'admin';

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="text-sm font-semibold tracking-tight text-gray-900">
            {tenant.name}
          </div>
          <nav className="flex items-center gap-5 text-sm text-gray-500">
            {isAdmin && (
              <Link href="/settings" className="hover:text-gray-700">
                Settings
              </Link>
            )}
            <Link
              href={`${protocol}://${rootDomain}/choose-tenant`}
              className="hover:text-gray-700"
            >
              Switch workspace
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="hover:text-gray-700">
                Log out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
