'use client';

import { SignInButton } from '@clerk/nextjs';
import type { VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import { buttonVariants } from '@/components/ui/button';

type Props = VariantProps<typeof buttonVariants> & {
  className?: string;
  title?: string;
  children: React.ReactNode;
};

/**
 * Looks like the real action button but opens Clerk's sign-in modal instead. Shown to signed-out
 * visitors so the UI reads the same, and login is only asked for at the moment it is needed.
 * After sign-in Clerk refreshes the route and the server renders the real form.
 * `cn` matters: like <Button>, it lets the variant's border/background win over the base classes.
 */
export function SignInToAct({ variant, size, className, title, children }: Props) {
  return (
    <SignInButton mode="modal">
      <button type="button" className={cn(buttonVariants({ variant, size }), className)} title={title ?? '로그인하면 변경할 수 있습니다'}>
        {children}
      </button>
    </SignInButton>
  );
}
