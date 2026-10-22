import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import type { ProductDetail, ProductRedirect, ProductSummary } from '@jmh/shared';
import { Breadcrumbs } from '@/components/store/breadcrumbs';
import { JsonLd } from '@/components/store/json-ld';
import { ProductRail } from '@/components/store/product-card';
import { ProductGallery, PurchasePanel } from '@/components/store/product-purchase';
import { RecentlyViewed, TrackView } from '@/components/store/recently-viewed';
import { publicGet, publicGetOrNull } from '@/lib/api/server';
import { getSettings } from '@/lib/api/store-data';
import { productJsonLd } from '@/lib/seo';

export const revalidate = 300;

// Pages are generated on first request and cached (ISR); nothing is needed at build time.
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

const getProduct = cache(async (slug: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const response = await publicGetOrNull<{ data: ProductDetail | ProductRedirect }>(
    `/products/${slug}`,
    { revalidate: 300, tags: ['catalog'] },
  );
  return response?.data ?? null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product || 'redirectTo' in product)
    return { title: 'Product not found', robots: { index: false } };
  const image = product.images[0]?.variants.at(-1);
  const description =
    product.seo.description ?? (product.shortDescription || product.description.slice(0, 160));
  return {
    title: product.seo.title ?? product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: 'website',
      title: product.name,
      description,
      images: image
        ? [
            {
              url: image.url,
              width: image.width,
              height: image.height,
              alt: product.images[0]!.alt,
            },
          ]
        : undefined,
    },
  };
}

const SPEC_LABELS: [keyof ProductDetail['specs'], string, (value: string | number) => string][] = [
  ['material', 'Material', String],
  ['finish', 'Finish', String],
  ['color', 'Colour', String],
  ['capacityLitres', 'Capacity', (v) => `${v} L`],
  ['heightCm', 'Height', (v) => `${v} cm`],
  ['diameterCm', 'Diameter', (v) => `${v} cm`],
  ['widthCm', 'Width', (v) => `${v} cm`],
  ['depthCm', 'Depth', (v) => `${v} cm`],
  ['weightKg', 'Weight', (v) => `${v} kg`],
];

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  if ('redirectTo' in product) permanentRedirect(`/products/${product.redirectTo}`);

  const [settings, related] = await Promise.all([
    getSettings(),
    publicGet<{ data: ProductSummary[] }>(`/products/${product.slug}/related`, {
      revalidate: 300,
      tags: ['catalog'],
    })
      .then((response) => response.data)
      .catch(() => []),
  ]);
  const specs = SPEC_LABELS.filter(([key]) => product.specs[key] != null);
  const crumbs = [
    { name: 'Home', href: '/' },
    ...(product.category
      ? [{ name: product.category.name, href: `/collections/${product.category.slug}` }]
      : [{ name: 'Shop', href: '/shop' }]),
    { name: product.name, href: `/products/${product.slug}` },
  ];

  return (
    <>
      <JsonLd data={productJsonLd(product, settings?.storeName ?? 'Jigar Matka House')} />
      <TrackView productId={product.id} />
      <div className="container-page pt-6 md:pt-10">
        <Breadcrumbs items={crumbs} />
        <div className="mt-6 grid gap-10 md:grid-cols-2 lg:gap-16">
          <ProductGallery images={product.images} name={product.name} />
          <div>
            {product.category ? <p className="eyebrow">{product.category.name}</p> : null}
            <h1 className="mt-3 text-4xl leading-[1.05] font-medium md:text-5xl">{product.name}</h1>
            {product.nameGu ? (
              <p lang="gu" className="mt-2 text-xl text-brown-muted">
                {product.nameGu}
              </p>
            ) : null}
            {product.shortDescription ? (
              <p className="mt-5 text-lg leading-relaxed text-brown-muted">
                {product.shortDescription}
              </p>
            ) : null}
            <div className="gold-rule my-8" />
            <PurchasePanel product={product} whatsappEnabled={Boolean(settings?.whatsappNumber)} />

            {product.description ? (
              <section aria-labelledby="description-title" className="mt-12">
                <h2 id="description-title" className="text-2xl font-medium">
                  About this piece
                </h2>
                <div className="prose-craft mt-4">
                  {product.description.split(/\n{2,}/).map((paragraph) => (
                    <p key={paragraph.slice(0, 40)} className="whitespace-pre-line">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ) : null}

            {specs.length ? (
              <section aria-labelledby="specs-title" className="mt-10">
                <h2 id="specs-title" className="text-2xl font-medium">
                  Details
                </h2>
                <dl className="mt-4 divide-y divide-brown/10 rounded-2xl border border-brown/10">
                  {specs.map(([key, label, format]) => (
                    <div
                      key={key}
                      className="flex justify-between gap-4 px-5 py-3 text-[0.9375rem]"
                    >
                      <dt className="text-brown-muted">{label}</dt>
                      <dd className="font-semibold">{format(product.specs[key]!)}</dd>
                    </div>
                  ))}
                  {product.sku ? (
                    <div className="flex justify-between gap-4 px-5 py-3 text-[0.9375rem]">
                      <dt className="text-brown-muted">SKU</dt>
                      <dd className="font-mono text-sm">{product.sku}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            {product.shippingInfo ? (
              <section
                aria-labelledby="shipping-title"
                className="mt-10 rounded-2xl bg-cream-deep p-5"
              >
                <h2
                  id="shipping-title"
                  className="font-sans text-sm font-bold tracking-[0.14em] uppercase"
                >
                  Delivery & care
                </h2>
                <p className="mt-2 whitespace-pre-line text-[0.9375rem] leading-relaxed text-brown-muted">
                  {product.shippingInfo}
                </p>
              </section>
            ) : null}
          </div>
        </div>
      </div>

      {related.length ? (
        <section aria-labelledby="related-title" className="container-page mt-24">
          <h2 id="related-title" className="mb-8 text-3xl font-medium md:text-4xl">
            You may also like
          </h2>
          <ProductRail products={related} />
        </section>
      ) : null}
      <RecentlyViewed excludeId={product.id} />
    </>
  );
}
