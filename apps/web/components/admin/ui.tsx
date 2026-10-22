import Link from 'next/link';
import type { ReactNode } from 'react';
import { ORDER_STATUS_LABELS, type OrderStatus, type ProductStatus } from '@jmh/shared';
import { Badge } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div>
        {back ? (
          <Link
            href={back.href}
            className="no-print mb-2 inline-block text-sm font-semibold text-terracotta-deep"
          >
            ← {back.label}
          </Link>
        ) : null}
        <h1 className="text-3xl font-medium md:text-4xl">{title}</h1>
        {description ? <p className="mt-1.5 text-brown-muted">{description}</p> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-3xl border border-brown/10 bg-white p-5 shadow-[0_1px_2px_rgb(69_53_44/0.04)] md:p-6',
        className,
      )}
    >
      {title || actions ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="font-display text-xl font-medium">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-sm font-medium text-brown-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-medium">{value}</p>
      {hint ? <p className="mt-1 text-xs text-brown-muted">{hint}</p> : null}
    </>
  );
  const className = 'block rounded-3xl border border-brown/10 bg-white p-5 transition-colors';
  return href ? (
    <Link href={href} className={cn(className, 'hover:border-terracotta/40')}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

const ORDER_TONES: Record<OrderStatus, Parameters<typeof Badge>[0]['tone']> = {
  pending: 'terracotta',
  awaiting_confirmation: 'gold',
  confirmed: 'sage',
  processing: 'sage',
  ready_for_dispatch: 'sage',
  shipped: 'neutral',
  delivered: 'dark',
  cancelled: 'danger',
  refunded: 'neutral',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONES[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return (
    <Badge tone={status === 'published' ? 'sage' : status === 'draft' ? 'gold' : 'neutral'}>
      {status[0]!.toUpperCase() + status.slice(1)}
    </Badge>
  );
}

/** Wraps a table so it scrolls horizontally on small screens instead of breaking the layout. */
export function TableWrap({
  children,
  minWidth = 'min-w-[40rem]',
}: {
  children: ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-brown/10 bg-white">
      <table
        className={`w-full ${minWidth} text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-brown-muted [&_th]:uppercase [&_tbody_tr]:border-t [&_tbody_tr]:border-brown/8 [&_tbody_tr:hover]:bg-cream/50`}
      >
        {children}
      </table>
    </div>
  );
}

/** GET search/filter bar for server-rendered admin lists (works without JavaScript). */
export function FilterBar({ action, children }: { action: string; children: ReactNode }) {
  return (
    <form
      action={action}
      method="get"
      className="no-print mb-5 flex flex-wrap items-end gap-3 rounded-3xl border border-brown/10 bg-white p-4"
    >
      {children}
      <button
        type="submit"
        className="h-10 rounded-full bg-brown px-5 text-sm font-semibold text-cream"
      >
        Apply
      </button>
      <Link
        href={action}
        className="h-10 content-center px-2 text-sm font-semibold text-terracotta-deep"
      >
        Reset
      </Link>
    </form>
  );
}

export const filterInput =
  'h-10 rounded-xl border border-brown/20 bg-white px-3 text-sm focus:border-terracotta-deep focus:outline-none';

export function NoAccess() {
  return (
    <div className="rounded-3xl border border-brown/10 bg-white p-10 text-center">
      <h1 className="text-2xl font-medium">You do not have access to this area</h1>
      <p className="mt-2 text-brown-muted">Ask a Super Admin if you need this permission.</p>
    </div>
  );
}
