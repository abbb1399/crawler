import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
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
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              devilray
            </Link>
            <nav className="flex gap-4 text-sm text-muted">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-foreground">
                  {n.label}
                </Link>
              ))}
            </nav>
            <a
              href={`${process.env.NEXT_PUBLIC_BULL_BOARD_URL ?? 'http://localhost:3000/admin/queues'}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-xs text-muted hover:text-foreground"
            >
              Bull Board ↗
            </a>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
