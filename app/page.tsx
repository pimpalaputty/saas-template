import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getSessionUser } from '@/lib/auth/session';
import { rootDomain } from '@/lib/utils';

export default async function HomePage() {
  const user = await getSessionUser();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      {user && (
        <div className="absolute top-4 right-4">
          <Link
            href="/choose-tenant"
            className="text-sm text-gray-500 transition-colors hover:text-gray-700"
          >
            My workspaces
          </Link>
        </div>
      )}

      <div className="w-full max-w-xl space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-5xl font-semibold tracking-tight text-gray-900">
            {rootDomain}
          </h1>
          <p className="text-lg text-gray-600">
            A multi-tenant SaaS starter — every team gets its own subdomain.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup">Create a workspace</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
