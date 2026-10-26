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
      redirect(withError(returnTo, '인증이 설정되지 않아 변경할 수 없습니다 (Clerk 키 없음)'));
    }
    return;
  }
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: returnTo });
  const user = await currentUser();
  const emails = (user?.emailAddresses ?? []).map((e) => e.emailAddress);
  if (!isOwner(emails, process.env.OWNER_EMAILS)) redirect(withError(returnTo, '소유자 계정만 변경할 수 있습니다'));
}

function withError(path: string, message: string): string {
  const u = new URL(path, 'http://localhost');
  u.searchParams.set('error', message);
  return `${u.pathname}${u.search}`;
}
