import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { clerkEnabled } from './clerk-enabled';
import { isOwner } from './owner';

export { clerkEnabled };

/** Whether to render real mutation forms (signed in, or Clerk not configured) or sign-in triggers. */
export async function viewer(): Promise<{ signedIn: boolean }> {
  if (!clerkEnabled) return { signedIn: true };
  const { userId } = await auth();
  return { signedIn: userId !== null };
}

/**
 * The real gate, called first thing in every mutating server action. Reading is public; only the
 * owner (OWNER_EMAILS) may change anything. Signed-out callers are sent to sign in and come back to
 * `returnTo`; signed-in non-owners get an error banner there.
 */
export async function requireOwner(returnTo: string): Promise<void> {
  if (!clerkEnabled) {
    if (process.env.NODE_ENV === 'production') {
      redirect(withError(returnTo, 'no-auth'));
    }
    return;
  }
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: returnTo });
  const user = await currentUser();
  const emails = (user?.emailAddresses ?? []).map((e) => e.emailAddress);
  if (!isOwner(emails, process.env.OWNER_EMAILS)) redirect(withError(returnTo, 'not-owner'));
}

/** `code` is one of the fixed codes in lib/flash.ts. */
function withError(path: string, code: string): string {
  const u = new URL(path, 'http://localhost');
  u.searchParams.set('error', code);
  return `${u.pathname}${u.search}`;
}
