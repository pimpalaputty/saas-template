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
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4 text-ink font-sans">
      <div className="w-full max-w-[448px] space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Sign in to {rootDomain}
          </h1>
          <p className="mt-2 text-sm text-muted">
            We'll email you a magic link — no password needed.
          </p>
        </div>
        <div className="rounded-[14px] bg-surface p-6 shadow-airbnb border border-border">
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
