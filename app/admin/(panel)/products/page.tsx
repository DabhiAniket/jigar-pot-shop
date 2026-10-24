import type { Metadata } from 'next';
import type { AdminCategory, AdminProductListItem, Paginated } from '@jmh/shared';
import { ProductTable } from '@/components/admin/product-table';
import { FilterBar, filterInput, PageHeader } from '@/components/admin/ui';
import { ButtonLink } from '@/components/ui/button';
import { Pagination } from '@/components/ui/misc';
import { adminGet } from '@/lib/api/server';
import { param, toQuery } from '@/lib/utils';

export const metadata: Metadata = { title: 'Products' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const query = {
    q: param(raw.q),
    status: param(raw.status),
    categoryId: param(raw.categoryId),
    stock: param(raw.stock),
    sort: param(raw.sort),
    page: param(raw.page),
  };
  const [products, categories] = await Promise.all([
    adminGet<Paginated<AdminProductListItem>>(`/products${toQuery(query)}`),
    adminGet<{ data: AdminCategory[] }>('/categories'),
  ]);

  return (
    <>
      <PageHeader
        title="Products"
        description={`${products.meta.total} products`}
        actions={<ButtonLink href="/admin/products/new">Add product</ButtonLink>}
      />
      <FilterBar action="/admin/products">
        <input
          name="q"
          defaultValue={query.q}
          placeholder="Name, SKU or slug"
          aria-label="Search products"
          className={`${filterInput} w-56`}
        />
        <select
          name="status"
          defaultValue={query.status ?? ''}
          aria-label="Status"
          className={filterInput}
        >
          <option value="">Active (not archived)</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select
          name="categoryId"
          defaultValue={query.categoryId ?? ''}
          aria-label="Category"
          className={filterInput}
        >
          <option value="">All categories</option>
          {categories.data.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          name="stock"
          defaultValue={query.stock ?? ''}
          aria-label="Stock"
          className={filterInput}
        >
          <option value="">Any stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        <select
          name="sort"
          defaultValue={query.sort ?? 'updated'}
          aria-label="Sort"
          className={filterInput}
        >
          <option value="updated">Recently updated</option>
          <option value="newest">Newest</option>
          <option value="name">Name</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="stock_asc">Stock ↑</option>
        </select>
      </FilterBar>
      <ProductTable
        products={products.data}
        categories={categories.data.map(({ id, name }) => ({ id, name }))}
      />
      <div className="mt-6">
        <Pagination
          page={products.meta.page}
          totalPages={products.meta.totalPages}
          href={(page) => `/admin/products${toQuery({ ...query, page })}`}
        />
      </div>
    </>
  );
}
