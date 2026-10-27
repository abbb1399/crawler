import { afterEach, describe, expect, it, vi } from 'vitest';

/** next/navigation's redirect() throws to stop the action; the tests read where it pointed. */
class Redirect extends Error {}

type Setup = { clerk: boolean; userId?: string | null; emails?: string[]; owners?: string };

async function loadAuth({ clerk, userId = null, emails = [], owners = 'me@example.com' }: Setup) {
  vi.resetModules();
  vi.stubEnv('OWNER_EMAILS', owners);
  const redirectToSignIn = vi.fn(() => 'sign-in');
  vi.doMock('./clerk-enabled', () => ({ clerkEnabled: clerk }));
  vi.doMock('next/navigation', () => ({
    redirect: (to: string) => {
      throw new Redirect(to);
    },
  }));
  vi.doMock('@clerk/nextjs/server', () => ({
    auth: async () => ({ userId, redirectToSignIn }),
    currentUser: async () => ({ emailAddresses: emails.map((emailAddress) => ({ emailAddress })) }),
  }));
  return { ...(await import('./auth')), redirectToSignIn };
}

async function redirectedTo(p: Promise<unknown>): Promise<string> {
  const e = await p.then(() => null, (err: unknown) => err);
  if (!(e instanceof Redirect)) throw new Error('expected a redirect');
  return e.message;
}

describe('requireOwner', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('./clerk-enabled');
    vi.doUnmock('next/navigation');
    vi.doUnmock('@clerk/nextjs/server');
  });

  it('refuses every change in production when Clerk is not configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { requireOwner } = await loadAuth({ clerk: false });
    expect(await redirectedTo(requireOwner('/profiles'))).toBe('/profiles?error=no-auth');
  });

  it('lets changes through locally when Clerk is not configured', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { requireOwner } = await loadAuth({ clerk: false });
    await expect(requireOwner('/')).resolves.toBeUndefined();
  });

  it('sends a signed-out visitor to sign in and back', async () => {
    const { requireOwner, redirectToSignIn } = await loadAuth({ clerk: true, userId: null });
    await requireOwner('/profiles');
    expect(redirectToSignIn).toHaveBeenCalledWith({ returnBackUrl: '/profiles' });
  });

  it('refuses a signed-in account that is not an owner, keeping the query', async () => {
    const { requireOwner } = await loadAuth({ clerk: true, userId: 'u1', emails: ['stranger@example.com'] });
    expect(await redirectedTo(requireOwner('/?page=2'))).toBe('/?page=2&error=not-owner');
  });

  it('lets the owner through', async () => {
    const { requireOwner } = await loadAuth({ clerk: true, userId: 'u1', emails: ['Me@Example.com'] });
    await expect(requireOwner('/')).resolves.toBeUndefined();
  });
});
