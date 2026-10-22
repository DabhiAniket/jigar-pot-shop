import Link from 'next/link';
import type { ProductSummary } from '@jmh/shared';
import { cn } from '@/lib/utils';
import { QuickAddButton } from './add-to-cart';
import { AvailabilityLabel, Price } from './price';
import { ProductImage } from './product-image';

const CARD_SIZES = '(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw';

export function ProductCard({
  product,
  priority,
  className,
}: {
  product: ProductSummary;
  priority?: boolean;
  className?: string;
}) {
  const thumb =
    product.image?.variants.find((variant) => variant.name === 'thumb')?.url ??
    product.image?.variants[0]?.url ??
    null;
  return (
    <article className={cn('group relative flex flex-col', className)}>
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-square overflow-hidden rounded-[1.75rem] bg-cream-deep shadow-[inset_0_0_0_1px_rgb(69_53_44/0.06)]"
      >
        <ProductImage
          image={product.image}
          sizes={CARD_SIZES}
          priority={priority}
          className="size-full transition-transform duration-700 ease-[var(--ease-craft)] group-hover:scale-[1.035]"
        />
        {product.secondaryImage ? (
          <ProductImage
            image={product.secondaryImage}
            sizes={CARD_SIZES}
            alt=""
            className="absolute inset-0 size-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        ) : null}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
          {product.isBestseller ? (
            <span className="rounded-full bg-cream/90 px-2.5 py-1 text-[0.6875rem] font-bold tracking-wide text-brown uppercase backdrop-blur">
              Bestseller
            </span>
          ) : null}
          {product.availability === 'made_to_order' ? (
            <span className="rounded-full bg-cream/90 px-2.5 py-1 text-[0.6875rem] font-bold tracking-wide text-brown uppercase backdrop-blur">
              Made to order
            </span>
          ) : null}
        </div>
        <span className="sr-only">{product.name}</span>
      </Link>
      <div className="flex flex-1 flex-col px-1 pt-4">
        {product.category ? (
          <p className="text-xs font-semibold tracking-[0.12em] text-brown-muted uppercase">
            {product.category.name}
          </p>
        ) : null}
        <h3 className="mt-1 font-display text-lg leading-snug font-medium text-brown md:text-xl">
          <Link
            href={`/products/${product.slug}`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>
        {product.nameGu ? (
          <p lang="gu" className="text-sm text-brown-muted">
            {product.nameGu}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <Price
            price={product.price}
            salePrice={product.salePrice}
            from={product.hasPriceRange}
            size="sm"
          />
          {product.availability !== 'in_stock' || product.lowStock ? (
            <AvailabilityLabel
              availability={product.availability}
              lowStock={product.lowStock}
              className="text-xs"
            />
          ) : null}
        </div>
        <div className="relative z-10 mt-4">
          <QuickAddButton
            product={{
              id: product.id,
              slug: product.slug,
              name: product.name,
              image: thumb,
              unitPrice: product.effectivePrice,
              hasVariants: product.hasVariants,
              available: product.availability !== 'out_of_stock',
            }}
          />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  priorityCount = 0,
}: {
  products: ProductSummary[];
  priorityCount?: number;
}) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 xl:grid-cols-4">
      {products.map((product, index) => (
        <li key={product.id} className="flex">
          <ProductCard product={product} priority={index < priorityCount} className="w-full" />
        </li>
      ))}
    </ul>
  );
}

/** Horizontal, snap-scrolling rail on small screens; grid on large screens. */
export function ProductRail({ products }: { products: ProductSummary[] }) {
  return (
    <ul className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 xl:grid-cols-4">
      {products.map((product) => (
        <li
          key={product.id}
          className="flex w-[68vw] max-w-72 shrink-0 snap-start md:w-auto md:max-w-none"
        >
          <ProductCard product={product} className="w-full" />
        </li>
      ))}
    </ul>
  );
}
