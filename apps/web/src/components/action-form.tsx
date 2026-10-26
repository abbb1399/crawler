import type { VariantProps } from 'class-variance-authority';
import { Button, buttonVariants } from '@/components/ui/button';
import { SignInToAct } from './sign-in-to-act';

type Props = VariantProps<typeof buttonVariants> & {
  /** From lib/auth viewer(): real form when true, sign-in trigger when false. */
  signedIn: boolean;
  action: (formData: FormData) => Promise<void>;
  /** Rendered as hidden inputs. */
  fields: Record<string, string | number | boolean>;
  className?: string;
  buttonClassName?: string;
  title?: string;
  children: React.ReactNode;
};

/** One-button server-action form whose button turns into a sign-in prompt for signed-out visitors. */
export function ActionForm({ signedIn, action, fields, className, buttonClassName, title, variant, size, children }: Props) {
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
    <form action={action} className={className}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={String(value)} />
      ))}
      <Button variant={variant} size={size} className={buttonClassName} title={title}>
        {children}
      </Button>
    </form>
  );
}
