import type { Metadata } from 'next';
import type { AdminCategory } from '@jmh/shared';
import { PromotionEditor } from '@/components/admin/promotion-editor';
import { PageHeader } from '@/components/admin/ui';
import { adminGet } from '@/lib/api/server';

export const metadata: Metadata = { title: 'New promotion' };
export const dynamic = 'force-dynamic';

export default async function NewPromotionPage() {
  const { data } = await adminGet<{ data: AdminCategory[] }>('/categories');
  return (
    <>
      <PageHeader title="New promotion" back={{ href: '/admin/promotions', label: 'Promotions' }} />
      <PromotionEditor promotion={null} categories={data.map(({ id, name }) => ({ id, name }))} />
    </>
  );
}
