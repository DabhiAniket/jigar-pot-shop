'use client';

import { useSyncExternalStore } from 'react';
import type { CustomerMe } from '@jmh/shared';
import { api, ClientApiError, setCustomerCsrfToken } from './api/client';
import { cart, setCartRemote } from './cart';

/**
 * The signed-in shopper. The session itself is an httpOnly cookie the browser cannot read, so
 * this store only mirrors what the API says (GET /account/me). `ready` is false until the first
 * answer, so pages never flash a "sign in" prompt at someone who is already signed in.
 */
interface CustomerState {
  ready: boolean;
  customer: CustomerMe | null;
}

const HINT_KEY = 'jmh.customer.hint';
const INITIAL: CustomerState = { ready: false, customer: null };
let state = INITIAL;
let started = false;
const listeners = new Set<() => void>();

function set(next: CustomerState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function setHint(on: boolean) {
  try {
    if (on) window.localStorage.setItem(HINT_KEY, '1');
    else window.localStorage.removeItem(HINT_KEY);
  } catch {
    // storage unavailable: the hint only saves a request for visitors who never signed in
  }
}

function hasHint(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return true;
  }
}

function applySession(me: CustomerMe, merge: boolean) {
  setCustomerCsrfToken(me.csrfToken);
  setCartRemote(true);
  setHint(true);
  set({ ready: true, customer: me });
  void cart.syncWithAccount({ merge }).catch(() => undefined);
}

/** Asks the API who is signed in. Anonymous visitors skip the request unless `force` is set. */
export async function loadCustomer(options: { force?: boolean } = {}): Promise<void> {
  if (!options.force && !hasHint()) {
    if (!state.ready) set({ ready: true, customer: null });
    return;
  }
  try {
    const response = await api<{ data: CustomerMe }>('/account/me');
    applySession(response.data, false);
  } catch (reason) {
    if (reason instanceof ClientApiError && reason.status === 401) setHint(false);
    setCustomerCsrfToken(null);
    setCartRemote(false);
    set({ ready: true, customer: null });
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const response = await api<{ data: CustomerMe }>('/account/login', {
    body: { email, password },
  });
  applySession(response.data, true);
}

export async function signUp(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<void> {
  const response = await api<{ data: CustomerMe }>('/account/register', { body: input });
  applySession(response.data, true);
}

export async function signOut(): Promise<void> {
  await api('/account/logout', { method: 'POST' }).catch(() => undefined);
  setCustomerCsrfToken(null);
  setCartRemote(false);
  setHint(false);
  // The account's cart stays saved on the server; this shared browser must not keep showing it.
  cart.clear();
  set({ ready: true, customer: null });
}

/** Keeps the store in step after a profile or address change. */
export function updateCustomer(me: CustomerMe): void {
  set({ ready: true, customer: me });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started && typeof window !== 'undefined') {
    started = true;
    void loadCustomer();
  }
  return () => listeners.delete(listener);
}

export function useCustomer(): CustomerState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
}
