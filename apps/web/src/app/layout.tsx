import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'devilray · 공고 수집기',
  description: '원티드/사람인 채용 공고 수집 대시보드',
};

const NAV = [
  { href: '/', label: '공고' },
  { href: '/profiles', label: '검색 프로필' },
  { href: '/runs', label: '실행 이력' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b bg-card">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2">
            <Link href="/" className="font-semibold tracking-tight">
              devilray
            </Link>
            <nav className="flex gap-1">
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
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
