import type { Metadata } from 'next';
import Link from 'next/link';
import { formatIndianMobile, type AdminCustomerListItem, type Paginated } from '@jmh/shared';
import { FilterBar, filterInput, PageHeader, TableWrap } from '@/components/admin/ui';
import { EmptyState, Pagination } from '@/components/ui/misc';
import { adminGet } from '@/lib/api/server';
import { formatDate, param, toQuery } from '@/lib/utils';

export const metadata: Metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const query = { q: param(raw.q), page: param(raw.page) };
  const customers = await adminGet<Paginated<AdminCustomerListItem>>(`/customers${toQuery(query)}`);
  return (
    <>
      <PageHeader
        title="Customers"
        description={`${customers.meta.total} customers · created automatically from orders (by mobile number).`}
      />
      <FilterBar action="/admin/customers">
        <input
          name="q"
          defaultValue={query.q}
          placeholder="Name, phone or city"
          aria-label="Search customers"
          className={`${filterInput} w-64`}
        />
      </FilterBar>
      {customers.data.length ? (
        <TableWrap>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>City</th>
              <th className="text-right">Orders</th>
              <th>Last order</th>
            </tr>
          </thead>
          <tbody>
            {customers.data.map((customer) => (
              <tr key={customer.id}>
                <td>
                  <Link
                    href={`/admin/customers/${customer.id}`}
                    className="font-semibold hover:text-terracotta-deep"
                  >
                    {customer.name}
                  </Link>
                </td>
                <td>{formatIndianMobile(customer.phone)}</td>
                <td>{customer.city ?? '—'}</td>
                <td className="text-right">{customer.orderCount}</td>
                <td className="text-brown-muted">{formatDate(customer.lastOrderAt)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <EmptyState title="No customers found">
          Customers appear here after their first order.
        </EmptyState>
      )}
      <div className="mt-6">
        <Pagination
          page={customers.meta.page}
          totalPages={customers.meta.totalPages}
          href={(page) => `/admin/customers${toQuery({ ...query, page })}`}
        />
      </div>
    </>
  );
}
