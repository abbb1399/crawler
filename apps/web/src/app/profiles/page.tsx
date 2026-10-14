import { SOURCE_LABEL } from '@devilray/shared';
import Link from 'next/link';
import { api } from '@/lib/api';
import { crawlNow, deleteProfile, toggleProfileEnabled } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ queued?: string }>;
}) {
  const [{ queued }, profiles] = await Promise.all([searchParams, api.profiles()]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">검색 프로필</h1>
          <p className="mt-1 text-sm text-muted">
            키워드로 사이트를 검색하고, 제목 필터로 걸러서 저장합니다. 활성 프로필만 크론이 돕니다.
          </p>
        </div>
        <Link href="/profiles/new" className="btn btn-primary">
          + 새 프로필
        </Link>
      </div>

      {queued && (
        <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          크롤 잡 {queued}개를 큐에 넣었습니다. 결과는 <Link href="/runs" className="underline">실행 이력</Link>에서.
        </p>
      )}

      {profiles.length === 0 ? (
        <p className="py-16 text-center text-muted">프로필이 없습니다.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {profiles.map((p) => (
            <li key={p.id} className={`rounded-lg border border-border bg-card p-4 ${p.enabled ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-medium">
                    {p.name} <span className="text-xs text-muted">#{p.id}</span>
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.sources.map((s) => (
                      <span key={s} className="chip">
                        {SOURCE_LABEL[s]}
                      </span>
                    ))}
                    {!p.enabled && <span className="chip">비활성</span>}
                  </div>
                </div>
                <Link href={`/profiles/${p.id}/edit`} className="btn px-2 py-1 text-xs">
                  편집
                </Link>
              </div>

              <dl className="mt-3 space-y-1.5 text-sm">
                <Row label="키워드" items={p.keywords} />
                <Row label="제목 포함" items={p.includeTitle} empty="(제한 없음)" />
                <Row label="제목 제외" items={p.excludeTitle} empty="(없음)" />
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <form action={crawlNow}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn btn-primary px-2 py-1 text-xs">지금 수집</button>
                </form>
                <form action={toggleProfileEnabled}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="enabled" value={String(p.enabled)} />
                  <button className="btn px-2 py-1 text-xs">{p.enabled ? '비활성화' : '활성화'}</button>
                </form>
                <form action={deleteProfile} className="ml-auto">
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn px-2 py-1 text-xs text-red-500">삭제</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ label, items, empty }: { label: string; items: string[]; empty?: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-muted">{label}</dt>
      <dd className="flex flex-wrap gap-1">
        {items.length === 0 ? (
          <span className="text-muted">{empty}</span>
        ) : (
          items.map((k) => (
            <span key={k} className="rounded bg-background px-1.5 py-0.5 text-xs">
              {k}
            </span>
          ))
        )}
      </dd>
    </div>
  );
}
