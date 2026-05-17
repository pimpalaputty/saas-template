import Link from 'next/link';
import type { Metadata } from 'next';
import { protocol, rootDomain } from '@/lib/utils';

export const metadata: Metadata = {
  title: `No access | ${rootDomain}`,
};

export default function NoAccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4 font-sans text-ink">
      <div className="w-full max-w-[448px] space-y-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          You don't have access
        </h1>
        <p className="text-sm text-muted">
          Either this workspace doesn't exist, or you're not a member yet. Ask
          an admin to invite you, or pick a workspace you belong to.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <Link
            href={`${protocol}://${rootDomain}/choose-tenant`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Choose a workspace
          </Link>
          <Link
            href={`${protocol}://${rootDomain}/`}
            className="text-sm font-medium text-muted hover:text-ink hover:underline"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
