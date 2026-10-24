'use client';

import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const control =
  'w-full rounded-xl border border-brown/20 bg-white/80 px-3.5 text-[0.9375rem] text-brown placeholder:text-brown-muted/70 ' +
  'transition-colors focus:border-terracotta-deep focus:bg-white focus:outline-none focus:ring-2 focus:ring-terracotta/25 ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20 disabled:cursor-not-allowed disabled:opacity-60';

interface FieldProps {
  label: ReactNode;
  error?: string | string[] | null;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby'?: string;
    required?: boolean;
  }) => ReactNode;
}

/** Label + control + hint + error, wired together with ids for screen readers. */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  const message = Array.isArray(error) ? error[0] : error;
  const describedBy =
    [hint ? `${id}-hint` : null, message ? `${id}-error` : null].filter(Boolean).join(' ') ||
    undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-brown">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-terracotta-deep">
            *
          </span>
        ) : null}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(message),
        'aria-describedby': describedBy,
        required,
      })}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-brown-muted">
          {hint}
        </p>
      ) : null}
      {message ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, 'h-11', className)} {...props} />;
}

/** Password field with a show/hide toggle. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className={cn(control, 'h-11 pr-12', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-brown-muted hover:text-brown focus-visible:outline-2 focus-visible:outline-terracotta-deep"
      >
        {visible ? (
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7a13 13 0 0 1-2.6 3.8M6.3 6.3A13.4 13.4 0 0 0 2.5 12c1 2.5 4.5 7 9.5 7a9.6 9.6 0 0 0 4.2-1" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M2.5 12c1-2.5 4.5-7 9.5-7s8.5 4.5 9.5 7c-1 2.5-4.5 7-9.5 7s-8.5-4.5-9.5-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea className={cn(control, 'min-h-28 py-2.5 leading-relaxed', className)} {...props} />
  );
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        control,
        'h-11 appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%278%27%3E%3Cpath d=%27M1 1l5 5 5-5%27 stroke=%27%2345352c%27 stroke-width=%271.6%27 fill=%27none%27/%3E%3C/svg%3E")] bg-[length:12px_8px] bg-[right_1rem_center] bg-no-repeat pr-10',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: ComponentProps<'input'> & { label: ReactNode }) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-2.5 text-sm text-brown',
        className,
      )}
    >
      <input
        type="checkbox"
        className="size-4.5 rounded border-brown/30 accent-terracotta"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-medium text-danger"
    >
      {message}
    </div>
  );
}
