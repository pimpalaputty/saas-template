import Link from 'next/link';
import type { Metadata } from 'next';
import { rootDomain } from '@/lib/utils';
import { SignupForm } from './signup-form';

export const metadata: Metadata = {
  title: `Create a workspace | ${rootDomain}`,
};

type SearchParams = Promise<{ error?: string }>;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Create a workspace
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            One step to your own subdomain. We'll email you a magic link to
            finish.
          </p>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <SignupForm />
          {error && (
            <p className="mt-3 text-sm text-red-600">
              {decodeURIComponent(error)}
            </p>
          )}
        </div>

        <p className="text-center text-sm text-gray-500">
          Already have a workspace?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
