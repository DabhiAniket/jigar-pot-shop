'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  formatINR,
  ORDER_STATUS_LABELS,
  type CustomerOrderDTO,
  type OrderStatus,
} from '@jmh/shared';
import { CopyButton } from '@/components/store/copy-button';
import { OrderDetails } from '@/components/store/order-details';
import { WhatsAppIcon } from '@/components/store/site-footer';
import { Button } from '@/components/ui/button';
import { Field, FormError, Textarea } from '@/components/ui/form';
import { Badge, Skeleton } from '@/components/ui/misc';
import { api, ClientApiError } from '@/lib/api/client';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useRequireCustomer } from './account-overview';
import { STATUS_TONE } from './orders-list';

const STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;
const STEP_RANK: Partial<Record<OrderStatus, number>> = {
  pending: 0,
  awaiting_confirmation: 0,
  confirmed: 1,
  processing: 2,
  ready_for_dispatch: 2,
  shipped: 3,
  delivered: 4,
};

function Tracker({ order }: { order: CustomerOrderDTO }) {
  const reached = Math.max(0, ...order.timeline.map((event) => STEP_RANK[event.status] ?? -1));
  const ended = order.status === 'cancelled' || order.status === 'refunded';
  return (
    <ol
      className="grid grid-cols-5 gap-1 text-center text-xs sm:text-sm"
      aria-label="Order progress"
    >
      {STEPS.map((step, index) => {
        const done = index <= reached;
        const at = order.timeline.find((event) => STEP_RANK[event.status] === index)?.at;
        return (
          <li
            key={step}
            aria-current={!ended && index === reached ? 'step' : undefined}
            className="flex flex-col items-center gap-1"
          >
            <span
              className={`h-1.5 w-full rounded-full ${done ? (ended ? 'bg-brown/30' : 'bg-terracotta') : 'bg-brown/10'}`}
            />
            <span className={done ? 'font-semibold' : 'text-brown-muted'}>
              {ORDER_STATUS_LABELS[step]}
            </span>
            {at ? <span className="text-brown-muted">{formatDate(at)}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function OrderDetail({ orderNumber }: { orderNumber: string }) {
  const customer = useRequireCustomer(`/account/orders/${orderNumber}`);
  const placed = useSearchParams().get('placed') === '1';
  const [order, setOrder] = useState<CustomerOrderDTO | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!customer) return;
    let active = true;
    api<{ data: CustomerOrderDTO }>(`/account/orders/${encodeURIComponent(orderNumber)}`)
      .then((response) => active && setOrder(response.data))
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof ClientApiError && reason.status === 404) setNotFound(true);
        else
          setError(
            reason instanceof ClientApiError ? reason.message : 'Could not load this order.',
          );
      });
    return () => {
      active = false;
    };
  }, [customer, orderNumber]);

  if (notFound)
    return (
      <div role="alert" className="rounded-3xl border border-brown/15 p-8 text-center">
        <h2 className="text-2xl font-medium">Order not found</h2>
        <p className="mt-2 text-brown-muted">
          We could not find this order in your account. Orders are private to the account that
          placed them.
        </p>
        <Link
          href="/account/orders"
          className="mt-4 inline-block font-semibold text-terracotta-deep"
        >
          Back to my orders
        </Link>
      </div>
    );
  if (error)
    return (
      <p role="alert" className="text-danger">
        {error}
      </p>
    );
  if (!customer || !order) return <Skeleton className="h-96" />;

  const shipment = order.shipment;
  const request = order.cancellationRequest;

  return (
    <div className="space-y-8">
      {placed ? (
        <div className="rounded-[2rem] border border-gold/40 bg-cream-deep/60 p-6 text-center">
          <p className="eyebrow">Order received</p>
          <h2 className="mt-2 text-3xl font-medium">Thank you, {customer.name.split(' ')[0]}!</h2>
          <p className="mt-2 text-brown-muted">Your order is saved to your account.</p>
          {order.whatsappUrl && order.channel === 'whatsapp' ? (
            <a
              href={order.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#1f7a4d] px-6 py-3 font-semibold text-white"
            >
              <WhatsAppIcon className="size-5" />
              Send your order on WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-brown-muted">Order number</p>
          <p className="flex items-center gap-2 font-mono text-xl font-bold tracking-wider">
            <span data-testid="order-number">{order.orderNumber}</span>
            <CopyButton value={order.orderNumber} />
          </p>
          <p className="text-sm text-brown-muted">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="text-right">
          <Badge tone={STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
          <p className="mt-1 text-lg font-semibold">{formatINR(order.pricing.total)}</p>
        </div>
      </div>

      <Tracker order={order} />

      {order.status === 'cancelled' ? (
        <div role="status" className="rounded-2xl bg-danger/10 p-4">
          <p className="font-semibold text-danger">
            {order.cancelledBy === 'customer_request'
              ? 'Cancelled at your request'
              : 'Cancelled by the store'}
          </p>
          {order.cancellationReason ? (
            <p className="mt-1 text-sm">{order.cancellationReason}</p>
          ) : null}
        </div>
      ) : null}

      {shipment ? (
        <section
          aria-labelledby="shipment-title"
          className="rounded-2xl border border-brown/15 p-5"
        >
          <h2 id="shipment-title" className="text-xl font-medium">
            Shipment
          </h2>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <dt className="text-brown-muted">Courier</dt>
            <dd className="font-semibold">{shipment.provider}</dd>
            <dt className="text-brown-muted">Tracking number</dt>
            <dd className="font-mono font-semibold">{shipment.trackingNumber}</dd>
            <dt className="text-brown-muted">Shipped on</dt>
            <dd>{formatDate(shipment.shippedAt)}</dd>
            {shipment.estimatedDelivery ? (
              <>
                <dt className="text-brown-muted">Expected by</dt>
                <dd>{formatDate(shipment.estimatedDelivery)}</dd>
              </>
            ) : null}
            {shipment.notes ? (
              <>
                <dt className="text-brown-muted">Note</dt>
                <dd>{shipment.notes}</dd>
              </>
            ) : null}
          </dl>
          {shipment.trackingUrl ? (
            <a
              href={shipment.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block font-semibold text-terracotta-deep underline"
            >
              Track with {shipment.provider}
            </a>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="payment-title" className="rounded-2xl bg-cream-deep p-5">
        <h2 id="payment-title" className="text-xl font-medium">
          Payment
        </h2>
        <p className="mt-1 text-sm text-brown-muted">{order.payment.note}</p>
        {order.payment.status === 'refunded' ? (
          <p className="mt-1 text-sm font-semibold">
            This order is marked as refunded by the store.
          </p>
        ) : null}
      </section>

      {request ? (
        <section aria-labelledby="cancel-title" className="rounded-2xl border border-brown/15 p-5">
          <h2 id="cancel-title" className="text-xl font-medium">
            Cancellation request
          </h2>
          <p className="mt-1 text-sm">
            <Badge
              tone={
                request.status === 'requested'
                  ? 'gold'
                  : request.status === 'approved'
                    ? 'sage'
                    : 'danger'
              }
            >
              {request.status === 'requested'
                ? 'Waiting for the store'
                : request.status === 'approved'
                  ? 'Approved'
                  : 'Not approved'}
            </Badge>
          </p>
          <p className="mt-2 text-sm text-brown-muted">
            You asked on {formatDateTime(request.requestedAt)}: “{request.reason}”
          </p>
          {request.resolvedAt ? (
            <p className="mt-1 text-sm text-brown-muted">
              Answered on {formatDateTime(request.resolvedAt)}
              {request.resolutionNote ? ` — ${request.resolutionNote}` : ''}
            </p>
          ) : null}
        </section>
      ) : null}

      {order.canRequestCancellation ? (
        asking ? (
          <form
            className="space-y-3 rounded-2xl border border-brown/15 p-5"
            onSubmit={async (event) => {
              event.preventDefault();
              const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
              setBusy(true);
              setReasonError(null);
              try {
                const response = await api<{ data: CustomerOrderDTO }>(
                  `/account/orders/${encodeURIComponent(order.orderNumber)}/cancellation-request`,
                  { body: { reason } },
                );
                setOrder(response.data);
                setAsking(false);
              } catch (reasonObj) {
                setReasonError(
                  reasonObj instanceof ClientApiError
                    ? reasonObj.message
                    : 'Could not send your request.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <FormError message={reasonError} />
            <Field label="Why do you want to cancel?" required>
              {(props) => (
                <Textarea {...props} name="reason" maxLength={300} minLength={5} required />
              )}
            </Field>
            <p className="text-sm text-brown-muted">
              The store reviews your request. The order is cancelled only once they approve it.
            </p>
            <div className="flex gap-3">
              <Button type="submit" variant="danger" loading={busy}>
                Send request
              </Button>
              <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
                Keep my order
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="secondary" onClick={() => setAsking(true)}>
            Request cancellation
          </Button>
        )
      ) : null}

      <OrderDetails order={order} />
    </div>
  );
}
