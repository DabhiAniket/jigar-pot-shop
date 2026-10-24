import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { AdminCategory, AdminPromotion } from '@jmh/shared';
import { PromotionEditor } from '@/components/admin/promotion-editor';
import { PageHeader } from '@/components/admin/ui';
import { adminGet, adminGetOrNull } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Edit promotion' };
export const dynamic = 'force-dynamic';

export default async function EditPromotionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();
  const [promotion, categories] = await Promise.all([
    adminGetOrNull<{ data: AdminPromotion }>(`/promotions/${id}`),
    adminGet<{ data: AdminCategory[] }>('/categories'),
  ]);
  if (!promotion) notFound();
  return (
    <>
      <PageHeader
        title={promotion.data.name}
        description={`State: ${promotion.data.state}`}
        back={{ href: '/admin/promotions', label: 'Promotions' }}
      />
      <PromotionEditor
        key={promotion.data.updatedAt}
        promotion={promotion.data}
        categories={categories.data.map(({ id: categoryId, name }) => ({ id: categoryId, name }))}
      />
    </>
  );
}
