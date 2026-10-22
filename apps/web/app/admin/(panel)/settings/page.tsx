import type { Metadata } from 'next';
import { SettingsEditor, type SettingsData } from '@/components/admin/settings-editor';
import { NoAccess, PageHeader } from '@/components/admin/ui';
import { adminGetOrNull } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Store settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const response = await adminGetOrNull<{ data: SettingsData }>('/settings');
  if (!response) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Store settings"
        description="Business details, WhatsApp, delivery charges and policies used across the website."
      />
      <SettingsEditor settings={response.data} />
    </>
  );
}
