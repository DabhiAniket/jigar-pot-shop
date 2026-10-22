import 'server-only';
import type { ProductSummary } from '@jmh/shared';
import type { ListingParams } from '@/components/store/product-listing';
import { param, toQuery } from '@/lib/utils';
import { ApiError, publicGet } from './server';

export interface ListingResult {
  products: ProductSummary[];
  total: number;
  page: number;
  totalPages: number;
  category: { id: string; name: string; slug: string } | null;
  error: string | null;
}

export function readListingParams(
  raw: Record<string, string | string[] | undefined>,
): ListingParams {
  const keys = [
    'q',
    'category',
    'sort',
    'inStock',
    'onSale',
    'featured',
    'bestseller',
    'minPrice',
    'maxPrice',
    'page',
  ] as const;
  return Object.fromEntries(
    keys.map((key) => [key, param(raw[key])?.slice(0, 80)]).filter(([, value]) => value),
  ) as ListingParams;
}

export async function fetchListing(params: ListingParams): Promise<ListingResult> {
  const query = toQuery({ ...params, limit: 24 });
  try {
    const response = await publicGet<{
      data: ProductSummary[];
      meta: { page: number; total: number; totalPages: number };
      category: ListingResult['category'];
    }>(`/products${query}`, { revalidate: 60, tags: ['catalog'] });
    return {
      products: response.data,
      total: response.meta.total,
      page: response.meta.page,
      totalPages: response.meta.totalPages,
      category: response.category,
      error: null,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      return {
        products: [],
        total: 0,
        page: 1,
        totalPages: 0,
        category: null,
        error: 'Some filters were not valid. Please adjust them and try again.',
      };
    }
    throw error;
  }
}
