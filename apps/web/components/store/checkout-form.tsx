'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { INDIAN_STATES, type CheckoutChannel, type CreateOrderResponse } from '@jmh/shared';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/form';
import { api, ClientApiError } from '@/lib/api/client';
import { cart, useCart, useCartReady } from '@/lib/cart';
import { useQuote } from '@/lib/use-quote';
import { cn } from '@/lib/utils';
import { FulfillmentPicker } from './cart-view';
import { QuoteTotals } from './order-summary';
import { WhatsAppIcon } from './site-footer';

const IDEMPOTENCY_STORAGE = 'jmh.checkout.idempotency';

/** One key per checkout attempt, kept across retries/reloads so the server never creates duplicates. */
function idempotencyKey(): string {
  try {
    const existing = sessionStorage.getItem(IDEMPOTENCY_STORAGE);
    if (existing) return existing;
    const key = crypto.randomUUID();
    sessionStorage.setItem(IDEMPOTENCY_STORAGE, key);
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

type Errors = Record<string, string[]>;

export function CheckoutForm() {
  const router = useRouter();
  const search = useSearchParams();
  const state = useCart();
  const ready = useCartReady();
  const { quote } = useQuote(state, ready);
  const [channel, setChannel] = useState<CheckoutChannel>(
    search.get('channel') === 'website' ? 'website' : 'whatsapp',
  );
  const [differentWhatsapp, setDifferentWhatsapp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  if (!ready) return <Skeleton className="h-96" />;
  if (state.items.length === 0) {
    return (
      <EmptyState
        title="Nothing to check out yet"
        action={<ButtonLink href="/shop">Browse products</ButtonLink>}
      >
        Your cart is empty.
      </EmptyState>
    );
  }

  const delivery = state.fulfillment === 'delivery';
  const fieldError = (path: string) => errors[path];

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return; // double-click guard
    submittingRef.current = true;
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    const body = {
      items: state.items.map(({ productId, variantId, quantity }) => ({
        productId,
        variantId,
        quantity,
      })),
      promoCode: state.promoCode,
      fulfillment: state.fulfillment,
      channel,
      customer: {
        name: text('name'),
        phone: text('phone'),
        ...(differentWhatsapp && text('whatsapp') ? { whatsapp: text('whatsapp') } : {}),
      },
      address: delivery
        ? {
            line1: text('line1'),
            line2: text('line2') || undefined,
            landmark: text('landmark') || undefined,
            city: text('city'),
            state: text('state'),
            pincode: text('pincode'),
          }
        : null,
      notes: text('notes') || undefined,
    };
    try {
      const response = await api<{ data: CreateOrderResponse }>('/orders', {
        body,
        headers: { 'idempotency-key': idempotencyKey() },
      });
      const { order, accessToken } = response.data;
      try {
        sessionStorage.removeItem(IDEMPOTENCY_STORAGE);
      } catch {
        // ignore
      }
      cart.clear();
      router.replace(`/order/${order.orderNumber}?token=${encodeURIComponent(accessToken)}`);
    } catch (error) {
      submittingRef.current = false;
      setSubmitting(false);
      if (error instanceof ClientApiError) {
        setErrors(error.fields);
        // A changed cart is a new checkout attempt and needs a fresh key.
        if (
          [
            'CART_CHANGED',
            'OUT_OF_STOCK',
            'IDEMPOTENCY_KEY_REUSED',
            'VALIDATION_ERROR',
            'PROMO_CODE_REJECTED',
          ].includes(error.code)
        ) {
          try {
            sessionStorage.removeItem(IDEMPOTENCY_STORAGE);
          } catch {
            // ignore
          }
        }
        setFormError(
          error.code === 'CART_CHANGED' || error.code === 'OUT_OF_STOCK'
            ? `${error.message} Return to your cart to review it.`
            : error.message,
        );
        if (error.status === 0) {
          // Network failure: the same idempotency key is reused on retry, so a duplicate is impossible.
          setFormError(
            'We could not confirm your order because the connection dropped. Please press “Place order” again — you will not be charged or ordered twice.',
          );
        }
      } else {
        setFormError('Something went wrong. Please try again.');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-10 lg:grid-cols-12">
      <div className="space-y-8 lg:col-span-7">
        <FormError message={formError} />
        {formError && (errors['items.0'] || formError.includes('cart')) ? (
          <Link href="/cart" className="text-sm font-semibold text-terracotta-deep underline">
            Review your cart →
          </Link>
        ) : null}

        <section aria-labelledby="contact-title" className="space-y-4">
          <h2 id="contact-title" className="text-2xl font-medium">
            Your details
          </h2>
          <Field label="Full name" required error={fieldError('customer.name')}>
            {(props) => <Input {...props} name="name" autoComplete="name" maxLength={80} />}
          </Field>
          <Field
            label="Mobile number"
            required
            error={fieldError('customer.phone')}
            hint="10-digit Indian mobile. We only use it about this order."
          >
            {(props) => (
              <Input
                {...props}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                maxLength={16}
                placeholder="98765 43210"
              />
            )}
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={differentWhatsapp}
              onChange={(event) => setDifferentWhatsapp(event.target.checked)}
              className="size-4 accent-terracotta"
            />
            My WhatsApp number is different
          </label>
          {differentWhatsapp ? (
            <Field label="WhatsApp number" error={fieldError('customer.whatsapp')}>
              {(props) => (
                <Input {...props} name="whatsapp" type="tel" inputMode="tel" maxLength={16} />
              )}
            </Field>
          ) : null}
        </section>

        <section aria-labelledby="fulfil-title" className="space-y-4">
          <h2 id="fulfil-title" className="text-2xl font-medium">
            Delivery or pickup
          </h2>
          <FulfillmentPicker
            quote={quote}
            value={state.fulfillment}
            onChange={(value) => cart.setFulfillment(value)}
          />
          {delivery ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="House / flat, street"
                required
                error={fieldError('address.line1')}
                className="sm:col-span-2"
              >
                {(props) => (
                  <Input {...props} name="line1" autoComplete="address-line1" maxLength={160} />
                )}
              </Field>
              <Field label="Area / locality" error={fieldError('address.line2')}>
                {(props) => (
                  <Input {...props} name="line2" autoComplete="address-line2" maxLength={160} />
                )}
              </Field>
              <Field label="Landmark" error={fieldError('address.landmark')}>
                {(props) => <Input {...props} name="landmark" maxLength={120} />}
              </Field>
              <Field label="City" required error={fieldError('address.city')}>
                {(props) => (
                  <Input {...props} name="city" autoComplete="address-level2" maxLength={80} />
                )}
              </Field>
              <Field label="PIN code" required error={fieldError('address.pincode')}>
                {(props) => (
                  <Input
                    {...props}
                    name="pincode"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={6}
                  />
                )}
              </Field>
              <Field
                label="State"
                required
                error={fieldError('address.state')}
                className="sm:col-span-2"
              >
                {(props) => (
                  <Select {...props} name="state" defaultValue="" autoComplete="address-level1">
                    <option value="" disabled>
                      Select state
                    </option>
                    {INDIAN_STATES.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          ) : null}
          <Field label="Order notes (optional)" error={fieldError('notes')}>
            {(props) => (
              <Textarea
                {...props}
                name="notes"
                maxLength={500}
                placeholder="Preferred delivery time, gift note…"
              />
            )}
          </Field>
        </section>

        <section aria-labelledby="channel-title">
          <h2 id="channel-title" className="mb-4 text-2xl font-medium">
            How would you like to confirm?
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                [
                  'whatsapp',
                  'Confirm on WhatsApp',
                  'Your order is saved, then WhatsApp opens with the details filled in for you to send.',
                ],
                [
                  'website',
                  'Place order on website',
                  'Your order is saved and the shop contacts you to confirm availability and delivery.',
                ],
              ] as const
            ).map(([value, title, body]) => (
              <label
                key={value}
                className={cn(
                  'cursor-pointer rounded-2xl border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-terracotta-deep',
                  channel === value
                    ? 'border-terracotta bg-terracotta-soft/50'
                    : 'border-brown/15 hover:border-brown/40',
                )}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <input
                    type="radio"
                    name="channel"
                    value={value}
                    checked={channel === value}
                    onChange={() => setChannel(value)}
                    className="accent-terracotta"
                  />
                  {title}
                </span>
                <span className="mt-1 block text-sm text-brown-muted">{body}</span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <aside className="lg:col-span-5" aria-label="Order summary">
        <div className="rounded-[1.75rem] bg-cream-deep p-6 lg:sticky lg:top-28">
          <h2 className="text-2xl font-medium">Order summary</h2>
          <ul className="mt-4 space-y-2 text-[0.9375rem]">
            {(quote?.lines ?? []).map((line) => (
              <li key={line.key} className="flex justify-between gap-3">
                <span>
                  {line.name}
                  {line.variantName ? ` (${line.variantName})` : ''} × {line.quantity}
                </span>
              </li>
            ))}
          </ul>
          <div className="gold-rule my-5" />
          {quote ? <QuoteTotals quote={quote} /> : <Skeleton className="h-32" />}
          {quote?.lines.some((line) => line.issue) ? (
            <p className="mt-3 text-sm text-danger" role="alert">
              Some items need attention.{' '}
              <Link href="/cart" className="underline">
                Review cart
              </Link>
            </p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            variant={channel === 'whatsapp' ? 'whatsapp' : 'primary'}
            className="mt-6 w-full"
            loading={submitting}
            disabled={!quote?.canCheckout}
            icon={channel === 'whatsapp' ? <WhatsAppIcon className="size-5" /> : undefined}
          >
            {channel === 'whatsapp' ? 'Place order & continue to WhatsApp' : 'Place order'}
          </Button>
          <p className="mt-3 text-center text-xs leading-relaxed text-brown-muted">
            No online payment is taken. Prices are confirmed by our server when you place the order.
          </p>
        </div>
      </aside>
    </form>
  );
}
