'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatINR, type CartQuote } from '@jmh/shared';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { cart, useCart, useCartReady } from '@/lib/cart';
import { useQuote } from '@/lib/use-quote';
import { cn } from '@/lib/utils';
import { QuoteTotals } from './order-summary';
import { ProductImage } from './product-image';

export function FulfillmentPicker({
  quote,
  value,
  onChange,
}: {
  quote: CartQuote | null;
  value: 'delivery' | 'pickup';
  onChange: (value: 'delivery' | 'pickup') => void;
}) {
  const delivery = quote?.delivery;
  const options = [
    {
      value: 'delivery' as const,
      label: 'Home delivery',
      enabled: delivery?.deliveryEnabled ?? true,
      note: delivery?.note,
    },
    {
      value: 'pickup' as const,
      label: 'Store pickup',
      enabled: delivery?.pickupEnabled ?? true,
      note: 'Collect from the shop — no delivery charge.',
    },
  ];
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">How would you like to receive it?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex cursor-pointer flex-col rounded-2xl border p-4 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-terracotta-deep',
              value === option.value
                ? 'border-terracotta bg-terracotta-soft/50'
                : 'border-brown/15 hover:border-brown/40',
              !option.enabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <span className="flex items-center gap-2 font-semibold">
              <input
                type="radio"
                name="fulfillment"
                value={option.value}
                checked={value === option.value}
                disabled={!option.enabled}
                onChange={() => onChange(option.value)}
                className="accent-terracotta"
              />
              {option.label}
            </span>
            <span className="mt-1 text-brown-muted">
              {option.enabled ? (option.note ?? '') : 'Not available right now'}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CartView() {
  const state = useCart();
  const ready = useCartReady();
  const { quote, error, loading } = useQuote(state, ready);
  const [promo, setPromo] = useState('');

  if (!ready) return <Skeleton className="h-80" />;
  if (state.items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty"
        action={<ButtonLink href="/shop">Browse products</ButtonLink>}
      >
        Fill it with something handmade — a matka for cool water, a handi for slow cooking, or a
        planter for your balcony.
      </EmptyState>
    );
  }

  const lines = quote?.lines;
  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <section aria-label="Cart items" className="lg:col-span-7">
        <ul className="divide-y divide-brown/10 border-y border-brown/10">
          {state.items.map((item) => {
            const line = lines?.find(
              (entry) => entry.productId === item.productId && entry.variantId === item.variantId,
            );
            const unit = line?.unitPrice ?? item.unitPrice;
            const max = line?.maxQuantity || 20;
            return (
              <li key={`${item.productId}:${item.variantId ?? ''}`} className="flex gap-4 py-5">
                <Link
                  href={`/products/${item.slug}`}
                  className="shrink-0 overflow-hidden rounded-2xl bg-cream-deep"
                >
                  {line?.image ? (
                    <ProductImage
                      image={line.image}
                      sizes="96px"
                      className="size-24"
                      alt={item.name}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- cached thumbnail URL
                    <img
                      src={item.image ?? '/brand/v1/emblem-256.webp'}
                      alt={item.name}
                      width={96}
                      height={96}
                      className="size-24 object-cover"
                    />
                  )}
                </Link>
                <div className="flex flex-1 flex-col">
                  <div className="flex justify-between gap-3">
                    <div>
                      <Link
                        href={`/products/${item.slug}`}
                        className="font-display text-lg font-medium hover:text-terracotta-deep"
                      >
                        {line?.name ?? item.name}
                      </Link>
                      {item.variantName ? (
                        <p className="text-sm text-brown-muted">{item.variantName}</p>
                      ) : null}
                      <p className="mt-1 text-sm text-brown-muted">{formatINR(unit)} each</p>
                    </div>
                    <p className="font-semibold">
                      {line ? formatINR(line.lineSubtotal) : formatINR(unit * item.quantity)}
                    </p>
                  </div>
                  {line?.issue ? (
                    <p
                      className="mt-2 rounded-xl bg-danger/8 px-3 py-2 text-sm font-medium text-danger"
                      role="alert"
                    >
                      {line.issue.message}
                    </p>
                  ) : null}
                  <div className="mt-3 flex items-center gap-4">
                    <div
                      className="flex h-10 items-center rounded-full border border-brown/20"
                      role="group"
                      aria-label={`Quantity of ${item.name}`}
                    >
                      <button
                        type="button"
                        className="size-10 rounded-full hover:bg-brown/5"
                        onClick={() => cart.setQuantity(item, item.quantity - 1)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        className="size-10 rounded-full hover:bg-brown/5 disabled:opacity-40"
                        onClick={() => cart.setQuantity(item, item.quantity + 1)}
                        disabled={item.quantity >= max}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    {line?.issue?.code === 'insufficient_stock' && line.maxQuantity > 0 ? (
                      <button
                        type="button"
                        className="text-sm font-semibold text-terracotta-deep underline"
                        onClick={() => cart.setQuantity(item, line.maxQuantity)}
                      >
                        Set to {line.maxQuantity}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-sm text-brown-muted underline-offset-4 hover:underline"
                      onClick={() => cart.remove(item)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="lg:col-span-5" aria-label="Order summary">
        <div className="rounded-[1.75rem] bg-cream-deep p-6 lg:sticky lg:top-28">
          <h2 className="text-2xl font-medium">Summary</h2>
          <div className="mt-5">
            <FulfillmentPicker
              quote={quote}
              value={state.fulfillment}
              onChange={(value) => cart.setFulfillment(value)}
            />
          </div>
          <form
            className="mt-5 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              cart.setPromoCode(promo || null);
            }}
          >
            <label htmlFor="promo" className="sr-only">
              Promo code
            </label>
            <input
              id="promo"
              value={promo}
              onChange={(event) => setPromo(event.target.value.toUpperCase())}
              placeholder={state.promoCode ?? 'Promo code'}
              maxLength={24}
              className="h-11 flex-1 rounded-full border border-brown/20 bg-white/80 px-4 text-sm uppercase focus:border-terracotta-deep focus:outline-none"
            />
            <Button type="submit" variant="dark">
              Apply
            </Button>
          </form>
          {quote?.promoCode ? (
            <p
              className={cn(
                'mt-2 text-sm',
                quote.promoCode.status === 'applied' ? 'text-[#3f4d35]' : 'text-danger',
              )}
              role="status"
            >
              {quote.promoCode.code}: {quote.promoCode.message}{' '}
              <button type="button" className="underline" onClick={() => cart.setPromoCode(null)}>
                Remove
              </button>
            </p>
          ) : null}
          <div className="mt-6" aria-busy={loading}>
            {quote ? <QuoteTotals quote={quote} /> : <Skeleton className="h-32" />}
          </div>
          {error ? (
            <p className="mt-3 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <ButtonLink
            href="/checkout"
            size="lg"
            className="mt-6 w-full"
            aria-disabled={!quote?.canCheckout || loading}
            onClick={(event) => {
              if (!quote?.canCheckout) event.preventDefault();
            }}
          >
            Proceed to checkout
          </ButtonLink>
          {quote && !quote.canCheckout ? (
            <p className="mt-2 text-center text-sm text-brown-muted">
              Please resolve the highlighted items to continue.
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
