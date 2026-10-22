import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { AdminCategory, AdminProductDetail } from '@jmh/shared';
import { ProductEditor } from '@/components/admin/product-editor';
import { PageHeader, ProductStatusBadge } from '@/components/admin/ui';
import { adminGet, adminGetOrNull } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Edit product' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();
  const [product, categories] = await Promise.all([
    adminGetOrNull<{ data: AdminProductDetail }>(`/products/${id}`),
    adminGet<{ data: AdminCategory[] }>('/categories'),
  ]);
  if (!product) notFound();
  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {product.data.name} <ProductStatusBadge status={product.data.status} />
          </span>
        }
        back={{ href: '/admin/products', label: 'Products' }}
      />
      {/* key: remount with fresh state after a save refreshes the data */}
      <ProductEditor
        key={product.data.updatedAt}
        product={product.data}
        categories={categories.data.map(({ id: categoryId, name }) => ({ id: categoryId, name }))}
      />
    </>
  );
}
