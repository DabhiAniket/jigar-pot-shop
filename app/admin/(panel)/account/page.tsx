import type { Metadata } from 'next';
import { ADMIN_ROLE_LABELS, type AdminMe, type AdminSessionDTO } from '@jmh/shared';
import { ChangePasswordForm } from '@/components/admin/auth-forms';
import { SessionsList } from '@/components/admin/sessions-list';
import { Card, PageHeader } from '@/components/admin/ui';
import { adminGet } from '@/lib/api/server';

export const metadata: Metadata = { title: 'My account' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const [{ data: me }, { data: sessions }] = await Promise.all([
    adminGet<{ data: AdminMe }>('/auth/me'),
    adminGet<{ data: AdminSessionDTO[] }>('/auth/sessions'),
  ]);
  return (
    <>
      <PageHeader
        title="My account"
        description={`${me.name} · ${me.email} · ${ADMIN_ROLE_LABELS[me.role]}`}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Change password">
          <p className="mb-4 text-sm text-brown-muted">
            Changing your password signs out your other devices.
          </p>
          <ChangePasswordForm email={me.email} />
        </Card>
        <Card title="Signed-in devices">
          <SessionsList sessions={sessions} />
        </Card>
      </div>
    </>
  );
}
