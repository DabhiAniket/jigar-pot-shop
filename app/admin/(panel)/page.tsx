import Link from 'next/link';
import { formatINR, type DashboardDTO } from '@jmh/shared';
import { Card, OrderStatusBadge, PageHeader, StatCard, TableWrap } from '@/components/admin/ui';
import { EmptyState } from '@/components/ui/misc';
import { adminGet } from '@/lib/api/server';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { data } = await adminGet<{ data: DashboardDTO }>('/dashboard');
  const { catalog, orders } = data;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Live figures · updated ${formatDateTime(data.generatedAt)}`}
      />
      {orders ? (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total orders" value={orders.totalOrders} href="/admin/orders" />
          <StatCard
            label="Pending"
            value={orders.pendingOrders}
            hint="New & awaiting confirmation"
            href="/admin/orders?status=pending"
          />
          <StatCard
            label="In progress"
            value={orders.inProgressOrders}
            hint="Confirmed → shipped"
          />
          <StatCard
            label="Completed"
            value={orders.completedOrders}
            hint={`${orders.cancelledOrders} cancelled/refunded`}
          />
          <StatCard
            label="Sales (all time)"
            value={formatINR(orders.salesTotal)}
            hint="Confirmed and later orders"
          />
          <StatCard
            label="Sales (30 days)"
            value={formatINR(orders.salesLast30Days)}
            hint={`${orders.ordersLast30Days} orders`}
          />
        </div>
      ) : null}
      {catalog ? (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Products" value={catalog.totalProducts} href="/admin/products" />
          <StatCard
            label="Published"
            value={catalog.publishedProducts}
            hint={`${catalog.draftProducts} drafts`}
            href="/admin/products?status=published"
          />
          <StatCard
            label="Low stock"
            value={catalog.lowStockProducts}
            href="/admin/inventory?filter=low"
          />
          <StatCard
            label="Out of stock"
            value={catalog.outOfStockProducts}
            href="/admin/inventory?filter=out"
          />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-5">
        {orders ? (
          <Card
            title="Recent orders"
            className="xl:col-span-3"
            actions={
              <Link href="/admin/orders" className="text-sm font-semibold text-terracotta-deep">
                All orders →
              </Link>
            }
          >
            {orders.recentOrders.length ? (
              <TableWrap minWidth="min-w-[30rem]">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.recentOrders.map((order) => (
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
                      <td>{order.customerName}</td>
                      <td>
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="text-right font-semibold">{formatINR(order.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState title="No orders yet">
                Orders placed on the website appear here instantly.
              </EmptyState>
            )}
          </Card>
        ) : null}
        <div className="space-y-6 xl:col-span-2">
          {orders ? (
            <Card title="Top-selling products">
              {orders.topProducts.length ? (
                <ol className="space-y-3 text-sm">
                  {orders.topProducts.map((product, index) => (
                    <li key={product.productId} className="flex justify-between gap-3">
                      <span>
                        <span className="mr-2 text-brown-muted">{index + 1}.</span>
                        {product.name}
                      </span>
                      <span className="shrink-0 font-semibold">
                        {product.quantity} sold · {formatINR(product.revenue)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-brown-muted">Appears once orders are confirmed.</p>
              )}
            </Card>
          ) : null}
          {catalog ? (
            <Card
              title="Low stock"
              actions={
                <Link
                  href="/admin/inventory"
                  className="text-sm font-semibold text-terracotta-deep"
                >
                  Inventory →
                </Link>
              }
            >
              {catalog.lowStock.length ? (
                <ul className="space-y-3 text-sm">
                  {catalog.lowStock.map((row) => (
                    <li
                      key={`${row.productId}:${row.variantId ?? ''}`}
                      className="flex justify-between gap-3"
                    >
                      <Link
                        href={`/admin/products/${row.productId}`}
                        className="hover:text-terracotta-deep"
                      >
                        {row.name}
                        {row.variantName ? ` (${row.variantName})` : ''}
                      </Link>
                      <span
                        className={row.stock === 0 ? 'font-semibold text-danger' : 'font-semibold'}
                      >
                        {row.stock} left
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-brown-muted">
                  All tracked products are above their low-stock threshold.
                </p>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
