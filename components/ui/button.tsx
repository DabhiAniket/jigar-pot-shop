import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'dark' | 'danger' | 'whatsapp';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-terracotta text-white hover:bg-terracotta-deep shadow-soft',
  secondary: 'border border-brown/25 bg-transparent text-brown hover:border-brown hover:bg-brown/5',
  ghost: 'bg-transparent text-brown hover:bg-brown/5',
  dark: 'bg-brown text-cream hover:bg-brown-deep',
  danger: 'bg-danger text-white hover:bg-[#8a2820]',
  whatsapp: 'bg-[#1f7a4d] text-white hover:bg-[#17633e] shadow-soft',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-[0.9375rem] gap-2',
  lg: 'h-13 px-7 text-base gap-2.5',
};

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cn(
    'inline-flex select-none items-center justify-center rounded-full font-semibold tracking-[0.01em] transition-colors duration-200',
    'disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55',
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant,
  size,
  loading,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
