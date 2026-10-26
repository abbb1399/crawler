import { ClerkProvider, SignedIn, UserButton } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Button } from '@/components/ui/button';
import { TrawlerMark } from '@/components/trawler-mark';
import { clerkEnabled } from '@/lib/clerk-enabled';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'trawler · 공고 수집기',
  description: '원티드/사람인 채용 공고 수집 대시보드',
};

const NAV = [
  { href: '/', label: '공고' },
  { href: '/profiles', label: '검색 프로필' },
  { href: '/runs', label: '실행 이력' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const shell = (
    <>
        <header className="border-b bg-card">
          {/* Wraps on phones: logo + nav on one line, the Bull Board link drops to the next. */}
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
            <Link href="/" className="flex items-center gap-1.5 font-semibold tracking-tight">
              <TrawlerMark className="size-5 text-teal-700 dark:text-teal-400" />
              trawler
            </Link>
            <nav className="flex flex-wrap gap-1">
              {NAV.map((n) => (
                <Button key={n.href} asChild variant="ghost" size="sm" className="text-muted-foreground">
                  <Link href={n.href}>{n.label}</Link>
                </Button>
              ))}
            </nav>
            <Button asChild variant="link" size="sm" className="ml-auto text-muted-foreground">
              <a
                href={`${process.env.NEXT_PUBLIC_BULL_BOARD_URL ?? 'http://localhost:3000/admin/queues'}`}
                target="_blank"
                rel="noreferrer"
              >
                Bull Board <ExternalLink data-icon="inline-end" />
              </a>
            </Button>
            {/* Sign-in is only asked for when a change button is pressed; signed-in owners get the account menu here. */}
            {clerkEnabled && (
              <SignedIn>
                <UserButton />
              </SignedIn>
            )}
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
        {clerkEnabled ? <ClerkProvider>{shell}</ClerkProvider> : shell}
      </body>
    </html>
  );
}
