import { JobSource, SOURCE_LABEL, type SearchProfile } from '@devilray/shared';
import Link from 'next/link';

/** Shared by /profiles/new and /profiles/[id]/edit. Plain HTML form posting to a server action. */
export function ProfileForm({
  action,
  profile,
  error,
}: {
  action: (formData: FormData) => Promise<void>;
  profile?: SearchProfile;
  error?: string;
}) {
  const sources = new Set(profile?.sources ?? JobSource.options);
  return (
    <form action={action} className="max-w-xl space-y-4">
      {profile && <input type="hidden" name="id" value={profile.id} />}

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <Field label="이름" hint="구분용. 중복 불가.">
        <input name="name" required maxLength={50} defaultValue={profile?.name ?? ''} className="input" />
      </Field>

      <Field label="검색 키워드" hint="쉼표 또는 줄바꿈으로 구분. 각 키워드로 사이트를 검색합니다.">
        <textarea
          name="keywords"
          required
          rows={2}
          defaultValue={profile?.keywords.join(', ') ?? ''}
          className="input"
          placeholder="nestjs, node.js 백엔드"
        />
      </Field>

      <Field label="제목 포함 단어" hint="하나라도 제목에 있어야 저장. 비우면 제한 없음. 사이트 검색이 느슨해서 노이즈를 거르는 용도.">
        <textarea
          name="includeTitle"
          rows={2}
          defaultValue={profile?.includeTitle.join(', ') ?? 'node, nest, backend, 백엔드, 서버'}
          className="input"
        />
      </Field>

      <Field label="제목 제외 단어" hint="제목에 있으면 버림.">
        <textarea
          name="excludeTitle"
          rows={2}
          defaultValue={profile?.excludeTitle.join(', ') ?? ''}
          className="input"
          placeholder="인턴, 계약직"
        />
      </Field>

      <Field label="소스">
        <div className="flex gap-4 text-sm">
          {JobSource.options.map((s) => (
            <label key={s} className="flex items-center gap-1">
              <input type="checkbox" name="sources" value={s} defaultChecked={sources.has(s)} />
              {SOURCE_LABEL[s]}
            </label>
          ))}
        </div>
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={profile?.enabled ?? true} />
        활성 (크론이 주기적으로 수집)
      </label>

      <div className="flex gap-2 pt-2">
        <button className="btn btn-primary">{profile ? '저장' : '만들기'}</button>
        <Link href="/profiles" className="btn">
          취소
        </Link>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
