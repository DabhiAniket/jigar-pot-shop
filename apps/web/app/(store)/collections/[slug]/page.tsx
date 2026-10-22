import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/store/breadcrumbs';
import { isFilteredView, ProductListing } from '@/components/store/product-listing';
import { ProductImage } from '@/components/store/product-image';
import { fetchListing, readListingParams } from '@/lib/api/listing';
import { getCategories } from '@/lib/api/store-data';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function findCategory(slug: string) {
  const categories = await getCategories();
  return { category: categories.find((item) => item.slug === slug) ?? null, categories };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await findCategory(slug);
  if (!category) return { title: 'Collection not found', robots: { index: false } };
  const listingParams = readListingParams(await searchParams);
  const page = Number(listingParams.page ?? 1);
  const filtered = isFilteredView(listingParams);
  const image = category.image?.variants.at(-1)?.url;
  return {
    title: category.seo.title ?? `${category.name} — Handcrafted Clay`,
    description:
      category.seo.description ??
      (category.description || `Shop ${category.name.toLowerCase()} from Jigar Matka House.`),
    alternates: {
      canonical:
        page > 1 && !filtered ? `/collections/${slug}?page=${page}` : `/collections/${slug}`,
    },
    robots: filtered ? { index: false, follow: true } : undefined,
    openGraph: image ? { images: [{ url: image }] } : undefined,
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { category, categories } = await findCategory(slug);
  if (!category) notFound();
  const listingParams = readListingParams(await searchParams);
  const listing = await fetchListing({ ...listingParams, category: slug });

  return (
    <>
      <section className="container-page grid items-end gap-8 pt-8 pb-12 md:grid-cols-12 md:pt-12">
        <div className="md:col-span-7">
          <Breadcrumbs
            items={[
              { name: 'Home', href: '/' },
              { name: 'Shop', href: '/shop' },
              { name: category.name, href: `/collections/${category.slug}` },
            ]}
          />
          <h1 className="mt-4 text-4xl leading-[1.05] font-medium md:text-6xl">{category.name}</h1>
          {category.nameGu ? (
            <p lang="gu" className="mt-2 text-xl text-brown-muted">
              {category.nameGu}
            </p>
          ) : null}
          {category.description ? (
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-brown-muted">
              {category.description}
            </p>
          ) : null}
        </div>
        {category.image ? (
          <div className="hidden overflow-hidden rounded-[2rem] md:col-span-4 md:col-start-9 md:block">
            <ProductImage
              image={category.image}
              sizes="30vw"
              priority
              className="aspect-[4/5] w-full"
            />
          </div>
        ) : null}
      </section>
      <ProductListing
        basePath={`/collections/${category.slug}`}
        params={listingParams}
        products={listing.products}
        total={listing.total}
        page={listing.page}
        totalPages={listing.totalPages}
        categories={categories}
        showCategoryFilter={false}
        error={listing.error}
      />
    </>
  );
}
