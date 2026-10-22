import type { Metadata } from 'next';
import Link from 'next/link';
import { NoAccess } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'No access' };

export default function NoAccessPage() {
  return (
    <>
      <NoAccess />
      <p className="mt-6 text-center">
        <Link href="/admin" className="font-semibold text-terracotta-deep">
          ← Back to dashboard
        </Link>
      </p>
    </>
  );
}
