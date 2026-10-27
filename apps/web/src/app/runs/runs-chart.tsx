'use client';

import { JobSource, SOURCE_LABEL, type RunsDaily } from '@trawler/shared';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Two small charts above the runs table. Colours are fixed per source (never by series order):
 * dataviz palette slot 1 for 원티드, slot 2 for 사람인, as CSS variables so dark mode picks its own
 * validated steps (globals.css). One measure per chart — no dual axes. The table below is the
 * accessible data view.
 */
const SERIES: { key: JobSource; label: string; color: string }[] = [
  { key: 'WANTED', label: SOURCE_LABEL.WANTED, color: 'var(--viz-wanted)' },
  { key: 'SARAMIN', label: SOURCE_LABEL.SARAMIN, color: 'var(--viz-saramin)' },
];

type Row = { day: string; label: string } & Partial<Record<JobSource, number | null>>;

function pivot(data: RunsDaily, pick: (p: RunsDaily[number]) => number | null): Row[] {
  const byDay = new Map<string, Row>();
  for (const p of data) {
    const row = byDay.get(p.day) ?? { day: p.day, label: p.day.slice(5).replace('-', '/') };
    row[p.source] = pick(p);
    byDay.set(p.day, row);
  }
  return [...byDay.values()];
}

const axis = { fontSize: 11, fill: 'var(--muted-foreground)' } as const;
const tooltipStyle = {
  contentStyle: {
    background: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: 'var(--muted-foreground)', marginBottom: 4 },
  cursor: { stroke: 'var(--border)', fill: 'var(--muted)', fillOpacity: 0.4 },
} as const;

export function RunsChart({ data }: { data: RunsDaily }) {
  if (data.length === 0) return null;
  const inserted = pivot(data, (p) => p.inserted);
  const duration = pivot(data, (p) => (p.avgDurationMs === null ? null : Math.round(p.avgDurationMs / 100) / 10));
  const days = inserted.length;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-base">일별 신규 공고</CardTitle>
          <CardDescription>최근 {days}일, 소스별 새로 저장된 건수</CardDescription>
        </CardHeader>
        <CardContent>
          <div role="img" aria-label={`최근 ${days}일 소스별 일별 신규 공고 수 막대 그래프`} className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inserted} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                <Tooltip {...tooltipStyle} formatter={(v, name) => [`${String(v)}건`, String(name)]} />
                <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                {SERIES.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stackId="inserted"
                    fill={s.color}
                    stroke="var(--card)"
                    strokeWidth={2}
                    radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
                    maxBarSize={28}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-base">일별 평균 소요 시간</CardTitle>
          <CardDescription>초 단위, 끝난 실행만 평균 (실행이 없는 날은 빈칸)</CardDescription>
        </CardHeader>
        <CardContent>
          <div role="img" aria-label={`최근 ${days}일 소스별 일별 평균 수집 소요 시간 선 그래프`} className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={duration} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis tick={axis} tickLine={false} axisLine={false} width={40} unit="s" />
                <Tooltip {...tooltipStyle} formatter={(v, name) => [`${String(v)}초`, String(name)]} />
                <Legend iconType="plainline" iconSize={12} wrapperStyle={{ fontSize: 12 }} />
                {SERIES.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={{ r: 4, fill: s.color, stroke: 'var(--card)', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
