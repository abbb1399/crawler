import { JobSource, SOURCE_LABEL, type Posting } from '@devilray/shared';
import Link from 'next/link';
import { api } from '@/lib/api';
import { markAllSeen, toggleSeen, toggleStar } from '@/lib/actions';
import { fmtDateTime, fmtDue } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Search = { source?: string; q?: string; unseen?: string; starred?: string; cursor?: string };

export default async function PostingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const filters = {
    source: JobSource.safeParse(sp.source).success ? sp.source : undefined,
    q: sp.q || undefined,
    unseen: sp.unseen === '1' ? 'true' : undefined,
    starred: sp.starred === '1' ? 'true' : undefined,
  };
  const [stats, list] = await Promise.all([
    api.stats(),
    api.postings({ ...filters, cursor: sp.cursor, limit: '30' }),
  ]);

  const nextHref = list.nextCursor
    ? `/?${new URLSearchParams({ ...stripUndef(sp), cursor: String(list.nextCursor) })}`
    : null;

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">공고</h1>
          <p className="mt-1 text-sm text-muted">
            전체 {stats.postings.total.toLocaleString()} · 안 읽음 {stats.postings.unseen} · 별표{' '}
            {stats.postings.starred}
            {stats.postings.bySource.map((s) => (
              <span key={s.source} className="chip ml-2">
                {SOURCE_LABEL[s.source]} {s.count}
              </span>
            ))}
            <span className="ml-3">마지막 수집 {fmtDateTime(stats.lastRunAt)}</span>
          </p>
        </div>
        {stats.postings.unseen > 0 && (
          <form action={markAllSeen}>
            <button className="btn">모두 읽음 처리</button>
          </form>
        )}
      </section>

      <form className="flex flex-wrap items-center gap-2 text-sm" method="get">
        <input name="q" defaultValue={sp.q ?? ''} placeholder="제목/회사 검색" className="input max-w-xs" />
        <select name="source" defaultValue={filters.source ?? ''} className="input w-auto">
          <option value="">전체 소스</option>
          {JobSource.options.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABEL[s]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="unseen" value="1" defaultChecked={sp.unseen === '1'} /> 안 읽음만
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="starred" value="1" defaultChecked={sp.starred === '1'} /> 별표만
        </label>
        <button className="btn btn-primary">적용</button>
        {(sp.q || sp.source || sp.unseen || sp.starred) && (
          <Link href="/" className="text-muted hover:text-foreground">
            초기화
          </Link>
        )}
      </form>

      {list.items.length === 0 ? (
        <p className="py-16 text-center text-muted">조건에 맞는 공고가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {list.items.map((p) => (
            <PostingRow key={p.id} p={p} />
          ))}
        </ul>
      )}

      {nextHref && (
        <div className="text-center">
          <Link href={nextHref} className="btn">
            더 보기
          </Link>
        </div>
      )}
    </div>
  );
}

function PostingRow({ p }: { p: Posting }) {
  const due = fmtDue(p.dueDate);
  return (
    <li className={`flex items-start gap-3 px-4 py-3 ${p.seen ? 'opacity-70' : ''}`}>
      <form action={toggleStar} className="pt-0.5">
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="starred" value={String(p.starred)} />
        <button
          className={`text-lg leading-none ${p.starred ? 'text-yellow-500' : 'text-border hover:text-yellow-500'}`}
          title={p.starred ? '별표 해제' : '별표'}
        >
          ★
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {!p.seen && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" title="안 읽음" />}
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="truncate font-medium hover:text-accent hover:underline"
          >
            {p.title}
          </a>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="chip">{SOURCE_LABEL[p.source]}</span>
          <span className="text-foreground">{p.company}</span>
          {p.location && <span>{p.location}</span>}
          <span className={due.urgent ? 'font-medium text-red-500' : ''}>마감 {due.label}</span>
          <span>수집 {fmtDateTime(p.firstSeenAt)}</span>
          {p.status === 'EXPIRED' && <span className="chip">만료</span>}
        </div>
      </div>
      <form action={toggleSeen}>
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="seen" value={String(p.seen)} />
        <button className="btn px-2 py-1 text-xs">{p.seen ? '안 읽음' : '읽음'}</button>
      </form>
    </li>
  );
}

function stripUndef(o: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(o).filter(([k, v]) => v && k !== 'cursor')) as Record<string, string>;
}
