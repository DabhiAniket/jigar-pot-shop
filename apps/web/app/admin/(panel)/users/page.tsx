import type { Metadata } from 'next';
import type { AdminUserDTO } from '@jmh/shared';
import { UsersManager } from '@/components/admin/users-manager';
import { NoAccess, PageHeader } from '@/components/admin/ui';
import { adminGetOrNull } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Admin users' };
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const response = await adminGetOrNull<{ data: AdminUserDTO[] }>('/users');
  if (!response) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Admin users & roles"
        description="Super Admins manage accounts; every change is recorded in the audit log."
      />
      <UsersManager users={response.data} />
    </>
  );
}
