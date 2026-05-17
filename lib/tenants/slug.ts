import { isReservedSubdomain } from './reserved';

/**
 * SPECIFICATION.md §3.4 — slugs are lowercase, 3–32 chars, alphanumeric and
 * hyphens, no leading/trailing hyphen.
 */
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

export type SlugValidationError =
  | 'too_short'
  | 'too_long'
  | 'invalid_chars'
  | 'reserved';

export function validateSlug(slug: string): SlugValidationError | null {
  if (slug.length < 3) return 'too_short';
  if (slug.length > 32) return 'too_long';
  if (!SLUG_REGEX.test(slug)) return 'invalid_chars';
  if (isReservedSubdomain(slug)) return 'reserved';
  return null;
}

/**
 * Suggest a slug from a free-text tenant name. Used by the signup form
 * (client-side, on every `name` keystroke before the user has manually
 * edited the slug field) and by the server as a fallback.
 *
 * SPECIFICATION.md §9.1 documents the algorithm; keep them in sync.
 */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);

  if (base.length >= 3) return base;

  const suffix = Math.random().toString(16).slice(2, 8);
  return `tenant-${suffix}`;
}
