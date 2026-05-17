import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth/rbac';
import { getTenantBySlug } from '@/lib/tenants/queries';
import { rootDomain } from '@/lib/utils';
import { SettingsForm } from './settings-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<Metadata> {
  const { subdomain } = await params;
  return { title: `Settings | ${subdomain}.${rootDomain}` };
}

export default async function TenantSettingsPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const tenant = await getTenantBySlug(subdomain);
  if (!tenant) notFound();

  await requireRole(tenant.id, 'admin');

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <Link
          href={`/settings/members`}
          className="text-sm text-blue-600 hover:underline"
        >
          Members →
        </Link>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-base font-medium">General</h2>
        <p className="mb-4 text-sm text-gray-600">
          Subdomain: <code className="text-gray-900">{tenant.slug}.{rootDomain}</code>
        </p>
        <SettingsForm subdomain={tenant.slug} initialName={tenant.name} />
      </section>
    </div>
  );
}
