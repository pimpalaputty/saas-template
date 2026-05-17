import Link from 'next/link';
import type { Metadata } from 'next';
import { requireSuperadmin } from '@/lib/auth/rbac';
import { createClient } from '@/lib/supabase/server';
import { protocol, rootDomain } from '@/lib/utils';

export const metadata: Metadata = {
  title: `Admin | ${rootDomain}`,
};

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  created_at: string;
  member_count: number;
};

export default async function AdminPage() {
  await requireSuperadmin();
  const supabase = await createClient();

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, slug, name, plan, created_at, memberships(count)')
    .order('created_at', { ascending: false });

  const rows: TenantRow[] = (tenants ?? []).map((t) => ({
    id: t.id as string,
    slug: t.slug as string,
    name: t.name as string,
    plan: t.plan as TenantRow['plan'],
    created_at: t.created_at as string,
    member_count:
      (t.memberships as Array<{ count: number }> | null)?.[0]?.count ?? 0,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Workspaces</h1>
          <Link
            href={`${protocol}://${rootDomain}/`}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← {rootDomain}
          </Link>
        </header>

        {error && (
          <p className="text-sm text-red-600">Failed to load: {error.message}</p>
        )}

        {rows.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
            No workspaces yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Subdomain</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Members</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {t.name}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`${protocol}://${t.slug}.${rootDomain}`}
                        className="text-blue-600 hover:underline"
                      >
                        {t.slug}.{rootDomain}
                      </a>
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-600">
                      {t.plan}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {t.member_count}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
