import type { Metadata } from 'next';
import type { AdminCategory, HomeContentDTO } from '@jmh/shared';
import { ContentEditor } from '@/components/admin/content-editor';
import { NoAccess, PageHeader } from '@/components/admin/ui';
import { adminGet, adminGetOrNull } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Homepage' };
export const dynamic = 'force-dynamic';

export default async function ContentPage() {
  const [content, categories] = await Promise.all([
    adminGetOrNull<{ data: HomeContentDTO }>('/content/home'),
    adminGet<{ data: AdminCategory[] }>('/categories'),
  ]);
  if (!content) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Homepage content"
        description="Changes appear on the storefront within a minute."
      />
      <ContentEditor
        content={content.data}
        categories={categories.data.map(({ id, name }) => ({ id, name }))}
      />
    </>
  );
}
