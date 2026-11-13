'use client';

import type { VariantProps } from 'class-variance-authority';
import { useId } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { SignInToAct } from './sign-in-to-act';

type Props = VariantProps<typeof buttonVariants> & {
  /** From lib/auth viewer(): real form when true, sign-in trigger when false. */
  signedIn: boolean;
  action: (formData: FormData) => Promise<void>;
  /** Rendered as hidden inputs. */
  fields: Record<string, string | number | boolean>;
  /** Ask in a dialog before submitting; `action` is the confirm button's label. */
  confirm?: { title: string; description?: string; action: string };
  className?: string;
  buttonClassName?: string;
  title?: string;
  children: React.ReactNode;
};

/** One-button server-action form whose button turns into a sign-in prompt for signed-out visitors. */
export function ActionForm({ signedIn, action, fields, confirm, className, buttonClassName, title, variant, size, children }: Props) {
  const formId = useId();
  if (!signedIn) {
    return (
      <div className={className}>
        <SignInToAct variant={variant} size={size} className={buttonClassName} title={title}>
          {children}
        </SignInToAct>
      </div>
    );
  }
  return (
    <form id={formId} action={action} className={className}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={String(value)} />
      ))}
      {confirm ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant={variant} size={size} className={buttonClassName} title={title}>
              {children}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
              {confirm.description && <AlertDialogDescription>{confirm.description}</AlertDialogDescription>}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              {/* The dialog is portaled outside <form>, so submit it by id. */}
              <AlertDialogAction type="submit" form={formId} variant={variant}>
                {confirm.action}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button variant={variant} size={size} className={buttonClassName} title={title}>
          {children}
        </Button>
      )}
    </form>
  );
}
