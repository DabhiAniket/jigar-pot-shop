'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Button, buttonClasses } from '@/components/ui/button';

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-3 text-4xl font-medium">We could not load this page</h1>
      <p className="mt-3 max-w-md text-brown-muted">
        Please try again in a moment. If it keeps happening, contact us and mention reference{' '}
        {error.digest ?? 'unknown'}.
      </p>
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={buttonClasses('secondary')}>
          Home
        </Link>
      </div>
    </div>
  );
}
