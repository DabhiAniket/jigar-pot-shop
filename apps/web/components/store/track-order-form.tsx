'use client';

import { useState } from 'react';
import type { PublicOrderDTO } from '@jmh/shared';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input } from '@/components/ui/form';
import { api, ClientApiError } from '@/lib/api/client';
import { OrderDetails } from './order-details';

/** POSTs the lookup so the phone number stays out of URLs, browser history and server logs. */
export function TrackOrderForm() {
  const [order, setOrder] = useState<PublicOrderDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  return (
    <>
      <form
        className="mt-8 grid max-w-2xl gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setLoading(true);
          setError(null);
          setFields({});
          try {
            const response = await api<{ data: PublicOrderDTO }>('/orders/track', {
              body: {
                orderNumber: String(data.get('orderNumber') ?? '').trim(),
                phone: String(data.get('phone') ?? '').trim(),
              },
            });
            setOrder(response.data);
          } catch (reason) {
            setOrder(null);
            if (reason instanceof ClientApiError) {
              setFields(reason.fields);
              setError(reason.message);
            }
          } finally {
            setLoading(false);
          }
        }}
      >
        <Field label="Order number" required error={fields.orderNumber}>
          {(props) => (
            <Input
              {...props}
              name="orderNumber"
              placeholder="JMH-261022-XXXXX"
              autoCapitalize="characters"
              maxLength={20}
            />
          )}
        </Field>
        <Field label="Mobile number" required error={fields.phone}>
          {(props) => <Input {...props} name="phone" type="tel" inputMode="tel" maxLength={16} />}
        </Field>
        <Button type="submit" loading={loading} className="h-11">
          Track
        </Button>
      </form>
      <div className="mt-6 max-w-2xl">
        <FormError message={Object.keys(fields).length ? null : error} />
      </div>
      {order ? (
        <section aria-live="polite" className="mt-10">
          <h2 className="mb-6 text-2xl font-medium">
            Order <span className="font-mono">{order.orderNumber}</span>
          </h2>
          <OrderDetails order={order} />
        </section>
      ) : null}
    </>
  );
}
