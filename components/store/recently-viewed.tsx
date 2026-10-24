'use client';

import { useEffect, useState } from 'react';
import type { Paginated, ProductSummary } from '@jmh/shared';
import { api } from '@/lib/api/client';
import { recentlyViewed, rememberViewed } from '@/lib/cart';
import { ProductRail } from './product-card';

/** Records a product view in this browser only (no tracking server-side). */
export function TrackView({ productId }: { productId: string }) {
  useEffect(() => rememberViewed(productId), [productId]);
  return null;
}

export function RecentlyViewed({
  excludeId,
  title = 'Recently viewed',
}: {
  excludeId?: string;
  title?: string;
}) {
  const [products, setProducts] = useState<ProductSummary[]>([]);

  useEffect(() => {
    const ids = recentlyViewed()
      .filter((id) => id !== excludeId)
      .slice(0, 8);
    if (ids.length === 0) return;
    const controller = new AbortController();
    api<Paginated<ProductSummary>>(`/products?ids=${ids.join(',')}&limit=8`, {
      signal: controller.signal,
    })
      .then((response) => setProducts(response.data))
      .catch(() => undefined);
    return () => controller.abort();
  }, [excludeId]);

  if (products.length === 0) return null;
  return (
    <section aria-labelledby="recent-title" className="container-page py-16">
      <h2 id="recent-title" className="mb-8 text-3xl font-medium md:text-4xl">
        {title}
      </h2>
      <ProductRail products={products} />
    </section>
  );
}
