/**
 * Subdomains that are claimed by the platform and must not be assigned to
 * tenants. Enforced in (a) the registration Server Action and (b) the
 * Postgres `slug` CHECK constraint when a value here is requested.
 *
 * When adding a new apex-only route at `domain.com/<x>`, add `<x>` here too.
 */
export const RESERVED_SUBDOMAINS = new Set<string>([
  'www',
  'app',
  'admin',
  'api',
  'auth',
  'login',
  'logout',
  'signup',
  'invite',
  'mail',
  'email',
  'static',
  'cdn',
  'assets',
  'status',
  'docs',
  'help',
  'support',
  'blog',
  'vercel',
  '_next',
  'choose-tenant',
  'no-access',
]);

export function isReservedSubdomain(slug: string): boolean {
  return RESERVED_SUBDOMAINS.has(slug.toLowerCase());
}
