'use client';

import { useSyncExternalStore } from 'react';
import { LIMITS, type FulfillmentMethod } from '@jmh/shared';

/**
 * The cart lives in localStorage (no customer accounts). It only stores what the shopper chose;
 * prices and stock are always re-quoted by the API, and the server recalculates everything at
 * checkout. The display snapshot (name, image, price) just avoids an empty flash on load.
 */
export interface CartItem {
  productId: string;
  variantId: string | null;
  quantity: number;
  name: string;
  variantName: string | null;
  slug: string;
  image: string | null;
  unitPrice: number;
}

export interface CartState {
  items: CartItem[];
  promoCode: string | null;
  fulfillment: FulfillmentMethod;
}

const STORAGE_KEY = 'jmh.cart.v1';
const EMPTY: CartState = { items: [], promoCode: null, fulfillment: 'delivery' };

let state: CartState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load(): CartState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<CartState>;
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .filter(
            (item): item is CartItem =>
              typeof item?.productId === 'string' &&
              Number.isInteger(item.quantity) &&
              item.quantity > 0,
          )
          .slice(0, LIMITS.maxCartLines)
      : [];
    return {
      items,
      promoCode: typeof parsed.promoCode === 'string' ? parsed.promoCode : null,
      fulfillment: parsed.fulfillment === 'pickup' ? 'pickup' : 'delivery',
    };
  } catch {
    return EMPTY;
  }
}

function ensureLoaded() {
  if (!loaded && typeof window !== 'undefined') {
    state = load();
    loaded = true;
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) {
        state = load();
        listeners.forEach((listener) => listener());
      }
    });
  }
}

function commit(next: CartState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or quota exceeded: the cart still works for this page view.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => {
  ensureLoaded();
  return state;
};
const getServerSnapshot = () => EMPTY;

export function useCart(): CartState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** True once the browser cart has been read (avoids rendering "empty cart" during hydration). */
export function useCartReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export function cartCount(cart: CartState): number {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

const sameLine = (
  a: Pick<CartItem, 'productId' | 'variantId'>,
  b: Pick<CartItem, 'productId' | 'variantId'>,
) => a.productId === b.productId && (a.variantId ?? null) === (b.variantId ?? null);

export const cart = {
  add(item: CartItem, maxQuantity: number = LIMITS.maxLineQuantity) {
    ensureLoaded();
    const existing = state.items.find((line) => sameLine(line, item));
    const cap = Math.max(1, Math.min(maxQuantity, LIMITS.maxLineQuantity));
    const items = existing
      ? state.items.map((line) =>
          sameLine(line, item)
            ? { ...line, ...item, quantity: Math.min(cap, line.quantity + item.quantity) }
            : line,
        )
      : [...state.items, { ...item, quantity: Math.min(cap, item.quantity) }].slice(
          -LIMITS.maxCartLines,
        );
    commit({ ...state, items });
  },
  setQuantity(line: Pick<CartItem, 'productId' | 'variantId'>, quantity: number) {
    ensureLoaded();
    const items =
      quantity <= 0
        ? state.items.filter((item) => !sameLine(item, line))
        : state.items.map((item) =>
            sameLine(item, line)
              ? { ...item, quantity: Math.min(quantity, LIMITS.maxLineQuantity) }
              : item,
          );
    commit({ ...state, items });
  },
  remove(line: Pick<CartItem, 'productId' | 'variantId'>) {
    this.setQuantity(line, 0);
  },
  setPromoCode(promoCode: string | null) {
    ensureLoaded();
    commit({ ...state, promoCode: promoCode?.trim().toUpperCase() || null });
  },
  setFulfillment(fulfillment: FulfillmentMethod) {
    ensureLoaded();
    commit({ ...state, fulfillment });
  },
  clear() {
    ensureLoaded();
    commit({ ...EMPTY, fulfillment: state.fulfillment });
  },
};

const RECENT_KEY = 'jmh.recent.v1';

export function rememberViewed(productId: string) {
  try {
    const current = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
    const next = [productId, ...current.filter((id) => id !== productId)].slice(0, 12);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

export function recentlyViewed(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id))
      : [];
  } catch {
    return [];
  }
}
