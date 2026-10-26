import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FULFILLMENT_LABELS,
  formatINR,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type AdminOrderListItem,
  type Paginated,
} from '@jmh/shared';
import {
  FilterBar,
  filterInput,
  OrderStatusBadge,
  PageHeader,
  TableWrap,
} from '@/components/admin/ui';
import { OrderRowAction } from '@/components/admin/order-row-action';
import { EmptyState, Pagination } from '@/components/ui/misc';
import { adminGet } from '@/lib/api/server';
import { formatDateTime, param, toQuery } from '@/lib/utils';

export const metadata: Metadata = { title: 'Orders' };
export const dynamic = 'force-dynamic';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const query = {
    q: param(raw.q),
    status: param(raw.status),
    channel: param(raw.channel),
    cancellationRequest: param(raw.cancellationRequest),
    from: param(raw.from),
    to: param(raw.to),
    page: param(raw.page),
  };
  const orders = await adminGet<Paginated<AdminOrderListItem>>(`/orders${toQuery(query)}`);

  return (
    <>
      <PageHeader title="Orders" description={`${orders.meta.total} orders`} />
      <FilterBar action="/admin/orders">
        <input
          name="q"
          defaultValue={query.q}
          placeholder="Order number, name or phone"
          aria-label="Search orders"
          className={`${filterInput} w-64`}
        />
        <select
          name="status"
          defaultValue={query.status ?? ''}
          aria-label="Status"
          className={filterInput}
        >
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ORDER_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <select
          name="channel"
          defaultValue={query.channel ?? ''}
          aria-label="Checkout channel"
          className={filterInput}
        >
          <option value="">Any channel</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="website">Website</option>
        </select>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            name="cancellationRequest"
            value="requested"
            defaultChecked={query.cancellationRequest === 'requested'}
          />
          Cancellation requested
        </label>
        <label className="text-xs font-semibold">
          From
          <input
            type="date"
            name="from"
            defaultValue={query.from}
            className={`${filterInput} block`}
          />
        </label>
        <label className="text-xs font-semibold">
          To
          <input type="date" name="to" defaultValue={query.to} className={`${filterInput} block`} />
        </label>
      </FilterBar>
      {orders.data.length ? (
        <TableWrap>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Fulfilment</th>
              <th>Status</th>
              <th className="text-right">Items</th>
              <th className="text-right">Total</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.data.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-mono font-semibold hover:text-terracotta-deep"
                  >
                    {order.orderNumber}
                  </Link>
                  <div className="text-xs text-brown-muted">
                    {formatDateTime(order.createdAt)} ·{' '}
                    {order.channel === 'whatsapp' ? 'WhatsApp' : 'Website'}
                  </div>
                </td>
                <td>
                  {order.customerName}
                  <div className="text-xs text-brown-muted">
                    {order.phone}
                    {order.city ? ` · ${order.city}` : ''}
                  </div>
                </td>
                <td>{FULFILLMENT_LABELS[order.fulfillment]}</td>
                <td>
                  <OrderStatusBadge status={order.status} />
                  {order.cancellationRequest === 'requested' ? (
                    <div className="mt-1 text-xs font-semibold text-danger">Cancel requested</div>
                  ) : null}
                </td>
                <td className="text-right">{order.itemCount}</td>
                <td className="text-right font-semibold">{formatINR(order.total)}</td>
                <td className="text-right">
                  <OrderRowAction order={order} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <EmptyState title="No orders match">Adjust the filters or wait for new orders.</EmptyState>
      )}
      <div className="mt-6">
        <Pagination
          page={orders.meta.page}
          totalPages={orders.meta.totalPages}
          href={(page) => `/admin/orders${toQuery({ ...query, page })}`}
        />
      </div>
    </>
  );
}
