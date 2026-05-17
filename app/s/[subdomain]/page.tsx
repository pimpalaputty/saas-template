import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenants/queries';
import { rootDomain } from '@/lib/utils';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<Metadata> {
  const { subdomain } = await params;
  const tenant = await getTenantBySlug(subdomain);
  return {
    title: tenant ? `${tenant.name} | ${rootDomain}` : rootDomain,
  };
}

export default async function TenantWelcomePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  // The layout already redirected non-members; this is a defensive fallback
  // for the case where middleware is bypassed mid-deploy.
  const tenant = await getTenantBySlug(subdomain);
  if (!tenant) notFound();

  return (
    <div className="mx-auto max-w-[672px] px-4 py-16 font-sans">
      <h1 className="text-3xl font-bold tracking-tight text-ink">
        Welcome to {tenant.name}
      </h1>
      <p className="mt-3 text-sm text-muted">
        Your workspace is ready. This is your blank canvas — start building.
      </p>
    </div>
  );
}
