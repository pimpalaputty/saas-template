import Link from 'next/link';
import type { Metadata } from 'next';
import { protocol, rootDomain } from '@/lib/utils';

export const metadata: Metadata = {
  title: `No access | ${rootDomain}`,
};

export default function NoAccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          You don't have access
        </h1>
        <p className="text-sm text-gray-600">
          Either this workspace doesn't exist, or you're not a member yet. Ask
          an admin to invite you, or pick a workspace you belong to.
        </p>
        <div className="flex justify-center gap-4 pt-2">
          <Link
            href={`${protocol}://${rootDomain}/choose-tenant`}
            className="text-sm text-blue-600 hover:underline"
          >
            Choose a workspace
          </Link>
          <Link
            href={`${protocol}://${rootDomain}/`}
            className="text-sm text-gray-500 hover:underline"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
