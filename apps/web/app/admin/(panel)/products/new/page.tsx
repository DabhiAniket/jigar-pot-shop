import type { Metadata } from 'next';
import type { AdminCategory } from '@jmh/shared';
import { ProductEditor } from '@/components/admin/product-editor';
import { PageHeader } from '@/components/admin/ui';
import { adminGet } from '@/lib/api/server';

export const metadata: Metadata = { title: 'New product' };

export default async function NewProductPage() {
  const { data: categories } = await adminGet<{ data: AdminCategory[] }>('/categories');
  return (
    <>
      <PageHeader title="New product" back={{ href: '/admin/products', label: 'Products' }} />
      <ProductEditor product={null} categories={categories.map(({ id, name }) => ({ id, name }))} />
    </>
  );
}
