import { SOURCE_LABEL, type Posting } from '@trawler/shared';
import { Eye, EyeOff, Star } from 'lucide-react';
import { redirect } from 'next/navigation';
import type { SearchParams } from 'nuqs/server';
import { ActionForm } from '@/components/action-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { api } from '@/lib/api';
import { toggleHidden, toggleStar } from '@/lib/actions';
import { viewer } from '@/lib/auth';
import { errorText } from '@/lib/flash';
import { fmtDateTime, fmtDue } from '@/lib/format';
import { PostingsFilters } from './postings-filters';
import { loadPostingsSearchParams, serializePostingsSearchParams } from './postings-search-params';

export const dynamic = 'force-dynamic';

type Search = Awaited<ReturnType<typeof loadPostingsSearchParams>>;

export default async function PostingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await loadPostingsSearchParams(searchParams);
  const error = errorText(sp.error);
  const filters = {
    source: sp.source ?? undefined,
    q: sp.q || undefined,
    newToday: sp.newToday ? 'true' : undefined,
    hidden: sp.hidden ? 'true' : undefined,
    starred: sp.starred ? 'true' : undefined,
    status: sp.expired ? 'all' : undefined,
  };
  const page = Math.max(1, sp.page);
  const [stats, list, { signedIn }] = await Promise.all([
    api.stats(),
    api.postings({ ...filters, page: String(page), limit: '30' }),
    viewer(),
  ]);

  // e.g. the last page emptied out after hiding its last posting
  if (list.items.length === 0 && page > list.pageCount) redirect(pageHref(sp, list.pageCount));

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">공고</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>
              활성 {stats.postings.active.toLocaleString()} / 전체 {stats.postings.total.toLocaleString()} · 오늘 신규{' '}
              {stats.postings.newToday} · 숨김 {stats.postings.hidden} · 별표 {stats.postings.starred}
            </span>
            {stats.postings.bySource.map((s) => (
              <Badge key={s.source} variant="outline">
                {SOURCE_LABEL[s.source]} {s.count}
              </Badge>
            ))}
            <span>마지막 수집 {fmtDateTime(stats.lastRunAt)}</span>
          </p>
        </div>
      </section>

      <PostingsFilters />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
              <PostingRow key={p.id} p={p} signedIn={signedIn} />
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

function PostingRow({ p, signedIn }: { p: Posting; signedIn: boolean }) {
  const due = fmtDue(p.dueDate);
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <ActionForm
        signedIn={signedIn}
        action={toggleStar}
        fields={{ id: p.id, starred: p.starred }}
        variant="ghost"
        size="icon-sm"
        buttonClassName={p.starred ? 'text-yellow-500 hover:text-yellow-500' : 'text-muted-foreground/50 hover:text-yellow-500'}
        title={p.starred ? '별표 해제' : '별표'}
      >
        <Star className={p.starred ? 'fill-current' : ''} />
      </ActionForm>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {p.isNew && (
            <Badge className="px-1.5 py-0 text-[10px]" title="오늘 처음 수집된 공고">
              NEW
            </Badge>
          )}
          {/* Visited links dim via the browser's own history; :visited only allows colour changes. */}
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 truncate font-medium hover:underline visited:text-muted-foreground"
          >
            {p.title}
          </a>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Badge variant="secondary">{SOURCE_LABEL[p.source]}</Badge>
          <span className="max-w-full truncate text-foreground">{p.company}</span>
          {p.location && <span className="max-w-full truncate">{p.location}</span>}
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
      <ActionForm signedIn={signedIn} action={toggleHidden} fields={{ id: p.id, hidden: p.hidden }} variant="outline" size="xs">
        {p.hidden ? <Eye data-icon="inline-start" /> : <EyeOff data-icon="inline-start" />}
        {p.hidden ? '숨김 해제' : '숨김'}
      </ActionForm>
    </li>
  );
}

function pageHref(sp: Search, n: number): string {
  // Defaults (page 1, empty filters) are dropped from the URL by nuqs.
  return serializePostingsSearchParams('/', { ...sp, error: null, page: n });
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
