'use client';

import { JobSource, SOURCE_LABEL } from '@trawler/shared';
import { Loader2 } from 'lucide-react';
import { debounce, defaultRateLimit, useQueryStates } from 'nuqs';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { postingsSearchParams } from './postings-search-params';

/** Radix Select forbids an empty-string item value, so "all sources" gets a sentinel. */
const ALL = 'all';
const SEARCH_DEBOUNCE_MS = 400;

const TOGGLES = [
  { key: 'newToday', label: '오늘 신규만' },
  { key: 'hidden', label: '숨김만' },
  { key: 'starred', label: '별표만' },
  { key: 'expired', label: '만료 포함' },
] as const;

/**
 * Filter bar that writes straight to the URL (nuqs). Every change re-renders the server page
 * with the new search params (shallow: false) and resets to page 1. Select and checkboxes apply
 * immediately; the search box applies after typing pauses, or on Enter.
 */
export function PostingsFilters() {
  const [isPending, startTransition] = useTransition();
  const [sp, setSp] = useQueryStates(postingsSearchParams, { shallow: false, startTransition });
  const isFiltered = sp.q !== '' || sp.source !== null || sp.newToday || sp.hidden || sp.starred || sp.expired;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm" aria-busy={isPending}>
      <Input
        type="search"
        value={sp.q}
        onChange={(e) => {
          const q = e.target.value;
          // State updates at once (typing stays smooth); only the URL/server round-trip waits.
          setSp({ q, page: null }, { limitUrlUpdates: q === '' ? undefined : debounce(SEARCH_DEBOUNCE_MS) });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') setSp({ q: e.currentTarget.value, page: null }, { limitUrlUpdates: defaultRateLimit });
        }}
        placeholder="제목/회사 검색"
        className="max-w-xs"
      />
      {/* Empty value shows the placeholder (also on the server); picking "전체 소스" maps back to null. */}
      <Select
        value={sp.source ?? ''}
        onValueChange={(v) => setSp({ source: v === ALL ? null : (v as JobSource), page: null })}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="전체 소스" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>전체 소스</SelectItem>
          {JobSource.options.map((s) => (
            <SelectItem key={s} value={s}>
              {SOURCE_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {TOGGLES.map(({ key, label }) => (
        <Label key={key} className="gap-1.5">
          <Checkbox checked={sp[key]} onCheckedChange={(c) => setSp({ [key]: c === true, page: null })} /> {label}
        </Label>
      ))}
      {isFiltered && (
        <Button variant="link" size="sm" className="text-muted-foreground" onClick={() => setSp(null)}>
          초기화
        </Button>
      )}
      {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="불러오는 중" />}
    </div>
  );
}
