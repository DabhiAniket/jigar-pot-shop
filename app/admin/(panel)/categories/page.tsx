import type { Metadata } from 'next';
import type { AdminCategory } from '@jmh/shared';
import { CategoryManager } from '@/components/admin/category-manager';
import { PageHeader } from '@/components/admin/ui';
import { adminGet } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Categories' };
export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const { data } = await adminGet<{ data: AdminCategory[] }>('/categories');
  return (
    <>
      <PageHeader
        title="Categories"
        description="Collections shown in the shop menu, on the homepage and on collection pages."
      />
      <CategoryManager categories={data} />
    </>
  );
}
