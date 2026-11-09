'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Shows a server action's failure (lib/flash errorText) as a toast, then drops `error`/`fields` from
 * the URL so a reload or back navigation does not show it again.
 */
export function FlashToast({ message }: { message?: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!message) return;
    toast.error(message, { id: message }); // the id keeps StrictMode's double effect to one toast
    const url = new URL(window.location.href);
    url.searchParams.delete('error');
    url.searchParams.delete('fields');
    router.replace(url.pathname + url.search, { scroll: false });
  }, [message, router]);
  return null;
}
