import { REGION_LABEL, SOURCE_LABEL } from '@trawler/shared';
import { Pencil, Play, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">검색 프로필</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            키워드로 사이트를 검색하고, 제목 필터로 걸러서 저장합니다. 활성 프로필만 크론이 돕니다.
          </p>
        </div>
        <Button asChild>
          <Link href="/profiles/new">
            <Plus data-icon="inline-start" /> 새 프로필
          </Link>
        </Button>
      </div>

      {queued && (
        <Alert>
          <AlertDescription>
            크롤 잡 {queued}개를 큐에 넣었습니다. 결과는{' '}
            <Link href="/runs" className="underline">
              실행 이력
            </Link>
            에서.
          </AlertDescription>
        </Alert>
      )}

      {profiles.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>프로필이 없습니다.</EmptyTitle>
            <EmptyDescription>새 프로필을 만들면 키워드로 수집을 시작합니다.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {profiles.map((p) => (
            <li key={p.id}>
              <Card className={p.enabled ? '' : 'opacity-60'}>
                <CardHeader>
                  <CardTitle>
                    {p.name} <span className="text-xs font-normal text-muted-foreground">#{p.id}</span>
                  </CardTitle>
                  <div className="flex flex-wrap gap-1">
                    {p.sources.map((s) => (
                      <Badge key={s} variant="outline">
                        {SOURCE_LABEL[s]}
                      </Badge>
                    ))}
                    {!p.enabled && <Badge variant="secondary">비활성</Badge>}
                  </div>
                  <CardAction>
                    <Button asChild variant="outline" size="xs">
                      <Link href={`/profiles/${p.id}/edit`}>
                        <Pencil data-icon="inline-start" /> 편집
                      </Link>
                    </Button>
                  </CardAction>
                </CardHeader>

                <CardContent>
                  <dl className="space-y-1.5 text-sm">
                    <Row label="키워드" items={p.keywords} />
                    <Row label="제목 포함" items={p.includeTitle} empty="(제한 없음)" />
                    <Row label="제목 제외" items={p.excludeTitle} empty="(없음)" />
                    <Row label="지역" items={p.regions.map((r) => REGION_LABEL[r])} empty="(전국)" />
                  </dl>
                </CardContent>

                <CardFooter className="flex flex-wrap gap-2">
                  <form action={crawlNow}>
                    <input type="hidden" name="id" value={p.id} />
                    <Button size="xs">
                      <Play data-icon="inline-start" /> 지금 수집
                    </Button>
                  </form>
                  <form action={toggleProfileEnabled}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="enabled" value={String(p.enabled)} />
                    <Button variant="outline" size="xs">
                      {p.enabled ? '비활성화' : '활성화'}
                    </Button>
                  </form>
                  <form action={deleteProfile} className="ml-auto">
                    <input type="hidden" name="id" value={p.id} />
                    <Button variant="destructive" size="xs">
                      <Trash2 data-icon="inline-start" /> 삭제
                    </Button>
                  </form>
                </CardFooter>
              </Card>
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
      <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap gap-1">
        {items.length === 0 ? (
          <span className="text-muted-foreground">{empty}</span>
        ) : (
          items.map((k) => (
            <Badge key={k} variant="secondary" className="font-normal">
              {k}
            </Badge>
          ))
        )}
      </dd>
    </div>
  );
}
