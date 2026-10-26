import { createProfile } from '@/lib/actions';
import { viewer } from '@/lib/auth';
import { ProfileForm } from '../profile-form';

export const dynamic = 'force-dynamic';

export default async function NewProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, { signedIn }] = await Promise.all([searchParams, viewer()]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">새 프로필</h1>
      <ProfileForm action={createProfile} error={error} signedIn={signedIn} />
    </div>
  );
}
