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
    <div className="mx-auto max-w-[672px] px-4 py-12 font-sans">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Settings</h1>
        <Link
          href={`/settings/members`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Members →
        </Link>
      </div>

      <section className="rounded-[14px] border border-border bg-surface p-6 shadow-airbnb">
        <h2 className="mb-1 text-base font-semibold text-ink">General</h2>
        <p className="mb-4 text-sm text-muted">
          Subdomain: <code className="text-ink">{tenant.slug}.{rootDomain}</code>
        </p>
        <SettingsForm subdomain={tenant.slug} initialName={tenant.name} />
      </section>
    </div>
  );
}
