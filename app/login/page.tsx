import type { Metadata } from 'next';
import { rootDomain } from '@/lib/utils';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: `Sign in | ${rootDomain}`,
};

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next, error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sign in to {rootDomain}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            We'll email you a magic link — no password needed.
          </p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-md">
          <LoginForm next={next} />
          {error && (
            <p className="mt-3 text-sm text-red-600">
              Sign-in failed: {error.replace(/_/g, ' ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
