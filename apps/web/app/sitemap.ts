import type { MetadataRoute } from 'next';
import { POLICY_KEYS } from '@jmh/shared';
import { buildSafeGet } from '@/lib/api/server';
import { absoluteUrl } from '@/lib/config';

export const revalidate = 3600;

interface SitemapData {
  products: { slug: string; updatedAt: string }[];
  categories: { slug: string; updatedAt: string }[];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data } = await buildSafeGet<{ data: SitemapData }>(
    '/seo/sitemap',
    { data: { products: [], categories: [] } },
    { revalidate: 3600 },
  );
  return [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/shop'), changeFrequency: 'daily', priority: 0.9 },
    ...data.categories.map((category) => ({
      url: absoluteUrl(`/collections/${category.slug}`),
      lastModified: category.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...data.products.map((product) => ({
      url: absoluteUrl(`/products/${product.slug}`),
      lastModified: product.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    { url: absoluteUrl('/track-order'), changeFrequency: 'yearly', priority: 0.2 },
    ...POLICY_KEYS.map((key) => ({
      url: absoluteUrl(`/policies/${key}`),
      changeFrequency: 'yearly' as const,
      priority: 0.2,
    })),
  ];
}
