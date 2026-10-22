import type { Metadata } from 'next';
import Link from 'next/link';
import { formatINR, type AdminPromotion } from '@jmh/shared';
import { PageHeader, TableWrap } from '@/components/admin/ui';
import { ButtonLink } from '@/components/ui/button';
import { Badge, EmptyState } from '@/components/ui/misc';
import { adminGet } from '@/lib/api/server';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Promotions' };
export const dynamic = 'force-dynamic';

const STATE_TONES = {
  live: 'sage',
  scheduled: 'gold',
  expired: 'neutral',
  disabled: 'danger',
} as const;

export default async function PromotionsPage() {
  const { data } = await adminGet<{ data: AdminPromotion[] }>('/promotions');
  return (
    <>
      <PageHeader
        title="Discounts & promotions"
        description="Time-bound offers, coupon codes and homepage banners."
        actions={<ButtonLink href="/admin/promotions/new">New promotion</ButtonLink>}
      />
      {data.length ? (
        <TableWrap>
          <thead>
            <tr>
              <th>Promotion</th>
              <th>State</th>
              <th>Discount</th>
              <th>Applies to</th>
              <th>Runs</th>
            </tr>
          </thead>
          <tbody>
            {data.map((promotion) => (
              <tr key={promotion.id}>
                <td>
                  <Link
                    href={`/admin/promotions/${promotion.id}`}
                    className="font-semibold hover:text-terracotta-deep"
                  >
                    {promotion.name}
                  </Link>
                  <div className="text-xs text-brown-muted">
                    {promotion.code ? (
                      <span className="font-mono">Code {promotion.code}</span>
                    ) : (
                      'Automatic'
                    )}
                    {promotion.banner.show ? ' · Banner' : ''}
                  </div>
                </td>
                <td>
                  <Badge tone={STATE_TONES[promotion.state]}>
                    {promotion.state[0]!.toUpperCase() + promotion.state.slice(1)}
                  </Badge>
                </td>
                <td>
                  {promotion.type === 'percentage'
                    ? `${promotion.value}%`
                    : formatINR(promotion.value)}
                  {promotion.minOrderValue ? (
                    <div className="text-xs text-brown-muted">
                      min {formatINR(promotion.minOrderValue)}
                    </div>
                  ) : null}
                </td>
                <td className="text-sm">
                  {promotion.scope === 'all'
                    ? 'All products'
                    : promotion.scope === 'categories'
                      ? `${promotion.categoryIds.length} ${promotion.categoryIds.length === 1 ? 'category' : 'categories'}`
                      : `${promotion.productIds.length} ${promotion.productIds.length === 1 ? 'product' : 'products'}`}
                </td>
                <td className="text-xs text-brown-muted">
                  {formatDateTime(promotion.startsAt)} → {formatDateTime(promotion.endsAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <EmptyState
          title="No promotions yet"
          action={<ButtonLink href="/admin/promotions/new">Create a promotion</ButtonLink>}
        >
          Create festival offers such as “Diwali Dhamaka” with start and end dates.
        </EmptyState>
      )}
    </>
  );
}
