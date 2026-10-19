import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { updateProfile } from '@/lib/actions';
import { ProfileForm } from '../../profile-form';

export const dynamic = 'force-dynamic';

export default async function EditProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();

  let profile;
  try {
    profile = await api.profile(n);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        프로필 편집 <span className="text-sm font-normal text-muted-foreground">#{profile.id}</span>
      </h1>
      <ProfileForm action={updateProfile} profile={profile} error={error} />
    </div>
  );
}
