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
import { Select } from '@/components/ui/form';
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
  }, [customer, page, status]);

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
