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
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4 text-ink font-sans">
      <div className="w-full max-w-[448px] space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Pick a workspace
          </h1>
          <p className="mt-2 text-sm text-muted">
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
          <div className="rounded-[14px] bg-surface p-6 text-center shadow-airbnb border border-border">
            <p className="text-sm text-muted">
              Create one to get started.
            </p>
            <Link
              href={`${protocol}://${rootDomain}/signup`}
              className="mt-4 inline-block text-sm text-primary hover:underline"
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
                  className="block rounded-[14px] bg-surface border border-border p-4 shadow-sm transition-shadow hover:shadow-airbnb"
                >
                  <div className="font-medium text-ink">{t.name}</div>
                  <div className="text-xs text-muted mt-1">
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
            <button type="submit" className="text-sm font-medium text-muted hover:text-ink transition-colors">
              Log out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
