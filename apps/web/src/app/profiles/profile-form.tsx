'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { JobSource, Region, REGION_LABEL, SOURCE_LABEL, type SearchProfile } from '@trawler/shared';
import Link from 'next/link';
import { useTransition } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { SignInToAct } from '@/components/sign-in-to-act';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

/** Quick feedback before submit only; the server action still validates with the shared schema. */
const schema = z.object({
  name: z.string().trim().min(1, '이름을 입력하세요').max(50, '50자 이하로 입력하세요'),
  keywords: z.string().refine((s) => s.split(/[,\n]/).some((t) => t.trim()), '키워드를 하나 이상 입력하세요'),
  includeTitle: z.string(),
  excludeTitle: z.string(),
  sources: z.array(JobSource).min(1, '소스를 하나 이상 선택하세요'),
  regions: z.array(Region),
  enabled: z.boolean(),
});

/** Shared by /profiles/new and /profiles/[id]/edit. Validated with react-hook-form, then posted to a server action. */
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
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: profile?.name ?? '',
      keywords: profile?.keywords.join(', ') ?? '',
      includeTitle: profile?.includeTitle.join(', ') ?? '풀스택, full stack, 프로덕트 엔지니어, product engineer, 웹 개발자',
      excludeTitle: profile?.excludeTitle.join(', ') ?? '',
      sources: profile?.sources ?? JobSource.options,
      regions: profile?.regions ?? ['SEOUL', 'GYEONGGI'],
      enabled: profile?.enabled ?? true,
    },
  });
  // The inputs keep their names, so the server action reads the same FormData as before.
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    return handleSubmit(() => startTransition(() => action(new FormData(form))))(e);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-xl">
      {profile && <input type="hidden" name="id" value={profile.id} />}

      <FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">이름</FieldLabel>
          <Input id="name" maxLength={50} aria-invalid={!!errors.name} {...register('name')} />
          <FieldDescription>구분용. 중복 불가.</FieldDescription>
          <FieldError errors={[errors.name]} />
        </Field>

        <Field data-invalid={!!errors.keywords}>
          <FieldLabel htmlFor="keywords">검색 키워드</FieldLabel>
          <Textarea
            id="keywords"
            rows={2}
            placeholder="풀스택, 프로덕트 엔지니어, next.js"
            aria-invalid={!!errors.keywords}
            {...register('keywords')}
          />
          <FieldDescription>쉼표 또는 줄바꿈으로 구분. 각 키워드로 사이트를 검색합니다.</FieldDescription>
          <FieldError errors={[errors.keywords]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="includeTitle">제목 포함 단어</FieldLabel>
          <Textarea id="includeTitle" rows={2} {...register('includeTitle')} />
          <FieldDescription>
            하나라도 제목에 있어야 저장. 비우면 제한 없음. 사이트 검색이 느슨해서 노이즈를 거르는 용도.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="excludeTitle">제목 제외 단어</FieldLabel>
          <Textarea
            id="excludeTitle"
            rows={2}
            placeholder="마케터, 디자이너, 매니저, spring, php"
            {...register('excludeTitle')}
          />
          <FieldDescription>제목에 있으면 버림.</FieldDescription>
        </Field>

        <Controller
          control={control}
          name="sources"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>소스</FieldLabel>
              <div className="flex gap-4">
                {JobSource.options.map((s) => (
                  <Label key={s} className="gap-1.5 font-normal">
                    <Checkbox
                      name="sources"
                      value={s}
                      aria-invalid={fieldState.invalid}
                      checked={field.value.includes(s)}
                      onCheckedChange={(on) => field.onChange(on ? [...field.value, s] : field.value.filter((v) => v !== s))}
                    />
                    {SOURCE_LABEL[s]}
                  </Label>
                ))}
              </div>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="regions"
          render={({ field }) => (
            <Field>
              <FieldLabel>지역</FieldLabel>
              <div className="flex gap-4">
                {Region.options.map((r) => (
                  <Label key={r} className="gap-1.5 font-normal">
                    <Checkbox
                      name="regions"
                      value={r}
                      checked={field.value.includes(r)}
                      onCheckedChange={(on) => field.onChange(on ? [...field.value, r] : field.value.filter((v) => v !== r))}
                    />
                    {REGION_LABEL[r]}
                  </Label>
                ))}
              </div>
              <FieldDescription>체크한 지역만 검색. 모두 비우면 전국.</FieldDescription>
            </Field>
          )}
        />

        <Controller
          control={control}
          name="enabled"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Switch id="enabled" name="enabled" checked={field.value} onCheckedChange={field.onChange} />
              <FieldLabel htmlFor="enabled" className="font-normal">
                활성 (크론이 주기적으로 수집)
              </FieldLabel>
            </Field>
          )}
        />

        <div className="flex gap-2">
          {signedIn ? (
            <Button disabled={pending}>{profile ? '저장' : '만들기'}</Button>
          ) : (
            <SignInToAct>{profile ? '저장' : '만들기'}</SignInToAct>
          )}
          <Button asChild variant="outline">
            <Link href="/profiles">취소</Link>
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
