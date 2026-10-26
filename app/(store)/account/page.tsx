import type { Metadata } from 'next';
import { AccountOverview } from '@/components/account/account-overview';

export const metadata: Metadata = { title: 'My account' };

export default function AccountPage() {
  return (
    <>
      <p className="eyebrow">My account</p>
      <h1 className="mt-3 mb-8 text-4xl font-medium md:text-5xl">Your account</h1>
      <AccountOverview />
    </>
  );
}
