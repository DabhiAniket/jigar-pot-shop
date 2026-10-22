import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CheckoutForm } from '@/components/store/checkout-form';
import { Skeleton } from '@/components/ui/misc';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="container-page pt-10 pb-10 md:pt-14">
      <h1 className="mb-8 text-4xl font-medium md:text-5xl">Checkout</h1>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <CheckoutForm />
      </Suspense>
    </div>
  );
}
