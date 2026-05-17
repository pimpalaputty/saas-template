import { createHash, randomBytes } from 'node:crypto';

/**
 * Cryptographic invitation token. The raw value is only ever transmitted via
 * email and via the /invite/[token] URL the recipient clicks. The DB stores
 * only the hash — so even a full DB compromise can't be turned into a
 * working invitation, and the hash makes look-ups O(1) via an index.
 */
export function generateInviteToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashInviteToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
