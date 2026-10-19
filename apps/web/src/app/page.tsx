import { JobSource, SOURCE_LABEL, type Posting } from '@devilray/shared';
import { Eye, EyeOff, Star } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { markAllSeen, toggleSeen, toggleStar } from '@/lib/actions';
import { fmtDateTime, fmtDue } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Search = { source?: string; q?: string; unseen?: string; starred?: string; expired?: string; page?: string };

export default async function PostingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const filters = {
    source: JobSource.safeParse(sp.source).success ? sp.source : undefined,
    q: sp.q || undefined,
    unseen: sp.unseen === '1' ? 'true' : undefined,
    starred: sp.starred === '1' ? 'true' : undefined,
    status: sp.expired === '1' ? 'all' : undefined,
  };
  const page = Math.max(1, Number.parseInt(sp.page ?? '', 10) || 1);
  const [stats, list] = await Promise.all([
    api.stats(),
    api.postings({ ...filters, page: String(page), limit: '30' }),
  ]);

  // e.g. the last page emptied out after "읽음" under the 안 읽음만 filter
  if (list.items.length === 0 && page > list.pageCount) redirect(pageHref(sp, list.pageCount));

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">공고</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>
              활성 {stats.postings.active.toLocaleString()} / 전체 {stats.postings.total.toLocaleString()} · 안 읽음{' '}
              {stats.postings.unseen} · 별표 {stats.postings.starred}
            </span>
            {stats.postings.bySource.map((s) => (
              <Badge key={s.source} variant="outline">
                {SOURCE_LABEL[s.source]} {s.count}
              </Badge>
            ))}
            <span>마지막 수집 {fmtDateTime(stats.lastRunAt)}</span>
          </p>
        </div>
        {stats.postings.unseen > 0 && (
          <form action={markAllSeen}>
            <Button variant="outline" size="sm">
              모두 읽음 처리
            </Button>
          </form>
        )}
      </section>

      <form className="flex flex-wrap items-center gap-3 text-sm" method="get">
        <Input name="q" defaultValue={sp.q ?? ''} placeholder="제목/회사 검색" className="max-w-xs" />
        <Select name="source" defaultValue={filters.source ?? ''}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="전체 소스" />
          </SelectTrigger>
          <SelectContent>
            {JobSource.options.map((s) => (
              <SelectItem key={s} value={s}>
                {SOURCE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label className="gap-1.5">
          <Checkbox name="unseen" value="1" defaultChecked={sp.unseen === '1'} /> 안 읽음만
        </Label>
        <Label className="gap-1.5">
          <Checkbox name="starred" value="1" defaultChecked={sp.starred === '1'} /> 별표만
        </Label>
        <Label className="gap-1.5">
          <Checkbox name="expired" value="1" defaultChecked={sp.expired === '1'} /> 만료 포함
        </Label>
        <Button size="sm">적용</Button>
        {(sp.q || sp.source || sp.unseen || sp.starred || sp.expired) && (
          <Button asChild variant="link" size="sm" className="text-muted-foreground">
            <Link href="/">초기화</Link>
          </Button>
        )}
      </form>

      {list.items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>조건에 맞는 공고가 없습니다.</EmptyTitle>
            <EmptyDescription>필터를 바꾸거나 검색 프로필에서 수집을 실행해 보세요.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {list.items.map((p) => (
              <PostingRow key={p.id} p={p} />
            ))}
          </ul>
        </Card>
      )}

      {list.pageCount > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={pageHref(sp, page - 1)}
                text="이전"
                aria-disabled={page <= 1}
                className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
              />
            </PaginationItem>
            {pageNumbers(page, list.pageCount).map((n, i) =>
              n === null ? (
                <PaginationItem key={`gap-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={n}>
                  <PaginationLink href={pageHref(sp, n)} isActive={n === page}>
                    {n}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext
                href={pageHref(sp, page + 1)}
                text="다음"
                aria-disabled={page >= list.pageCount}
                className={page >= list.pageCount ? 'pointer-events-none opacity-50' : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

function PostingRow({ p }: { p: Posting }) {
  const due = fmtDue(p.dueDate);
  return (
    <li className={`flex items-start gap-3 px-4 py-3 ${p.seen ? 'opacity-70' : ''}`}>
      <form action={toggleStar}>
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="starred" value={String(p.starred)} />
        <Button
          variant="ghost"
          size="icon-sm"
          className={p.starred ? 'text-yellow-500 hover:text-yellow-500' : 'text-muted-foreground/50 hover:text-yellow-500'}
          title={p.starred ? '별표 해제' : '별표'}
        >
          <Star className={p.starred ? 'fill-current' : ''} />
        </Button>
      </form>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {!p.seen && <span className="size-2 shrink-0 rounded-full bg-primary" title="안 읽음" />}
          <a href={p.url} target="_blank" rel="noreferrer" className="truncate font-medium hover:underline">
            {p.title}
          </a>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Badge variant="secondary">{SOURCE_LABEL[p.source]}</Badge>
          <span className="text-foreground">{p.company}</span>
          {p.location && <span>{p.location}</span>}
          <span className={due.urgent ? 'font-medium text-destructive' : ''}>마감 {due.label}</span>
          <span>수집 {fmtDateTime(p.firstSeenAt)}</span>
          {p.status === 'EXPIRED' && <Badge variant="outline">만료</Badge>}
          {p.repostOfId !== null && (
            <Badge variant="outline" title={`#${p.repostOfId} 재게시로 판단, 알림 생략`}>
              재게시
            </Badge>
          )}
        </div>
      </div>
      <form action={toggleSeen}>
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="seen" value={String(p.seen)} />
        <Button variant="outline" size="xs">
          {p.seen ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
          {p.seen ? '안 읽음' : '읽음'}
        </Button>
      </form>
    </li>
  );
}

function pageHref(sp: Search, n: number): string {
  const qs = new URLSearchParams(
    Object.entries(sp).filter((e): e is [string, string] => !!e[1] && e[0] !== 'page'),
  );
  if (n > 1) qs.set('page', String(n));
  const s = qs.toString();
  return s ? `/?${s}` : '/';
}

/** 1 … 4 5 [6] 7 8 … 20 — first, last, and two on each side of the current page; null is a gap. */
function pageNumbers(page: number, pageCount: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let n = 1; n <= pageCount; n++) {
    if (n === 1 || n === pageCount || Math.abs(n - page) <= 2) out.push(n);
    else if (out[out.length - 1] !== null) out.push(null);
  }
  return out;
}
