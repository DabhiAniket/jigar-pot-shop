import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'terracotta' | 'sage' | 'gold' | 'danger' | 'dark';

const TONES: Record<Tone, string> = {
  neutral: 'bg-brown/8 text-brown',
  terracotta: 'bg-terracotta-soft text-terracotta-deep',
  sage: 'bg-sage-soft text-[#3f4d35]',
  gold: 'bg-gold/20 text-[#6b4f17]',
  danger: 'bg-danger/10 text-danger',
  dark: 'bg-brown text-cream',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-brown/20 px-6 py-14 text-center">
      <svg viewBox="0 0 48 48" className="mb-4 size-12 text-terracotta/70" aria-hidden="true">
        <path
          d="M16 10h16M18 10c0 3-6 5-6 14 0 8 5 14 12 14s12-6 12-14c0-9-6-11-6-14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M14 26c6 3 14 3 20 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="2 3"
        />
      </svg>
      <h3 className="text-xl font-semibold">{title}</h3>
      {children ? (
        <div className="mt-2 max-w-md text-[0.9375rem] text-brown-muted">{children}</div>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-2xl bg-brown/8', className)} aria-hidden="true" />
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  href: (page: number) => string;
  label?: string;
}

/** Link-based pagination: works without JavaScript and is crawlable. */
export function Pagination({ page, totalPages, href, label = 'Pagination' }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = new Set(
    [1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages),
  );
  const sorted = [...pages].sort((a, b) => a - b);
  const item =
    'inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors';
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} className={cn(item, 'hover:bg-brown/5')} rel="prev">
          ← Previous
        </Link>
      ) : null}
      {sorted.map((p, index) => (
        <span key={p} className="contents">
          {index > 0 && p - sorted[index - 1]! > 1 ? (
            <span className="px-1 text-brown-muted">…</span>
          ) : null}
          <Link
            href={href(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(item, p === page ? 'bg-brown text-cream' : 'hover:bg-brown/5')}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < totalPages ? (
        <Link href={href(page + 1)} className={cn(item, 'hover:bg-brown/5')} rel="next">
          Next →
        </Link>
      ) : null}
    </nav>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = 'left',
  id,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  align?: 'left' | 'center';
  id?: string;
}) {
  return (
    <div
      className={cn(
        'mb-8 flex flex-col gap-4 md:mb-10',
        align === 'center'
          ? 'items-center text-center'
          : 'md:flex-row md:items-end md:justify-between',
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
        <h2 id={id} className="text-3xl leading-[1.08] font-medium md:text-[2.75rem]">
          {title}
        </h2>
        {description ? (
          <p className="mt-3 text-base leading-relaxed text-brown-muted md:text-lg">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
