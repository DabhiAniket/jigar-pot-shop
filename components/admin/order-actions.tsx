'use client';

import { useState } from 'react';
import { ORDER_STATUS_LABELS, type AdminOrderDetail, type OrderStatus } from '@jmh/shared';
import { WhatsAppIcon } from '@/components/store/site-footer';
import { Button, buttonClasses } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field, FormError, Input, Textarea } from '@/components/ui/form';
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
  const [shipment, setShipment] = useState({
    provider: order.shipment?.provider ?? '',
    trackingNumber: order.shipment?.trackingNumber ?? '',
    trackingUrl: order.shipment?.trackingUrl ?? '',
    estimatedDelivery: order.shipment?.estimatedDelivery ?? '',
  });
  const [rejectNote, setRejectNote] = useState('');
  const shipmentMutation = useMutation();
  const reject = useMutation();
  const writable = can('orders:write');
  const openRequest =
    order.cancellationRequest?.status === 'requested' ? order.cancellationRequest : null;
  const shipmentBody = () => ({
    provider: shipment.provider.trim(),
    trackingNumber: shipment.trackingNumber.trim(),
    trackingUrl: shipment.trackingUrl.trim() || null,
    estimatedDelivery: shipment.estimatedDelivery || null,
  });
  const needsShipment = next === 'shipped' && order.fulfillment === 'delivery' && !order.shipment;

  const applyStatus = async () => {
    if (!next) return;
    const result = await status.run(`/orders/${order.id}/status`, {
      body: {
        status: next,
        note: statusNote || undefined,
        cancellationReason: next === 'cancelled' ? reason : undefined,
        shipment: next === 'shipped' && shipment.provider.trim() ? shipmentBody() : undefined,
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
            {next === 'shipped' ? (
              <fieldset className="space-y-3 rounded-xl bg-cream p-3">
                <legend className="px-1 text-sm font-semibold">
                  Shipment details{needsShipment ? ' (required)' : ''}
                </legend>
                <ShipmentFields
                  value={shipment}
                  onChange={setShipment}
                  errors={status.fieldErrors}
                />
              </fieldset>
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

      {writable && openRequest ? (
        <Card title="Customer asked to cancel">
          <p className="text-sm">“{openRequest.reason}”</p>
          <p className="mt-1 text-xs text-brown-muted">
            Requested{' '}
            {new Date(openRequest.requestedAt).toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
            })}
            . This is a request from the customer, not a cancellation.
          </p>
          <div className="mt-3 space-y-3">
            {order.allowedTransitions.includes('cancelled') ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setNext('cancelled');
                  setReason(`Customer asked to cancel: ${openRequest.reason}`.slice(0, 300));
                  setConfirmCancel(true);
                }}
              >
                Approve and cancel order
              </Button>
            ) : null}
            <Field
              label="Or reject, with a note the customer will see"
              error={reject.fieldErrors.note}
            >
              {(props) => (
                <Input
                  {...props}
                  value={rejectNote}
                  maxLength={300}
                  onChange={(event) => setRejectNote(event.target.value)}
                  placeholder="e.g. Already packed and ready to ship"
                />
              )}
            </Field>
            <Button
              variant="secondary"
              size="sm"
              loading={reject.busy}
              disabled={!rejectNote.trim()}
              onClick={async () => {
                const result = await reject.run(`/orders/${order.id}/cancellation-request/reject`, {
                  body: { note: rejectNote },
                  success: 'Cancellation request rejected',
                });
                if (result) setRejectNote('');
              }}
            >
              Reject request
            </Button>
          </div>
        </Card>
      ) : null}

      {writable && ['ready_for_dispatch', 'shipped', 'delivered'].includes(order.status) ? (
        <Card title="Shipment">
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              await shipmentMutation.run(`/orders/${order.id}/shipment`, {
                method: 'PUT',
                body: shipmentBody(),
                success: 'Shipment details saved',
              });
            }}
          >
            <FormError message={shipmentMutation.error} />
            <ShipmentFields
              value={shipment}
              onChange={setShipment}
              errors={shipmentMutation.fieldErrors}
            />
            <Button type="submit" size="sm" variant="secondary" loading={shipmentMutation.busy}>
              Save shipment
            </Button>
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

function ShipmentFields({
  value,
  onChange,
  errors,
}: {
  value: {
    provider: string;
    trackingNumber: string;
    trackingUrl: string;
    estimatedDelivery: string;
  };
  onChange: (next: {
    provider: string;
    trackingNumber: string;
    trackingUrl: string;
    estimatedDelivery: string;
  }) => void;
  errors: Record<string, string[]>;
}) {
  const set = (key: keyof typeof value) => (event: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: event.target.value });
  return (
    <>
      <Field label="Shipping provider" required error={errors.provider ?? errors.shipment}>
        {(props) => (
          <Input {...props} value={value.provider} maxLength={80} onChange={set('provider')} />
        )}
      </Field>
      <Field label="Tracking number" required error={errors.trackingNumber}>
        {(props) => (
          <Input
            {...props}
            value={value.trackingNumber}
            maxLength={80}
            onChange={set('trackingNumber')}
          />
        )}
      </Field>
      <Field label="Tracking link (optional)" error={errors.trackingUrl}>
        {(props) => (
          <Input
            {...props}
            type="url"
            value={value.trackingUrl}
            maxLength={300}
            onChange={set('trackingUrl')}
          />
        )}
      </Field>
      <Field label="Expected delivery (optional)" error={errors.estimatedDelivery}>
        {(props) => (
          <Input
            {...props}
            type="date"
            value={value.estimatedDelivery}
            onChange={set('estimatedDelivery')}
          />
        )}
      </Field>
    </>
  );
}
