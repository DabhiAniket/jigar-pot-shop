'use client';

import { Button } from '@/components/ui/button';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-3xl border border-brown/10 bg-white p-10 text-center">
      <h1 className="text-2xl font-medium">This page could not be loaded</h1>
      <p className="mt-2 text-brown-muted">
        Please try again. If it keeps happening, share this reference with your developer:{' '}
        {error.digest ?? 'n/a'}
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
