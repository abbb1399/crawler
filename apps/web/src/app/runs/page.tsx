import { SOURCE_LABEL } from '@trawler/shared';
import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { fmtDateTime, fmtDuration } from '@/lib/format';
import { RunsChart } from './runs-chart';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = {
  OK: 'text-green-600 dark:text-green-500',
  FAILED: 'text-destructive',
  RUNNING: 'text-primary',
};

export default async function RunsPage() {
  const [runs, stats] = await Promise.all([api.runs(50), api.runsStats(14)]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">실행 이력</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          최근 50회. 수집 = 사이트가 돌려준 건수, 통과 = 제목 필터 후, 신규 = 새로 저장된 건수.
        </p>
      </div>

      {runs.length > 0 && <RunsChart data={stats} />}

      {runs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>아직 실행 이력이 없습니다.</EmptyTitle>
            <EmptyDescription>검색 프로필에서 ‘지금 수집’을 누르거나 크론을 기다리세요.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>소스</TableHead>
                <TableHead>프로필</TableHead>
                <TableHead>시작</TableHead>
                <TableHead>소요</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">수집</TableHead>
                <TableHead className="text-right">통과</TableHead>
                <TableHead className="text-right">신규</TableHead>
                <TableHead className="text-right">갱신</TableHead>
                <TableHead>오류</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{r.id}</TableCell>
                  <TableCell>{SOURCE_LABEL[r.source]}</TableCell>
                  <TableCell>{r.profile?.name ?? r.profileId}</TableCell>
                  <TableCell>{fmtDateTime(r.startedAt)}</TableCell>
                  <TableCell>{fmtDuration(r.startedAt, r.finishedAt)}</TableCell>
                  <TableCell className={`font-medium ${STATUS[r.status] ?? ''}`}>{r.status}</TableCell>
                  <TableCell className="text-right">{r.fetched}</TableCell>
                  <TableCell className="text-right">{r.found}</TableCell>
                  <TableCell className={`text-right ${r.inserted > 0 ? 'font-medium text-primary' : ''}`}>
                    {r.inserted}
                  </TableCell>
                  <TableCell className="text-right">{r.updated}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-destructive" title={r.error ?? ''}>
                    {r.error ?? ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
