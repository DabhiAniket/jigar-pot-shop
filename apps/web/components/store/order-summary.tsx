import { formatINR, type CartQuote } from '@jmh/shared';
import { cn } from '@/lib/utils';

export function TotalsTable({
  subtotal,
  discountTotal,
  deliveryCharge,
  total,
  fulfillment,
  promotionName,
  className,
}: {
  subtotal: number;
  discountTotal: number;
  deliveryCharge: number;
  total: number;
  fulfillment: 'delivery' | 'pickup';
  promotionName?: string | null;
  className?: string;
}) {
  return (
    <dl className={cn('space-y-2.5 text-[0.9375rem]', className)}>
      <div className="flex justify-between">
        <dt className="text-brown-muted">Subtotal</dt>
        <dd>{formatINR(subtotal)}</dd>
      </div>
      {discountTotal > 0 ? (
        <div className="flex justify-between text-sage">
          <dt>Discount{promotionName ? ` (${promotionName})` : ''}</dt>
          <dd className="font-semibold text-[#3f4d35]">−{formatINR(discountTotal)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between">
        <dt className="text-brown-muted">
          {fulfillment === 'pickup' ? 'Store pickup' : 'Delivery'}
        </dt>
        <dd>
          {fulfillment === 'pickup'
            ? 'Free'
            : deliveryCharge === 0
              ? 'Free'
              : formatINR(deliveryCharge)}
        </dd>
      </div>
      <div className="flex justify-between border-t border-brown/10 pt-3 text-lg font-semibold">
        <dt>Total</dt>
        <dd>{formatINR(total)}</dd>
      </div>
    </dl>
  );
}

export function QuoteTotals({ quote }: { quote: CartQuote }) {
  return (
    <TotalsTable
      subtotal={quote.subtotal}
      discountTotal={quote.discountTotal}
      deliveryCharge={quote.deliveryCharge}
      total={quote.total}
      fulfillment={quote.fulfillment}
      promotionName={quote.appliedPromotion?.name}
    />
  );
}
