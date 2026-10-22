'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ImageDTO, ProductDetail } from '@jmh/shared';
import { Button } from '@/components/ui/button';
import { cart } from '@/lib/cart';
import { cn } from '@/lib/utils';
import { AvailabilityLabel, Price } from './price';
import { ProductImage } from './product-image';
import { WhatsAppIcon } from './site-footer';

export function ProductGallery({ images, name }: { images: ImageDTO[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? null;
  return (
    <div className="flex flex-col gap-4 md:sticky md:top-28">
      <div className="overflow-hidden rounded-[2rem] bg-cream-deep">
        <ProductImage
          image={current}
          alt={current?.alt || name}
          sizes="(min-width: 1024px) 50vw, 100vw"
          priority
          fit="contain"
          className="aspect-square w-full"
        />
      </div>
      {images.length > 1 ? (
        <ul className="flex gap-3 overflow-x-auto scrollbar-none" aria-label="Product images">
          {images.map((image, index) => (
            <li key={image.assetId}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Show image ${index + 1} of ${images.length}`}
                aria-current={index === active}
                className={cn(
                  'block overflow-hidden rounded-2xl border-2 transition-colors',
                  index === active
                    ? 'border-terracotta'
                    : 'border-transparent hover:border-brown/20',
                )}
              >
                <ProductImage image={image} alt="" sizes="96px" className="size-20 md:size-24" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function PurchasePanel({
  product,
  whatsappEnabled,
}: {
  product: ProductDetail;
  whatsappEnabled: boolean;
}) {
  const router = useRouter();
  const hasVariants = product.variants.length > 0;
  const firstAvailable =
    product.variants.find((variant) => variant.maxQuantity > 0) ?? product.variants[0] ?? null;
  const [variantId, setVariantId] = useState<string | null>(firstAvailable?.id ?? null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = product.variants.find((item) => item.id === variantId) ?? null;
  const price = variant ? variant.price : product.price;
  const salePrice = variant ? variant.salePrice : product.salePrice;
  const availability = variant ? variant.availability : product.availability;
  const lowStock = variant ? variant.lowStock : product.lowStock;
  const max = variant ? variant.maxQuantity : product.maxQuantity;
  const canBuy = max > 0;
  const qty = Math.min(Math.max(1, quantity), Math.max(1, max));

  const addToCart = () => {
    cart.add(
      {
        productId: product.id,
        variantId: variant?.id ?? null,
        quantity: qty,
        name: product.name,
        variantName: variant?.name ?? null,
        slug: product.slug,
        image: product.image?.variants[0]?.url ?? null,
        unitPrice: salePrice ?? price,
      },
      max,
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Price price={price} salePrice={salePrice} size="lg" />
        <p className="mt-1 text-sm text-brown-muted">
          Inclusive of all taxes. Delivery charges, if any, are shown at checkout.
        </p>
      </div>
      <AvailabilityLabel availability={availability} lowStock={lowStock} />

      {hasVariants ? (
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Choose an option</legend>
          <div className="flex flex-wrap gap-2.5">
            {product.variants.map((option) => (
              <label
                key={option.id}
                className={cn(
                  'cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-terracotta-deep',
                  option.id === variantId
                    ? 'border-brown bg-brown text-cream'
                    : 'border-brown/25 hover:border-brown',
                  option.maxQuantity === 0 && 'opacity-50 line-through',
                )}
              >
                <input
                  type="radio"
                  name="variant"
                  value={option.id}
                  checked={option.id === variantId}
                  onChange={() => setVariantId(option.id)}
                  className="sr-only"
                />
                {option.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {canBuy ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div
            className="flex h-12 items-center rounded-full border border-brown/25"
            role="group"
            aria-label="Quantity"
          >
            <button
              type="button"
              className="size-12 rounded-full text-xl hover:bg-brown/5 disabled:opacity-40"
              onClick={() => setQuantity(qty - 1)}
              disabled={qty <= 1}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="w-10 text-center font-semibold" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              className="size-12 rounded-full text-xl hover:bg-brown/5 disabled:opacity-40"
              onClick={() => setQuantity(qty + 1)}
              disabled={qty >= max}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
          <Button
            size="lg"
            className="flex-1"
            onClick={() => {
              addToCart();
              setAdded(true);
            }}
          >
            {added ? 'Added — add more?' : 'Add to cart'}
          </Button>
        </div>
      ) : (
        <Button size="lg" disabled>
          Out of stock
        </Button>
      )}

      {canBuy ? (
        <div className="flex flex-wrap gap-3">
          {whatsappEnabled ? (
            <Button
              variant="whatsapp"
              size="lg"
              className="flex-1"
              icon={<WhatsAppIcon className="size-5" />}
              onClick={() => {
                addToCart();
                router.push('/checkout?channel=whatsapp');
              }}
            >
              Order on WhatsApp
            </Button>
          ) : null}
          {added ? (
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => router.push('/cart')}
            >
              View cart
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
