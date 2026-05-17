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
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4 text-ink font-sans">
      <div className="w-full max-w-[448px] space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Create a workspace
          </h1>
          <p className="mt-2 text-sm text-muted">
            One step to your own subdomain. We'll email you a magic link to
            finish.
          </p>
        </div>

        <div className="rounded-[14px] bg-surface p-6 shadow-airbnb border border-border">
          <SignupForm />
          {error && (
            <p className="mt-3 text-sm text-red-600">
              {decodeURIComponent(error)}
            </p>
          )}
        </div>

        <p className="text-center text-sm text-muted">
          Already have a workspace?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
