import type { Metadata } from 'next';
import { OrdersList } from '@/components/account/orders-list';

export const metadata: Metadata = { title: 'My orders' };

export default function OrdersPage() {
  return (
    <>
      <p className="eyebrow">My account</p>
      <h1 className="mt-3 mb-8 text-4xl font-medium md:text-5xl">My orders</h1>
      <OrdersList />
    </>
  );
}
