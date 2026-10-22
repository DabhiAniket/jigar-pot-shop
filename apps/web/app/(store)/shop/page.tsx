import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/store/breadcrumbs';
import { isFilteredView, ProductListing } from '@/components/store/product-listing';
import { fetchListing, readListingParams } from '@/lib/api/listing';
import { getCategories } from '@/lib/api/store-data';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const params = readListingParams(await searchParams);
  const page = Number(params.page ?? 1);
  const filtered = isFilteredView(params) || Boolean(params.category);
  return {
    title: params.q ? `Search: ${params.q}` : 'Shop handcrafted clay pottery',
    description:
      'Browse clay matkas, earthen water pots, terracotta cookware, planters and decorative pottery.',
    alternates: { canonical: page > 1 && !filtered ? `/shop?page=${page}` : '/shop' },
    // Filter and search combinations are not indexed, to avoid duplicate pages in search results.
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const params = readListingParams(await searchParams);
  const [listing, categories] = await Promise.all([fetchListing(params), getCategories()]);
  const heading = params.q
    ? `Results for “${params.q}”`
    : params.bestseller
      ? 'Bestsellers'
      : params.onSale
        ? 'Special offers'
        : params.featured
          ? 'Featured collection'
          : (listing.category?.name ?? 'All products');

  return (
    <>
      <div className="container-page pt-8 pb-10 md:pt-12">
        <Breadcrumbs
          items={[
            { name: 'Home', href: '/' },
            { name: 'Shop', href: '/shop' },
          ]}
        />
        <h1 className="mt-4 text-4xl font-medium md:text-6xl">{heading}</h1>
        <p className="mt-3 max-w-2xl text-lg text-brown-muted">
          Handcrafted clay for cooling water, slow cooking, growing and celebrating.
        </p>
      </div>
      <ProductListing
        basePath="/shop"
        params={params}
        products={listing.products}
        total={listing.total}
        page={listing.page}
        totalPages={listing.totalPages}
        categories={categories}
        showCategoryFilter
        error={listing.error}
      />
    </>
  );
}
