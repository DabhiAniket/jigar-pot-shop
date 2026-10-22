import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  FULFILLMENT_LABELS,
  formatIndianMobile,
  formatINR,
  ORDER_STATUS_LABELS,
  type AdminOrderDetail,
} from '@jmh/shared';
import { OrderActions } from '@/components/admin/order-actions';
import { Card, OrderStatusBadge, PageHeader, TableWrap } from '@/components/admin/ui';
import { TotalsTable } from '@/components/store/order-summary';
import { adminGetOrNull } from '@/lib/api/server';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Order' };
export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();
  const response = await adminGetOrNull<{ data: AdminOrderDetail }>(`/orders/${id}`);
  if (!response) notFound();
  const order = response.data;

  return (
    <>
      <PageHeader
        back={{ href: '/admin/orders', label: 'Orders' }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{order.orderNumber}</span>{' '}
            <OrderStatusBadge status={order.status} />
          </span>
        }
        description={`Placed ${formatDateTime(order.createdAt)} via ${order.channel === 'whatsapp' ? 'WhatsApp checkout' : 'website checkout'} · ${FULFILLMENT_LABELS[order.fulfillment]}`}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Items">
            <TableWrap>
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-right">Unit</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Discount</th>
                  <th className="text-right">Line total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={`${item.productId}:${item.variantId ?? ''}`}>
                    <td>
                      <span className="font-semibold">{item.name}</span>
                      {item.variantName ? ` (${item.variantName})` : ''}
                      <div className="text-xs text-brown-muted">{item.sku ?? 'No SKU'}</div>
                    </td>
                    <td className="text-right">
                      {formatINR(item.unitPrice)}
                      {item.listPrice !== item.unitPrice ? (
                        <div className="text-xs text-brown-muted line-through">
                          {formatINR(item.listPrice)}
                        </div>
                      ) : null}
                    </td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-right">
                      {item.lineDiscount ? `−${formatINR(item.lineDiscount)}` : '—'}
                    </td>
                    <td className="text-right font-semibold">{formatINR(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <TotalsTable
              className="mt-5 ml-auto max-w-sm"
              subtotal={order.pricing.subtotal}
              discountTotal={order.pricing.discountTotal}
              deliveryCharge={order.pricing.deliveryCharge}
              total={order.pricing.total}
              fulfillment={order.fulfillment}
              promotionName={
                order.pricing.appliedPromotion
                  ? `${order.pricing.appliedPromotion.name}${order.pricing.appliedPromotion.code ? ` · ${order.pricing.appliedPromotion.code}` : ''}`
                  : null
              }
            />
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Customer">
              <p className="font-semibold">{order.customer.name}</p>
              <p className="mt-1 text-sm">
                <a href={`tel:+91${order.customer.phone}`} className="hover:text-terracotta-deep">
                  {formatIndianMobile(order.customer.phone)}
                </a>
              </p>
              {order.customer.whatsapp ? (
                <p className="text-sm text-brown-muted">
                  WhatsApp: {formatIndianMobile(order.customer.whatsapp)}
                </p>
              ) : null}
              {order.notes ? (
                <p className="mt-3 rounded-xl bg-cream p-3 text-sm">
                  <span className="font-semibold">Customer note: </span>
                  {order.notes}
                </p>
              ) : null}
            </Card>
            <Card title={FULFILLMENT_LABELS[order.fulfillment]}>
              {order.address ? (
                <address className="text-sm not-italic leading-relaxed">
                  {order.address.line1}
                  {order.address.line2 ? <br /> : null}
                  {order.address.line2}
                  {order.address.landmark ? (
                    <>
                      <br />
                      Near {order.address.landmark}
                    </>
                  ) : null}
                  <br />
                  {order.address.city}, {order.address.state} {order.address.pincode}
                </address>
              ) : (
                <p className="text-sm text-brown-muted">Customer collects from the store.</p>
              )}
              {order.cancellationReason ? (
                <p className="mt-3 text-sm text-danger">Cancelled: {order.cancellationReason}</p>
              ) : null}
              <p className="mt-3 text-xs text-brown-muted">
                Stock {order.inventory.committed ? 'reserved at checkout' : 'not tracked'}
                {order.inventory.restockedAt
                  ? ` · returned ${formatDateTime(order.inventory.restockedAt)}`
                  : ''}
              </p>
            </Card>
          </div>

          <Card title="Status history">
            <ol className="space-y-4 border-l border-gold/50 pl-5">
              {order.statusHistory.map((event) => (
                <li key={`${event.to}-${event.at}`} className="relative text-sm">
                  <span
                    className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-terracotta"
                    aria-hidden="true"
                  />
                  <p className="font-semibold">{ORDER_STATUS_LABELS[event.to]}</p>
                  <p className="text-brown-muted">
                    {formatDateTime(event.at)} · {event.byName ?? 'Customer (checkout)'}
                  </p>
                  {event.note ? <p className="mt-1">{event.note}</p> : null}
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <OrderActions order={order} />
      </div>
    </>
  );
}
