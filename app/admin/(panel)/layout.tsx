import type { AdminMe } from '@jmh/shared';
import { AdminShell } from '@/components/admin/admin-shell';
import { adminGet } from '@/lib/api/server';

export const dynamic = 'force-dynamic';

/** Server-side gate: the API validates the session cookie before any admin page renders. */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const { data: me } = await adminGet<{ data: AdminMe }>('/auth/me');
  return <AdminShell me={me}>{children}</AdminShell>;
}
