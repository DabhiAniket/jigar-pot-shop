'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  formatINR,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type CustomerOrderListItem,
  type OrderStatus,
} from '@jmh/shared';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { Badge, EmptyState, Skeleton } from '@/components/ui/misc';
import { api, ClientApiError } from '@/lib/api/client';
import { formatDate } from '@/lib/utils';
import { useRequireCustomer } from './account-overview';

type Tone = 'neutral' | 'terracotta' | 'sage' | 'gold' | 'danger' | 'dark';
export const STATUS_TONE: Record<OrderStatus, Tone> = {
  pending: 'gold',
  awaiting_confirmation: 'gold',
  confirmed: 'terracotta',
  processing: 'terracotta',
  ready_for_dispatch: 'terracotta',
  shipped: 'sage',
  delivered: 'sage',
  cancelled: 'danger',
  refunded: 'neutral',
};

interface Meta {
  page: number;
  totalPages: number;
  total: number;
}

export function OrdersList() {
  const customer = useRequireCustomer('/account/orders');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<CustomerOrderListItem[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!customer) return;
    let active = true;
    const query = new URLSearchParams({ page: String(page), limit: '10' });
    if (status) query.set('status', status);
    api<{ data: CustomerOrderListItem[]; meta: Meta }>(`/account/orders?${query}`)
      .then((response) => {
        if (!active) return;
        setOrders(response.data);
        setMeta(response.meta);
        setError(null);
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof ClientApiError ? reason.message : 'Could not load orders.');
      });
    return () => {
      active = false;
    };
  }, [customer, page, status, reload]);

  if (!customer || (orders === null && !error)) return <Skeleton className="h-64" />;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold" htmlFor="order-status-filter">
          Show
        </label>
        <Select
          id="order-status-filter"
          value={status}
          onChange={(event) => {
            setOrders(null);
            setPage(1);
            setStatus(event.target.value as OrderStatus | '');
          }}
          className="w-auto min-w-48"
        >
          <option value="">All orders</option>
          {ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {ORDER_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>
      {error ? (
        <p role="alert" className="mt-6 text-danger">
          {error}
        </p>
      ) : null}
      {orders && orders.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={status ? 'No orders with this status' : 'No orders yet'}
            action={<ButtonLink href="/shop">Browse products</ButtonLink>}
          >
            Orders you place will appear here.
          </EmptyState>
        </div>
      ) : null}
      <ul className="mt-6 space-y-3">
        {orders?.map((order) => (
          <li key={order.orderNumber}>
            <Link
              href={`/account/orders/${order.orderNumber}`}
              className="flex items-center gap-4 rounded-2xl border border-brown/15 p-4 transition-colors hover:border-terracotta"
            >
              {order.firstItem?.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- pipeline thumbnail
                <img
                  src={order.firstItem.image}
                  alt=""
                  width={64}
                  height={64}
                  className="size-16 rounded-xl bg-cream-deep object-contain"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{order.firstItem?.name ?? 'Order'}</p>
                <p className="text-sm text-brown-muted">
                  {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
                </p>
                <p className="font-mono text-sm text-brown-muted">{order.orderNumber}</p>
                <p className="text-sm text-brown-muted">Placed {formatDate(order.createdAt)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="font-semibold">{formatINR(order.total)}</p>
                <Badge tone={STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
                {order.cancellationRequest === 'requested' ? (
                  <span className="text-xs text-brown-muted">Cancellation requested</span>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <ClaimOrder
        onClaimed={() => {
          setOrders(null);
          setStatus('');
          setPage(1);
          setReload((value) => value + 1);
        }}
      />
      {meta && meta.totalPages > 1 ? (
        <nav className="mt-6 flex items-center justify-between" aria-label="Order pages">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              setOrders(null);
              setPage(page - 1);
            }}
          >
            Previous
          </Button>
          <span className="text-sm text-brown-muted">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= meta.totalPages}
            onClick={() => {
              setOrders(null);
              setPage(page + 1);
            }}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

/** Orders placed before signing in can be added with the number and phone they were placed with. */
function ClaimOrder({ onClaimed }: { onClaimed: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState<string | null>(null);

  if (!open)
    return (
      <p className="mt-8 text-sm text-brown-muted">
        Placed an order before signing in?{' '}
        <button
          type="button"
          className="font-semibold text-terracotta-deep underline"
          onClick={() => setOpen(true)}
        >
          Add it to your account
        </button>
      </p>
    );

  return (
    <form
      className="mt-8 grid gap-4 rounded-2xl border border-brown/15 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setBusy(true);
        setError(null);
        setFields({});
        setDone(null);
        try {
          const response = await api<{ data: CustomerOrderListItem }>('/account/orders/claim', {
            body: {
              orderNumber: String(data.get('orderNumber') ?? '').trim(),
              phone: String(data.get('phone') ?? '').trim(),
            },
          });
          setDone(`Added order ${response.data.orderNumber} to your account.`);
          onClaimed();
        } catch (reason) {
          if (reason instanceof ClientApiError) {
            setFields(reason.fields);
            setError(
              reason.status === 404
                ? 'We could not find an unclaimed order with that number and phone.'
                : reason.message,
            );
          }
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="sm:col-span-3">
        <h2 className="text-lg font-medium">Add an earlier order</h2>
        <p className="text-sm text-brown-muted">
          Enter the order number and the mobile number used at checkout. Once added, only your
          account can see it.
        </p>
        <FormError message={error} />
        {done ? (
          <p role="status" className="text-sm text-sage">
            {done}
          </p>
        ) : null}
      </div>
      <Field label="Order number" required error={fields.orderNumber}>
        {(props) => (
          <Input {...props} name="orderNumber" placeholder="JMH-261022-XXXXX" maxLength={20} />
        )}
      </Field>
      <Field label="Mobile number" required error={fields.phone}>
        {(props) => <Input {...props} name="phone" type="tel" inputMode="tel" maxLength={16} />}
      </Field>
      <Button type="submit" loading={busy} className="h-11">
        Add order
      </Button>
    </form>
  );
}
