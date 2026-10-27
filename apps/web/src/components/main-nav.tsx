'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '/', label: '공고' },
  { href: '/profiles', label: '검색 프로필' },
  { href: '/runs', label: '실행 이력' },
];

/** Client component only for usePathname; the root layout itself stays a server component. */
export function MainNav() {
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
            className="text-muted-foreground aria-[current=page]:bg-muted aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
          >
            <Link href={n.href} aria-current={active ? 'page' : undefined}>
              {n.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
