import type { NextRequest } from 'next/server';
import { GATE_COOKIE, verifyGate } from '@/lib/queues-gate';

export const dynamic = 'force-dynamic';

/**
 * Caddy's forward_auth target for /admin/queues* (deploy/Caddyfile). It receives the original request's
 * headers, so the pass cookie is here. 2xx lets the request through to Bull Board; anything else is
 * sent back to the browser as is. Kept out of the Clerk middleware (proxy.ts).
 */
export function GET(req: NextRequest): Response {
  if (verifyGate(req.cookies.get(GATE_COOKIE)?.value, Date.now())) {
    return new Response(null, { status: 204 });
  }
  // A page load goes through the entry route (sign in, admin check, fresh pass); Bull Board's own API
  // calls just fail.
  if (req.headers.get('sec-fetch-dest') === 'document') {
    return new Response(null, { status: 302, headers: { Location: '/api/queues-gate', 'Cache-Control': 'no-store' } });
  }
  return new Response('unauthorized', { status: 401 });
}
