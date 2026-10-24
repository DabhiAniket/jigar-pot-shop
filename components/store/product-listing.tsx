import Link from 'next/link';
import {
  PRODUCT_SORT_LABELS,
  PRODUCT_SORTS,
  type CategoryDTO,
  type ProductSummary,
} from '@jmh/shared';
import { EmptyState, Pagination } from '@/components/ui/misc';
import { buttonClasses } from '@/components/ui/button';
import { toQuery } from '@/lib/utils';
import { AutoSubmitForm } from './auto-submit-form';
import { ProductGrid } from './product-card';

export interface ListingParams {
  q?: string;
  category?: string;
  sort?: string;
  inStock?: string;
  onSale?: string;
  featured?: string;
  bestseller?: string;
  minPrice?: string;
  maxPrice?: string;
  page?: string;
}

export const FILTER_KEYS = [
  'q',
  'sort',
  'inStock',
  'onSale',
  'featured',
  'bestseller',
  'minPrice',
  'maxPrice',
] as const;

/** True when the URL represents a filtered/sorted variant that should not be indexed. */
export function isFilteredView(params: ListingParams): boolean {
  return FILTER_KEYS.some((key) => Boolean(params[key]));
}

interface ListingProps {
  basePath: string;
  params: ListingParams;
  products: ProductSummary[];
  total: number;
  page: number;
  totalPages: number;
  categories: CategoryDTO[];
  showCategoryFilter: boolean;
  error?: string | null;
}

const field =
  'h-10 rounded-full border border-brown/20 bg-white/70 px-4 text-sm text-brown focus:border-terracotta-deep focus:outline-none';

export function ProductListing({
  basePath,
  params,
  products,
  total,
  page,
  totalPages,
  categories,
  showCategoryFilter,
  error,
}: ListingProps) {
  const hrefFor = (nextPage: number) =>
    `${basePath}${toQuery({ ...params, page: nextPage > 1 ? nextPage : undefined })}`;
  const activeFilters =
    FILTER_KEYS.filter((key) => key !== 'sort' && params[key]).length +
    (showCategoryFilter && params.category ? 1 : 0);

  return (
    <div className="container-page pb-10">
      <AutoSubmitForm
        action={basePath}
        className="mb-8 rounded-[1.75rem] border border-brown/10 bg-cream-deep/60 p-4 md:p-5"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <label htmlFor="listing-search" className="sr-only">
              Search products
            </label>
            <input
              id="listing-search"
              name="q"
              type="search"
              defaultValue={params.q ?? ''}
              placeholder="Search matkas, surahis, planters…"
              maxLength={80}
              className={`${field} w-full pl-10`}
            />
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-brown-muted"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
              <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          {/* CSS-only disclosure: collapsible on small screens, always open on large ones, no JS needed. */}
          <input
            id="filters-toggle"
            type="checkbox"
            className="peer sr-only"
            defaultChecked={activeFilters > 0}
          />
          <label
            htmlFor="filters-toggle"
            className="flex h-10 cursor-pointer items-center justify-between rounded-full border border-brown/20 px-4 text-sm font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-terracotta-deep lg:hidden"
          >
            Filters {activeFilters ? `(${activeFilters})` : ''}
            <span aria-hidden="true">▾</span>
          </label>
          <div className="hidden flex-wrap items-center gap-3 peer-checked:flex lg:flex">
            {showCategoryFilter ? (
              <>
                <label htmlFor="listing-category" className="sr-only">
                  Category
                </label>
                <select
                  id="listing-category"
                  name="category"
                  defaultValue={params.category ?? ''}
                  className={field}
                  data-autosubmit
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <label htmlFor="listing-sort" className="sr-only">
              Sort by
            </label>
            <select
              id="listing-sort"
              name="sort"
              defaultValue={params.sort ?? 'featured'}
              className={field}
              data-autosubmit
            >
              {PRODUCT_SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {PRODUCT_SORT_LABELS[sort]}
                </option>
              ))}
            </select>
            <fieldset className="flex items-center gap-2">
              <legend className="sr-only">Price range in rupees</legend>
              <label htmlFor="min-price" className="sr-only">
                Minimum price
              </label>
              <input
                id="min-price"
                name="minPrice"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Min ₹"
                defaultValue={params.minPrice ?? ''}
                className={`${field} w-24`}
              />
              <span aria-hidden="true">–</span>
              <label htmlFor="max-price" className="sr-only">
                Maximum price
              </label>
              <input
                id="max-price"
                name="maxPrice"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Max ₹"
                defaultValue={params.maxPrice ?? ''}
                className={`${field} w-24`}
              />
            </fieldset>
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="inStock"
                value="true"
                defaultChecked={params.inStock === 'true'}
                className="size-4 accent-terracotta"
                data-autosubmit
              />
              In stock
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="onSale"
                value="true"
                defaultChecked={params.onSale === 'true'}
                className="size-4 accent-terracotta"
                data-autosubmit
              />
              On offer
            </label>
            {params.featured ? (
              <input type="hidden" name="featured" value={params.featured} />
            ) : null}
            {params.bestseller ? (
              <input type="hidden" name="bestseller" value={params.bestseller} />
            ) : null}
            <button type="submit" className={buttonClasses('dark', 'sm')}>
              Apply
            </button>
            {activeFilters > 0 ? (
              <Link
                href={basePath}
                className="text-sm font-semibold text-terracotta-deep underline-offset-4 hover:underline"
              >
                Clear all
              </Link>
            ) : null}
          </div>
        </div>
      </AutoSubmitForm>

      <p className="mb-6 text-sm text-brown-muted" role="status">
        {error
          ? error
          : `${total} ${total === 1 ? 'product' : 'products'}${params.q ? ` for “${params.q}”` : ''}`}
      </p>

      {products.length ? (
        <ProductGrid products={products} priorityCount={4} />
      ) : (
        <EmptyState
          title={params.q ? 'Nothing matched your search' : 'No products here yet'}
          action={
            <Link href="/shop" className={buttonClasses('primary')}>
              Browse all products
            </Link>
          }
        >
          {params.q
            ? 'Try a simpler word such as “matka”, “planter” or “diya”.'
            : 'New pieces are added regularly — please check back soon.'}
        </EmptyState>
      )}

      <div className="mt-14">
        <Pagination page={page} totalPages={totalPages} href={hrefFor} label="Product pages" />
      </div>
    </div>
  );
}
