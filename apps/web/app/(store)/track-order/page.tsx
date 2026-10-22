import type { Metadata } from 'next';
import { TrackOrderForm } from '@/components/store/track-order-form';

export const metadata: Metadata = {
  title: 'Track your order',
  description:
    'Check the status of your Jigar Matka House order with your order number and mobile number.',
  alternates: { canonical: '/track-order' },
};

export default function TrackOrderPage() {
  return (
    <div className="container-page max-w-5xl pt-10 pb-10 md:pt-16">
      <p className="eyebrow">Order tracking</p>
      <h1 className="mt-3 text-4xl font-medium md:text-5xl">Track your order</h1>
      <p className="mt-3 max-w-xl text-lg text-brown-muted">
        Enter the order number from your confirmation and the mobile number used at checkout.
      </p>
      <TrackOrderForm />
    </div>
  );
}
