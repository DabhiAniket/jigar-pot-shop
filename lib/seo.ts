import { paiseToRupees, type ProductDetail, type PublicStoreSettings } from '@jmh/shared';
import { absoluteUrl, BRAND_NAME } from './config';

/** Serialises JSON-LD safely for embedding in a <script> tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

const DAY_SCHEMA: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

/** Local business markup built only from details configured in Admin → Settings. */
export function storeJsonLd(settings: PublicStoreSettings | null) {
  const address = settings?.address;
  const hasAddress = Boolean(address?.line1 && address.city);
  const sameAs = settings ? Object.values(settings.social).filter(Boolean) : [];
  return {
    '@context': 'https://schema.org',
    '@type': hasAddress ? 'Store' : 'Organization',
    name: settings?.storeName ?? BRAND_NAME,
    url: absoluteUrl('/'),
    logo: absoluteUrl('/brand/v1/emblem-512.webp'),
    image: absoluteUrl('/opengraph-image.jpg'),
    ...(settings?.phone ? { telephone: settings.phone } : {}),
    ...(settings?.email ? { email: settings.email } : {}),
    ...(hasAddress
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: [address!.line1, address!.line2].filter(Boolean).join(', '),
            addressLocality: address!.city,
            ...(address!.state ? { addressRegion: address!.state } : {}),
            ...(address!.pincode ? { postalCode: address!.pincode } : {}),
            addressCountry: 'IN',
          },
        }
      : {}),
    ...(hasAddress && settings?.openingHours.some((entry) => entry.isOpen)
      ? {
          openingHoursSpecification: settings.openingHours
            .filter((entry) => entry.isOpen)
            .map((entry) => ({
              '@type': 'OpeningHoursSpecification',
              dayOfWeek: DAY_SCHEMA[entry.day],
              opens: entry.opens,
              closes: entry.closes,
            })),
        }
      : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

const AVAILABILITY_SCHEMA = {
  in_stock: 'https://schema.org/InStock',
  out_of_stock: 'https://schema.org/OutOfStock',
  made_to_order: 'https://schema.org/MadeToOrder',
} as const;

/** Product markup with real prices and availability only — no invented ratings or reviews. */
export function productJsonLd(product: ProductDetail, storeName: string) {
  const url = absoluteUrl(`/products/${product.slug}`);
  const images = product.images
    .map((image) => image.variants[image.variants.length - 1]!.url)
    .map(absoluteUrl);
  const offers =
    product.variants.length > 0
      ? {
          '@type': 'AggregateOffer',
          priceCurrency: 'INR',
          lowPrice: paiseToRupees(
            Math.min(...product.variants.map((v) => v.salePrice ?? v.price)),
          ).toFixed(2),
          highPrice: paiseToRupees(
            Math.max(...product.variants.map((v) => v.salePrice ?? v.price)),
          ).toFixed(2),
          offerCount: product.variants.length,
          availability: AVAILABILITY_SCHEMA[product.availability],
          url,
        }
      : {
          '@type': 'Offer',
          priceCurrency: 'INR',
          price: paiseToRupees(product.salePrice ?? product.price).toFixed(2),
          availability: AVAILABILITY_SCHEMA[product.availability],
          itemCondition: 'https://schema.org/NewCondition',
          url,
          seller: { '@type': 'Organization', name: storeName },
        };
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription || product.description.slice(0, 300) || undefined,
    image: images,
    sku: product.sku ?? undefined,
    brand: { '@type': 'Brand', name: storeName },
    ...(product.category ? { category: product.category.name } : {}),
    ...(product.specs.material ? { material: product.specs.material } : {}),
    offers,
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
