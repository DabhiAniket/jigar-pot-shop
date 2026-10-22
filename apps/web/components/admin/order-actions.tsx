'use client';

import { useState } from 'react';
import { ORDER_STATUS_LABELS, type AdminOrderDetail, type OrderStatus } from '@jmh/shared';
import { WhatsAppIcon } from '@/components/store/site-footer';
import { Button, buttonClasses } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/form';
import { useAdmin, useMutation } from './admin-context';
import { Card } from './ui';

export function OrderActions({ order }: { order: AdminOrderDetail }) {
  const { can } = useAdmin();
  const status = useMutation();
  const note = useMutation();
  const [next, setNext] = useState<OrderStatus | ''>(order.allowedTransitions[0] ?? '');
  const [statusNote, setStatusNote] = useState('');
  const [reason, setReason] = useState('');
  const [noteText, setNoteText] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const writable = can('orders:write');

  const applyStatus = async () => {
    if (!next) return;
    const result = await status.run(`/orders/${order.id}/status`, {
      body: {
        status: next,
        note: statusNote || undefined,
        cancellationReason: next === 'cancelled' ? reason : undefined,
      },
      success: `Order marked ${ORDER_STATUS_LABELS[next].toLowerCase()}`,
    });
    if (result) {
      setStatusNote('');
      setReason('');
      setConfirmCancel(false);
    }
  };

  return (
    <div className="no-print space-y-6">
      <Card title="Actions">
        <div className="space-y-3">
          {order.whatsappContactUrl ? (
            <a
              href={order.whatsappContactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses('whatsapp', 'md', 'w-full')}
            >
              <WhatsAppIcon className="size-5" /> Message customer on WhatsApp
            </a>
          ) : null}
          <Button variant="secondary" className="w-full" onClick={() => window.print()}>
            Print order summary
          </Button>
        </div>
      </Card>

      {writable && order.allowedTransitions.length ? (
        <Card title="Update status">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (next === 'cancelled') setConfirmCancel(true);
              else void applyStatus();
            }}
          >
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Move to</legend>
              <div className="flex flex-wrap gap-2">
                {order.allowedTransitions.map((value) => (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold ${next === value ? 'border-brown bg-brown text-cream' : 'border-brown/20'}`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={value}
                      checked={next === value}
                      onChange={() => setNext(value)}
                      className="sr-only"
                    />
                    {ORDER_STATUS_LABELS[value]}
                  </label>
                ))}
              </div>
            </fieldset>
            {next === 'cancelled' ? (
              <Field
                label="Cancellation reason"
                required
                error={status.fieldErrors.cancellationReason}
              >
                {(props) => (
                  <Input
                    {...props}
                    value={reason}
                    maxLength={300}
                    onChange={(event) => setReason(event.target.value)}
                  />
                )}
              </Field>
            ) : null}
            <Field label="Note for the history (optional)">
              {(props) => (
                <Input
                  {...props}
                  value={statusNote}
                  maxLength={500}
                  onChange={(event) => setStatusNote(event.target.value)}
                  placeholder="e.g. Confirmed with customer on WhatsApp"
                />
              )}
            </Field>
            <Button
              type="submit"
              loading={status.busy}
              variant={next === 'cancelled' ? 'danger' : 'primary'}
            >
              Update status
            </Button>
            {next === 'cancelled' && order.inventory.committed && !order.inventory.restockedAt ? (
              <p className="text-xs text-brown-muted">
                Cancelling returns the reserved stock to inventory.
              </p>
            ) : null}
          </form>
        </Card>
      ) : null}

      {writable ? (
        <Card title="Internal notes">
          <ul className="mb-4 space-y-3 text-sm">
            {order.internalNotes.length ? (
              order.internalNotes.map((item) => (
                <li key={item.at} className="rounded-xl bg-cream p-3">
                  <p className="whitespace-pre-line">{item.text}</p>
                  <p className="mt-1 text-xs text-brown-muted">
                    {item.byName} ·{' '}
                    {new Date(item.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </p>
                </li>
              ))
            ) : (
              <li className="text-brown-muted">Only staff can see notes.</li>
            )}
          </ul>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const result = await note.run(`/orders/${order.id}/notes`, {
                body: { text: noteText },
                success: 'Note added',
              });
              if (result) setNoteText('');
            }}
          >
            <Textarea
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              maxLength={1000}
              aria-label="New internal note"
              placeholder="Add a note…"
              className="min-h-20"
            />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              loading={note.busy}
              disabled={!noteText.trim()}
            >
              Add note
            </Button>
          </form>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmCancel}
        title={`Cancel order ${order.orderNumber}?`}
        destructive
        confirmLabel="Cancel order"
        message={
          <>
            Reason: “{reason || '—'}”. The customer is not notified automatically — message them on
            WhatsApp if needed.
          </>
        }
        busy={status.busy}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => void applyStatus()}
      />
    </div>
  );
}
