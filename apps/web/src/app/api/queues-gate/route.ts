import { auth } from '@clerk/nextjs/server';
import { clerkEnabled, isAdmin } from '@/lib/auth';
import { GATE_COOKIE, GATE_COOKIE_PATH, GATE_TTL_MS, signGate } from '@/lib/queues-gate';

export const dynamic = 'force-dynamic';

const BULL_BOARD_URL = process.env.NEXT_PUBLIC_BULL_BOARD_URL ?? 'http://localhost:3000/admin/queues';

/** Relative Location: behind Caddy the request's own host is the internal one. */
function redirect(location: string, headers: Record<string, string> = {}): Response {
  return new Response(null, { status: 307, headers: { Location: location, 'Cache-Control': 'no-store', ...headers } });
}

/**
 * Entry to the job queue page ("작업 큐" in the nav). Checks the Clerk admin once, hands out the
 * signed pass Caddy checks on /admin/queues (lib/queues-gate.ts), and goes there.
 */
export async function GET(): Promise<Response> {
  if (!clerkEnabled) {
    // Locally there is no Caddy in front of Bull Board; in production nothing may open it without auth.
    return process.env.NODE_ENV === 'production' ? redirect('/?error=no-auth') : redirect(BULL_BOARD_URL);
  }
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: '/api/queues-gate' });
  if (!(await isAdmin())) return redirect('/?error=not-owner');

  const pass = signGate(Date.now());
  if (!pass) return redirect('/?error=no-auth');
  const cookie = [
    `${GATE_COOKIE}=${pass}`,
    `Path=${GATE_COOKIE_PATH}`,
    `Max-Age=${GATE_TTL_MS / 1000}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
  ].join('; ');
  return redirect(BULL_BOARD_URL, { 'Set-Cookie': cookie });
}
