import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getSessionUser } from '@/lib/auth/session';
import { rootDomain } from '@/lib/utils';

export default async function HomePage() {
  const user = await getSessionUser();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-canvas p-6 font-sans text-ink">
      {user && (
        <div className="absolute top-6 right-6">
          <Link
            href="/choose-tenant"
            className="text-sm font-semibold text-muted transition-colors hover:text-ink hover:underline underline-offset-4"
          >
            My workspaces
          </Link>
        </div>
      )}

      <div className="w-full max-w-[600px] space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tight text-ink">
            {rootDomain}
          </h1>
          <p className="text-lg text-muted">
            A multi-tenant SaaS starter — every team gets its own subdomain.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row pt-4">
          <Button asChild size="default">
            <Link href="/signup">Create a workspace</Link>
          </Button>
          <Button asChild variant="secondary" size="default">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
