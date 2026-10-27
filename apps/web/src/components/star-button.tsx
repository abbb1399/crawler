'use client';

import { Star } from 'lucide-react';
import { useOptimistic } from 'react';
import { Button } from '@/components/ui/button';
import { toggleStar } from '@/lib/actions';
import { SignInToAct } from './sign-in-to-act';

/**
 * The star flips the moment it is clicked; the server action then saves it and revalidation brings the
 * real value. If the action fails (or redirects to sign-in), React drops the optimistic value by itself.
 */
export function StarButton({ id, starred, signedIn }: { id: number; starred: boolean; signedIn: boolean }) {
  const [shown, setShown] = useOptimistic(starred);
  const className = shown ? 'text-yellow-500 hover:text-yellow-500' : 'text-muted-foreground/50 hover:text-yellow-500';
  const title = shown ? '별표 해제' : '별표';
  const icon = <Star className={shown ? 'fill-current' : ''} />;

  if (!signedIn) {
    return (
      <SignInToAct variant="ghost" size="icon-sm" className={className} title={title}>
        {icon}
      </SignInToAct>
    );
  }
  return (
    <form
      action={async (formData) => {
        setShown(!shown);
        await toggleStar(formData);
      }}
    >
      <input type="hidden" name="id" value={id} />
      {/* The shown value, not the server prop: a second click before revalidation must undo the first. */}
      <input type="hidden" name="starred" value={String(shown)} />
      <Button variant="ghost" size="icon-sm" className={className} title={title} aria-pressed={shown}>
        {icon}
      </Button>
    </form>
  );
}
