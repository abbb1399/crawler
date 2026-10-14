import { SOURCE_LABEL } from '@devilray/shared';
import { api } from '@/lib/api';
import { fmtDateTime, fmtDuration } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = {
  OK: 'text-green-600',
  FAILED: 'text-red-500',
  RUNNING: 'text-accent',
};

export default async function RunsPage() {
  const runs = await api.runs(50);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">실행 이력</h1>
        <p className="mt-1 text-sm text-muted">
          최근 50회. 수집 = 사이트가 돌려준 건수, 통과 = 제목 필터 후, 신규 = 새로 저장된 건수.
        </p>
      </div>

      {runs.length === 0 ? (
        <p className="py-16 text-center text-muted">아직 실행 이력이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-border">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">소스</th>
                <th className="px-3 py-2">프로필</th>
                <th className="px-3 py-2">시작</th>
                <th className="px-3 py-2">소요</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2 text-right">수집</th>
                <th className="px-3 py-2 text-right">통과</th>
                <th className="px-3 py-2 text-right">신규</th>
                <th className="px-3 py-2 text-right">갱신</th>
                <th className="px-3 py-2">오류</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-muted">{r.id}</td>
                  <td className="px-3 py-2">{SOURCE_LABEL[r.source]}</td>
                  <td className="px-3 py-2">{r.profile?.name ?? r.profileId}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(r.startedAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDuration(r.startedAt, r.finishedAt)}</td>
                  <td className={`px-3 py-2 font-medium ${STATUS[r.status] ?? ''}`}>{r.status}</td>
                  <td className="px-3 py-2 text-right">{r.fetched}</td>
                  <td className="px-3 py-2 text-right">{r.found}</td>
                  <td className={`px-3 py-2 text-right ${r.inserted > 0 ? 'font-medium text-accent' : ''}`}>
                    {r.inserted}
                  </td>
                  <td className="px-3 py-2 text-right">{r.updated}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-xs text-red-500" title={r.error ?? ''}>
                    {r.error ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
