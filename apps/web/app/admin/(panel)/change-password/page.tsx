import type { Metadata } from 'next';
import type { AdminMe } from '@jmh/shared';
import { ChangePasswordForm } from '@/components/admin/auth-forms';
import { PageHeader } from '@/components/admin/ui';
import { adminGet } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Change password' };

export default async function ChangePasswordPage() {
  const { data: me } = await adminGet<{ data: AdminMe }>('/auth/me');
  return (
    <>
      <PageHeader
        title="Choose a new password"
        description={
          me.mustChangePassword
            ? 'For security, you must replace the temporary password before using the admin panel.'
            : 'Update your password.'
        }
      />
      <ChangePasswordForm email={me.email} forced={me.mustChangePassword} />
    </>
  );
}
