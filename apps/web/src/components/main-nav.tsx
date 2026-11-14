'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '/', label: '공고' },
  { href: '/profiles', label: '검색 프로필' },
  { href: '/runs', label: '실행 이력' },
];

const NAV_ITEM_CLASS =
  'text-muted-foreground aria-[current=page]:bg-muted aria-[current=page]:font-semibold aria-[current=page]:text-foreground';

/**
 * Client component only for usePathname; the root layout itself stays a server component.
 * `children` go after the fixed items, so server-only checks (admin) can decide them.
 */
export function MainNav({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1">
      {NAV.map((n) => {
        // "/" only on itself; the others also cover their sub-pages (/profiles/new, /profiles/1/edit).
        const active = n.href === '/' ? pathname === '/' : pathname === n.href || pathname.startsWith(`${n.href}/`);
        return (
          <Button
            key={n.href}
            asChild
            variant="ghost"
            size="sm"
            className={NAV_ITEM_CLASS}
          >
            <Link href={n.href} aria-current={active ? 'page' : undefined}>
              {n.label}
            </Link>
          </Button>
        );
      })}
      {children}
    </nav>
  );
}

/** A nav item that leaves the dashboard (opens in a new tab), styled like the others. */
export function NavExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild variant="ghost" size="sm" className={NAV_ITEM_CLASS}>
      <a href={href} target="_blank" rel="noreferrer">
        {children} <ExternalLink data-icon="inline-end" />
      </a>
    </Button>
  );
}
