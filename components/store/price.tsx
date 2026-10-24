import { discountPercent, formatINR, type Availability } from '@jmh/shared';
import { cn } from '@/lib/utils';

export function Price({
  price,
  salePrice,
  from,
  size = 'md',
  className,
}: {
  price: number;
  salePrice: number | null;
  from?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const percent = discountPercent(price, salePrice);
  const current = percent ? salePrice! : price;
  const text = { sm: 'text-base', md: 'text-lg', lg: 'text-[1.75rem]' }[size];
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-1', className)}>
      <span className={cn('font-semibold text-brown', text)}>
        {from ? <span className="mr-1 text-sm font-medium text-brown-muted">from</span> : null}
        {formatINR(current)}
      </span>
      {percent ? (
        <>
          <span className="text-sm text-brown-muted line-through">
            <span className="sr-only">Regular price </span>
            {formatINR(price)}
          </span>
          <span className="rounded-full bg-terracotta px-2 py-0.5 text-xs font-bold text-white">
            −{percent}%
          </span>
        </>
      ) : null}
    </div>
  );
}

const AVAILABILITY_STYLES: Record<Availability, { label: string; dot: string }> = {
  in_stock: { label: 'In stock', dot: 'bg-sage' },
  made_to_order: { label: 'Made to order', dot: 'bg-gold' },
  out_of_stock: { label: 'Out of stock', dot: 'bg-brown-muted' },
};

export function AvailabilityLabel({
  availability,
  lowStock,
  className,
}: {
  availability: Availability;
  lowStock?: boolean;
  className?: string;
}) {
  const style = AVAILABILITY_STYLES[availability];
  return (
    <span
      className={cn('inline-flex items-center gap-2 text-sm font-medium text-brown', className)}
    >
      <span
        className={cn(
          'size-2 rounded-full',
          lowStock && availability === 'in_stock' ? 'bg-terracotta' : style.dot,
        )}
        aria-hidden="true"
      />
      {lowStock && availability === 'in_stock' ? 'Low stock' : style.label}
    </span>
  );
}
