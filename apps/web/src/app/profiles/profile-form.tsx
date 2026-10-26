import { JobSource, Region, REGION_LABEL, SOURCE_LABEL, type SearchProfile } from '@trawler/shared';
import Link from 'next/link';
import { SignInToAct } from '@/components/sign-in-to-act';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

/** Shared by /profiles/new and /profiles/[id]/edit. Plain HTML form posting to a server action. */
export function ProfileForm({
  action,
  profile,
  error,
  signedIn,
}: {
  action: (formData: FormData) => Promise<void>;
  profile?: SearchProfile;
  error?: string;
  /** From lib/auth viewer(): signed-out visitors get a sign-in prompt instead of the submit button. */
  signedIn: boolean;
}) {
  const sources = new Set(profile?.sources ?? JobSource.options);
  const regions = new Set<Region>(profile?.regions ?? ['SEOUL', 'GYEONGGI']);
  return (
    <form action={action} className="max-w-xl">
      {profile && <input type="hidden" name="id" value={profile.id} />}

      <FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Field>
          <FieldLabel htmlFor="name">이름</FieldLabel>
          <Input id="name" name="name" required maxLength={50} defaultValue={profile?.name ?? ''} />
          <FieldDescription>구분용. 중복 불가.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="keywords">검색 키워드</FieldLabel>
          <Textarea
            id="keywords"
            name="keywords"
            required
            rows={2}
            defaultValue={profile?.keywords.join(', ') ?? ''}
            placeholder="풀스택, 프로덕트 엔지니어, next.js"
          />
          <FieldDescription>쉼표 또는 줄바꿈으로 구분. 각 키워드로 사이트를 검색합니다.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="includeTitle">제목 포함 단어</FieldLabel>
          <Textarea
            id="includeTitle"
            name="includeTitle"
            rows={2}
            defaultValue={profile?.includeTitle.join(', ') ?? '풀스택, full stack, 프로덕트 엔지니어, product engineer, 웹 개발자'}
          />
          <FieldDescription>
            하나라도 제목에 있어야 저장. 비우면 제한 없음. 사이트 검색이 느슨해서 노이즈를 거르는 용도.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="excludeTitle">제목 제외 단어</FieldLabel>
          <Textarea
            id="excludeTitle"
            name="excludeTitle"
            rows={2}
            defaultValue={profile?.excludeTitle.join(', ') ?? ''}
            placeholder="마케터, 디자이너, 매니저, spring, php"
          />
          <FieldDescription>제목에 있으면 버림.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>소스</FieldLabel>
          <div className="flex gap-4">
            {JobSource.options.map((s) => (
              <Label key={s} className="gap-1.5 font-normal">
                <Checkbox name="sources" value={s} defaultChecked={sources.has(s)} />
                {SOURCE_LABEL[s]}
              </Label>
            ))}
          </div>
        </Field>

        <Field>
          <FieldLabel>지역</FieldLabel>
          <div className="flex gap-4">
            {Region.options.map((r) => (
              <Label key={r} className="gap-1.5 font-normal">
                <Checkbox name="regions" value={r} defaultChecked={regions.has(r)} />
                {REGION_LABEL[r]}
              </Label>
            ))}
          </div>
          <FieldDescription>체크한 지역만 검색. 모두 비우면 전국.</FieldDescription>
        </Field>

        <Field orientation="horizontal">
          <Switch id="enabled" name="enabled" defaultChecked={profile?.enabled ?? true} />
          <FieldLabel htmlFor="enabled" className="font-normal">
            활성 (크론이 주기적으로 수집)
          </FieldLabel>
        </Field>

        <div className="flex gap-2">
          {signedIn ? <Button>{profile ? '저장' : '만들기'}</Button> : <SignInToAct>{profile ? '저장' : '만들기'}</SignInToAct>}
          <Button asChild variant="outline">
            <Link href="/profiles">취소</Link>
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
