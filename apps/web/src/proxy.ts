import { clerkMiddleware } from '@clerk/nextjs/server';
import { type NextFetchEvent, type NextRequest, NextResponse } from 'next/server';
import { clerkEnabled } from '@/lib/clerk-enabled';

// Reads the Clerk session so `auth()` works in server components and actions. Every route stays
// public; mutations are gated inside the actions themselves (lib/auth.ts), never here — middleware-only
// protection has been bypassed before (CVE-2025-29927).
const clerk = clerkEnabled ? clerkMiddleware() : () => NextResponse.next();

// Caddy's forward_auth check for the job queue page only reads its own signed cookie. Left to Clerk, an
// expired session on a forwarded page load would answer with a handshake redirect to this URL.
const SKIP_CLERK = '/api/queues-gate/check';

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (req.nextUrl.pathname === SKIP_CLERK) return NextResponse.next();
  return clerk(req, event);
}

export const config = {
  matcher: [
    // Skip Next internals and static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
