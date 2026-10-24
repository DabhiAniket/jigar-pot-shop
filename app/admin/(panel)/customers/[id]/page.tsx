import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  buildWhatsAppUrl,
  formatIndianMobile,
  formatINR,
  type AdminCustomerDetail,
} from '@jmh/shared';
import { Card, OrderStatusBadge, PageHeader, StatCard, TableWrap } from '@/components/admin/ui';
import { WhatsAppIcon } from '@/components/store/site-footer';
import { buttonClasses } from '@/components/ui/button';
import { adminGetOrNull } from '@/lib/api/server';
import { formatDate, formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Customer' };
export const dynamic = 'force-dynamic';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();
  const response = await adminGetOrNull<{ data: AdminCustomerDetail }>(`/customers/${id}`);
  if (!response) notFound();
  const customer = response.data;
  const address = customer.lastAddress;

  return (
    <>
      <PageHeader
        back={{ href: '/admin/customers', label: 'Customers' }}
        title={customer.name}
        description={`Customer since ${formatDate(customer.firstOrderAt)}`}
        actions={
          <a
            href={buildWhatsAppUrl(`91${customer.whatsapp ?? customer.phone}`)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses('whatsapp', 'md')}
          >
            <WhatsAppIcon className="size-5" /> WhatsApp
          </a>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Orders" value={customer.orderCount} />
        <StatCard
          label="Total spent"
          value={formatINR(customer.totalSpent)}
          hint="Confirmed and later orders"
        />
        <StatCard
          label="Phone"
          value={<span className="text-xl">{formatIndianMobile(customer.phone)}</span>}
        />
        <StatCard
          label="Last order"
          value={<span className="text-xl">{formatDate(customer.lastOrderAt)}</span>}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Orders" className="xl:col-span-2">
          <TableWrap>
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {customer.orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-mono font-semibold hover:text-terracotta-deep"
                    >
                      {order.orderNumber}
                    </Link>
                    <div className="text-xs text-brown-muted">
                      {formatDateTime(order.createdAt)}
                    </div>
                  </td>
                  <td>
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="text-right font-semibold">{formatINR(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
        <Card title="Last delivery address">
          {address ? (
            <address className="text-sm not-italic leading-relaxed">
              {address.line1}
              {address.line2 ? (
                <>
                  <br />
                  {address.line2}
                </>
              ) : null}
              {address.landmark ? (
                <>
                  <br />
                  Near {address.landmark}
                </>
              ) : null}
              <br />
              {address.city}, {address.state} {address.pincode}
            </address>
          ) : (
            <p className="text-sm text-brown-muted">Only store pickups so far.</p>
          )}
          {customer.whatsapp ? (
            <p className="mt-3 text-sm text-brown-muted">
              WhatsApp: {formatIndianMobile(customer.whatsapp)}
            </p>
          ) : null}
        </Card>
      </div>
    </>
  );
}
