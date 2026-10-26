import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { OrderDetail } from '@/components/account/order-detail';

export const metadata: Metadata = { title: 'Order details' };

export default async function OrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  if (!/^[A-Z0-9-]{10,20}$/i.test(orderNumber)) notFound();
  return (
    <>
      <p className="eyebrow">My account</p>
      <h1 className="mt-3 mb-8 text-4xl font-medium md:text-5xl">Order details</h1>
      <Suspense>
        <OrderDetail orderNumber={orderNumber.toUpperCase()} />
      </Suspense>
    </>
  );
}
