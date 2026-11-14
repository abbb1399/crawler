import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Pass for the job queue page (Bull Board at /admin/queues, served by the API behind Caddy).
 *
 * The admin is checked with Clerk once, on the way in (/api/queues-gate), and gets this signed cookie.
 * Caddy then checks only the cookie on every /admin/queues request (forward_auth → /api/queues-gate/check).
 * Checking the Clerk session there instead would break after a minute: its token lives 60s and is
 * refreshed by clerk-js, which Bull Board's page does not load.
 *
 * Value: `<expiry ms>.<HMAC-SHA256(expiry) hex>`. The key is derived from CLERK_SECRET_KEY, so there is
 * no extra secret to manage; rotating the Clerk key revokes every pass.
 */
export const GATE_COOKIE = 'trawler_queues';
export const GATE_COOKIE_PATH = '/admin/queues';
export const GATE_TTL_MS = 12 * 60 * 60 * 1000;

function key(secret: string): Buffer {
  return createHash('sha256').update(`queues-gate:${secret}`).digest();
}

function mac(expires: string, secret: string): string {
  return createHmac('sha256', key(secret)).update(expires).digest('hex');
}

/** A fresh pass, or null when there is no secret to sign with. */
export function signGate(now: number, secret = process.env.CLERK_SECRET_KEY): string | null {
  if (!secret) return null;
  const expires = String(now + GATE_TTL_MS);
  return `${expires}.${mac(expires, secret)}`;
}

export function verifyGate(value: string | undefined, now: number, secret = process.env.CLERK_SECRET_KEY): boolean {
  if (!secret || !value) return false;
  const match = /^(\d{1,16})\.([0-9a-f]{64})$/.exec(value);
  if (!match) return false;
  const [, expires, sig] = match;
  if (Number(expires) <= now) return false;
  return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(mac(expires, secret), 'hex'));
}
