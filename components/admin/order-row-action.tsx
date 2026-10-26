'use client';

import { useState } from 'react';
import { ORDER_STATUS_LABELS, type AdminOrderDetail, type AdminOrderListItem } from '@jmh/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { api, ClientApiError } from '@/lib/api/client';
import { useAdmin } from './admin-context';
import { OrderActions } from './order-actions';
import { OrderStatusBadge } from './ui';
import { useRouter } from 'next/navigation';

/**
 * Update an order straight from its row in the list: status, shipment details and
 * cancellation requests, without opening the order page. The list itself refreshes after every
 * change (the mutations call router.refresh()).
 */
export function OrderRowAction({ order }: { order: AdminOrderListItem }) {
  const { can } = useAdmin();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actionable =
    can('orders:write') &&
    (order.allowedTransitions.length > 0 || order.cancellationRequest === 'requested');
  if (!actionable) return null;

  async function openDialog() {
    setOpen(true);
    setError(null);
    setDetail(null);
    try {
      setDetail((await api<{ data: AdminOrderDetail }>(`/admin/orders/${order.id}`)).data);
    } catch (reason) {
      setError(reason instanceof ClientApiError ? reason.message : 'Could not load this order.');
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant={order.cancellationRequest === 'requested' ? 'danger' : 'secondary'}
        onClick={openDialog}
        aria-label={`Update order ${order.orderNumber}`}
      >
        Update status
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          router.refresh();
        }}
        size="lg"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{order.orderNumber}</span>
            {detail ? <OrderStatusBadge status={detail.status} /> : null}
          </span>
        }
        description={
          detail
            ? `${detail.customer.name} · currently ${ORDER_STATUS_LABELS[detail.status]}`
            : undefined
        }
      >
        {error ? (
          <div role="alert" className="space-y-3">
            <p className="text-danger">{error}</p>
            <Button size="sm" variant="secondary" onClick={openDialog}>
              Try again
            </Button>
          </div>
        ) : !detail ? (
          <div className="flex justify-center py-10">
            <Spinner label="Loading order" />
          </div>
        ) : (
          // Remount after each save so the form starts from the order's new state.
          <OrderActions
            key={`${detail.status}:${detail.updatedAt}`}
            order={detail}
            compact
            onUpdated={setDetail}
          />
        )}
      </Dialog>
    </>
  );
}
