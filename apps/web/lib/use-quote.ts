'use client';

import { useEffect, useState } from 'react';
import type { CartQuote } from '@jmh/shared';
import { api, ClientApiError } from './api/client';
import type { CartState } from './cart';

/**
 * Asks the API to price the cart. Totals shown to the customer always come from here — the
 * browser never calculates prices, discounts or delivery charges itself.
 */
export function useQuote(cartState: CartState, ready: boolean) {
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify({
    items: cartState.items.map(({ productId, variantId, quantity }) => ({
      productId,
      variantId,
      quantity,
    })),
    promoCode: cartState.promoCode,
    fulfillment: cartState.fulfillment,
  });

  useEffect(() => {
    if (!ready) return;
    const body = JSON.parse(key) as {
      items: unknown[];
      promoCode: string | null;
      fulfillment: string;
    };
    if (body.items.length === 0) {
      const timer = setTimeout(() => {
        setQuote(null);
        setLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      api<{ data: CartQuote }>('/cart/quote', { body, signal: controller.signal })
        .then((response) => {
          setQuote(response.data);
          setError(null);
        })
        .catch((reason) => {
          if ((reason as Error).name === 'AbortError') return;
          setError(reason instanceof ClientApiError ? reason.message : 'Could not update prices.');
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, ready]);

  return { quote, error, loading };
}
