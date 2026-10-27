import { koKR } from '@clerk/localizations';
import { ClerkProvider, Show, UserButton } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Suspense } from 'react';
import { MainNav } from '@/components/main-nav';
import { Button } from '@/components/ui/button';
import { SignInToAct } from '@/components/sign-in-to-act';
import { TrawlerMark } from '@/components/trawler-mark';
import { clerkEnabled } from '@/lib/clerk-enabled';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'trawler · 공고 수집기',
  description: '원티드/사람인 채용 공고 수집 대시보드',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const bullBoard = (
    <Button asChild variant="link" size="sm" className="text-muted-foreground">
      <a
        href={`${process.env.NEXT_PUBLIC_BULL_BOARD_URL ?? 'http://localhost:3000/admin/queues'}`}
        target="_blank"
        rel="noreferrer"
      >
        Bull Board <ExternalLink data-icon="inline-end" />
      </a>
    </Button>
  );
  const shell = (
    <>
        <header className="border-b bg-card">
          {/* Wraps on phones: logo + nav on one line, the Bull Board link drops to the next. */}
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
            <Link href="/" className="flex items-center gap-1.5 font-semibold tracking-tight">
              <TrawlerMark className="size-5 text-teal-700 dark:text-teal-400" />
              trawler
            </Link>
            <MainNav />
            <div className="ml-auto flex items-center gap-2">
              {/* Bull Board is an operator tool: shown only to a signed-in user. Signed-out visitors get a
                  sign-in button here (the change buttons in the lists also open the same modal). */}
              {clerkEnabled ? (
                <Suspense>
                  <Show when="signed-in">
                    {bullBoard}
                    <UserButton />
                  </Show>
                  <Show when="signed-out">
                    <SignInToAct variant="outline" size="sm" title="로그인">
                      로그인
                    </SignInToAct>
                  </Show>
                </Suspense>
              ) : (
                bullBoard
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
      </body>
    </html>
  );
}
