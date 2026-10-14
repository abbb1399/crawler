import { createProfile } from '@/lib/actions';
import { ProfileForm } from '../profile-form';

export const dynamic = 'force-dynamic';

export default async function NewProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">새 프로필</h1>
      <ProfileForm action={createProfile} error={error} />
    </div>
  );
}
