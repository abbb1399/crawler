import { koKR } from '@clerk/localizations';
import { ClerkProvider, Show, UserButton } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Suspense } from 'react';
import { MainNav, NavExternalLink } from '@/components/main-nav';
import { SignInToAct } from '@/components/sign-in-to-act';
import { TrawlerMark } from '@/components/trawler-mark';
import { Toaster } from '@/components/ui/sonner';
import { isAdmin } from '@/lib/auth';
import { clerkEnabled } from '@/lib/clerk-enabled';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'trawler · 공고 수집기',
  description: '원티드/사람인 채용 공고 수집 대시보드',
};

async function AdminOnly({ children }: { children: React.ReactNode }) {
  return (await isAdmin()) ? children : null;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Bull Board, through the admin check that issues its pass (app/api/queues-gate). Only the admin
  // sees it; without Clerk (local dev) it is always there.
  const queues = <NavExternalLink href="/api/queues-gate">작업 큐</NavExternalLink>;
  const shell = (
    <>
        <header className="border-b bg-card">
          {/* Wraps on phones: logo + nav on one line, the sign-in / account button drops to the next. */}
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
            <Link href="/" className="flex items-center gap-1.5 font-semibold tracking-tight">
              <TrawlerMark className="size-5 text-teal-700 dark:text-teal-400" />
              trawler
            </Link>
            <MainNav>
              {clerkEnabled ? (
                <Suspense>
                  <AdminOnly>{queues}</AdminOnly>
                </Suspense>
              ) : (
                queues
              )}
            </MainNav>
            <div className="ml-auto flex items-center gap-2">
              {/* Signed-out visitors get a sign-in button here, like the change buttons. */}
              {clerkEnabled && (
                <Suspense>
                  <Show when="signed-in">
                    <UserButton />
                  </Show>
                  <Show when="signed-out">
                    <SignInToAct variant="outline" size="sm" title="로그인">
                      로그인
                    </SignInToAct>
                  </Show>
                </Suspense>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          <NuqsAdapter>{children}</NuqsAdapter>
        </main>
    </>
  );
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col overflow-x-hidden">
        {clerkEnabled ? <ClerkProvider localization={koKR} appearance={{ theme: shadcn }}>{shell}</ClerkProvider> : shell}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
