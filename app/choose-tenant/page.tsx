import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { protocol, rootDomain } from '@/lib/utils';

export const metadata: Metadata = {
  title: `Choose workspace | ${rootDomain}`,
};

type TenantRow = {
  id: string;
  slug: string;
  name: string;
};

export default async function ChooseTenantPage() {
  await requireUser({
    next: `${protocol}://${rootDomain}/choose-tenant`,
  });

  const supabase = await createClient();
  // RLS scopes this to tenants the caller is a member of.
  const { data, error } = await supabase
    .from('tenants')
    .select('id, slug, name')
    .order('name', { ascending: true });

  const tenants: TenantRow[] = (data ?? []) as TenantRow[];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Pick a workspace
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {tenants.length === 0
              ? "You're not a member of any workspace yet."
              : `You're a member of ${tenants.length} workspace${tenants.length === 1 ? '' : 's'}.`}
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center">
            Failed to load workspaces: {error.message}
          </p>
        )}

        {tenants.length === 0 ? (
          <div className="rounded-lg bg-white p-6 text-center shadow-md">
            <p className="text-sm text-gray-600">
              Create one to get started.
            </p>
            <Link
              href={`${protocol}://${rootDomain}/signup`}
              className="mt-4 inline-block text-sm text-blue-600 hover:underline"
            >
              Create a new workspace →
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {tenants.map((t) => (
              <li key={t.id}>
                <a
                  href={`${protocol}://${t.slug}.${rootDomain}`}
                  className="block rounded-lg bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-gray-500">
                    {t.slug}.{rootDomain}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="text-center mt-6">
          <form action={async () => {
            'use server';
            const { signOut } = await import('@/lib/auth/methods');
            const { redirect } = await import('next/navigation');
            await signOut();
            redirect(`${protocol}://${rootDomain}/login`);
          }}>
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">
              Log out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
