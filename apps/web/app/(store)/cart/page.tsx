import type { Metadata } from 'next';
import { CartView } from '@/components/store/cart-view';

export const metadata: Metadata = { title: 'Your cart', robots: { index: false } };

export default function CartPage() {
  return (
    <div className="container-page pt-10 pb-10 md:pt-14">
      <h1 className="mb-8 text-4xl font-medium md:text-5xl">Your cart</h1>
      <CartView />
    </div>
  );
}
