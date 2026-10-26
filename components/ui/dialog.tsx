'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Prevent closing via Escape/backdrop while work is in progress. */
  busy?: boolean;
}

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

/**
 * Accessible modal built on the native <dialog> element: focus is trapped and restored by the
 * browser, Escape closes it, and the rest of the page becomes inert while it is open.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  busy,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !busy) onClose();
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-3xl bg-cream p-0 text-left text-brown shadow-lift backdrop:bg-brown-deep/55 backdrop:backdrop-blur-[2px]',
        SIZES[size],
      )}
    >
      {open ? (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-brown/10 px-6 py-5">
            <div>
              <h2 id="dialog-title" className="text-xl font-semibold">
                {title}
              </h2>
              {description ? <p className="mt-1 text-sm text-brown-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="-mr-2 rounded-full p-2 text-brown-muted hover:bg-brown/5 hover:text-brown"
              aria-label="Close dialog"
            >
              <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer ? (
            <div className="flex flex-wrap justify-end gap-3 border-t border-brown/10 px-6 py-4">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmation step for destructive or irreversible admin actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive,
  busy,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      busy={busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[0.9375rem] leading-relaxed text-brown">{message}</div>
    </Dialog>
  );
}
