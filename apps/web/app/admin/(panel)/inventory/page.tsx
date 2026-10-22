import type { Metadata } from 'next';
import Link from 'next/link';
import type { InventoryMovementDTO, InventoryRow, Paginated } from '@jmh/shared';
import { InventoryTable } from '@/components/admin/inventory-table';
import { Card, FilterBar, filterInput, PageHeader, TableWrap } from '@/components/admin/ui';
import { Pagination } from '@/components/ui/misc';
import { adminGet } from '@/lib/api/server';
import { formatDateTime, param, toQuery } from '@/lib/utils';

export const metadata: Metadata = { title: 'Inventory' };
export const dynamic = 'force-dynamic';

const REASON_LABELS: Record<string, string> = {
  order_placed: 'Order placed',
  order_cancelled: 'Order cancelled',
  manual_adjustment: 'Manual correction',
  restock: 'Restock',
  damaged: 'Damaged',
  return: 'Return',
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const query = { q: param(raw.q), filter: param(raw.filter) ?? 'low', page: param(raw.page) };
  const [inventory, movements] = await Promise.all([
    adminGet<Paginated<InventoryRow>>(`/inventory${toQuery(query)}`),
    adminGet<Paginated<InventoryMovementDTO>>('/inventory/movements?limit=25'),
  ]);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock for products with tracking enabled. Orders reserve stock automatically; cancellations return it."
      />
      <FilterBar action="/admin/inventory">
        <input
          name="q"
          defaultValue={query.q}
          placeholder="Name or SKU"
          aria-label="Search inventory"
          className={`${filterInput} w-56`}
        />
        <select
          name="filter"
          defaultValue={query.filter}
          aria-label="Stock filter"
          className={filterInput}
        >
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
          <option value="all">All tracked products</option>
        </select>
      </FilterBar>
      <InventoryTable rows={inventory.data} />
      <div className="mt-6">
        <Pagination
          page={inventory.meta.page}
          totalPages={inventory.meta.totalPages}
          href={(page) => `/admin/inventory${toQuery({ ...query, page })}`}
        />
      </div>

      <Card title="Recent stock movements" className="mt-8">
        {movements.data.length ? (
          <TableWrap>
            <thead>
              <tr>
                <th>When</th>
                <th>Product</th>
                <th>Reason</th>
                <th className="text-right">Change</th>
                <th className="text-right">After</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {movements.data.map((movement) => (
                <tr key={movement.id}>
                  <td className="text-xs text-brown-muted">{formatDateTime(movement.createdAt)}</td>
                  <td>
                    <Link
                      href={`/admin/products/${movement.productId}`}
                      className="hover:text-terracotta-deep"
                    >
                      {movement.productName}
                      {movement.variantName ? ` (${movement.variantName})` : ''}
                    </Link>
                    {movement.note ? (
                      <div className="text-xs text-brown-muted">{movement.note}</div>
                    ) : null}
                  </td>
                  <td>
                    {REASON_LABELS[movement.reason] ?? movement.reason}
                    {movement.orderNumber ? (
                      <div className="font-mono text-xs text-brown-muted">
                        {movement.orderNumber}
                      </div>
                    ) : null}
                  </td>
                  <td
                    className={`text-right font-semibold ${movement.delta < 0 ? 'text-danger' : 'text-[#3f4d35]'}`}
                  >
                    {movement.delta > 0 ? '+' : ''}
                    {movement.delta}
                  </td>
                  <td className="text-right">{movement.stockAfter ?? '—'}</td>
                  <td className="text-xs">
                    {movement.byName ?? (movement.orderNumber ? 'Checkout' : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <p className="text-sm text-brown-muted">No stock movements recorded yet.</p>
        )}
      </Card>
    </>
  );
}
