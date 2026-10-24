import 'server-only';
import { cache } from 'react';
import type { CategoryDTO, PublicStoreSettings } from '@jmh/shared';
import { buildSafeGet } from './server';

/** Request-deduplicated, data-cached reads shared by layouts and pages. */
export const getSettings = cache(async (): Promise<PublicStoreSettings | null> => {
  const response = await buildSafeGet<{ data: PublicStoreSettings } | null>('/settings', null, {
    tags: ['settings', 'promotions'],
  });
  return response?.data ?? null;
});

export const getCategories = cache(async (): Promise<CategoryDTO[]> => {
  const response = await buildSafeGet<{ data: CategoryDTO[] }>(
    '/categories',
    { data: [] },
    { tags: ['catalog'] },
  );
  return response.data;
});
