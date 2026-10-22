'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { InventoryRow } from '@jmh/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, Input, Select } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/misc';
import { useAdmin, useMutation } from './admin-context';
import { ProductStatusBadge, TableWrap } from './ui';

const REASONS = [
  ['restock', 'Restock (new batch)'],
  ['manual_adjustment', 'Manual correction'],
  ['damaged', 'Damaged / broken'],
  ['return', 'Customer return'],
] as const;

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const { can } = useAdmin();
  const { run, busy, error, fieldErrors } = useMutation();
  const [row, setRow] = useState<InventoryRow | null>(null);
  const [mode, setMode] = useState<'delta' | 'set'>('delta');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>('restock');
  const [note, setNote] = useState('');
  const writable = can('inventory:write');

  const open = (target: InventoryRow) => {
    setRow(target);
    setMode('delta');
    setQuantity('');
    setReason('restock');
    setNote('');
  };

  if (rows.length === 0)
    return <EmptyState title="Nothing to show">No tracked products match this filter.</EmptyState>;

  const preview =
    row && quantity !== ''
      ? mode === 'set'
        ? Number(quantity)
        : row.stock + Number(quantity)
      : null;

  return (
    <>
      <TableWrap>
        <thead>
          <tr>
            <th>Product</th>
            <th>Status</th>
            <th className="text-right">Stock</th>
            <th className="text-right">Alert at</th>
            {writable ? <th className="text-right">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={`${item.productId}:${item.variantId ?? ''}`}>
              <td>
                <div className="flex items-center gap-3">
                  {item.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                    <img
                      src={item.thumbnail}
                      alt=""
                      width={40}
                      height={40}
                      className="size-10 rounded-lg object-cover"
                    />
                  ) : null}
                  <div>
                    <Link
                      href={`/admin/products/${item.productId}`}
                      className="font-semibold hover:text-terracotta-deep"
                    >
                      {item.name}
                    </Link>
                    <div className="text-xs text-brown-muted">
                      {item.variantName ? `${item.variantName} · ` : ''}
                      {item.sku ?? 'No SKU'}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <ProductStatusBadge status={item.status} />
              </td>
              <td
                className={`text-right font-semibold ${item.stock <= 0 ? 'text-danger' : item.stock <= item.lowStockThreshold ? 'text-terracotta-deep' : ''}`}
              >
                {item.stock}
              </td>
              <td className="text-right text-brown-muted">{item.lowStockThreshold}</td>
              {writable ? (
                <td className="text-right">
                  <button
                    type="button"
                    className="font-semibold text-terracotta-deep"
                    onClick={() => open(item)}
                  >
                    Adjust
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <Dialog
        open={Boolean(row)}
        onClose={() => setRow(null)}
        busy={busy}
        title="Adjust stock"
        description={
          row
            ? `${row.name}${row.variantName ? ` (${row.variantName})` : ''} · currently ${row.stock}`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setRow(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="adjust-form" loading={busy} disabled={quantity === ''}>
              Save adjustment
            </Button>
          </>
        }
      >
        {row ? (
          <form
            id="adjust-form"
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const result = await run('/inventory/adjust', {
                body: {
                  productId: row.productId,
                  variantId: row.variantId,
                  mode,
                  quantity: Number(quantity),
                  reason,
                  note: note || undefined,
                },
                success: 'Stock updated',
              });
              if (result) setRow(null);
            }}
          >
            <FormError message={Object.keys(fieldErrors).length ? null : error} />
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Adjustment type</legend>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'delta'}
                    onChange={() => setMode('delta')}
                    className="accent-terracotta"
                  />
                  Add / remove units
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'set'}
                    onChange={() => setMode('set')}
                    className="accent-terracotta"
                  />
                  Set exact count
                </label>
              </div>
            </fieldset>
            <Field
              label={mode === 'delta' ? 'Change (use − for removals)' : 'New stock count'}
              required
              error={fieldErrors.quantity}
            >
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  step={1}
                  min={mode === 'set' ? 0 : undefined}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              )}
            </Field>
            {preview !== null && Number.isFinite(preview) ? (
              <p className="text-sm text-brown-muted">Stock after: {preview}</p>
            ) : null}
            <Field label="Reason" required>
              {(props) => (
                <Select
                  {...props}
                  value={reason}
                  onChange={(event) => setReason(event.target.value as typeof reason)}
                >
                  {REASONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Note (optional)" error={fieldErrors.note}>
              {(props) => (
                <Input
                  {...props}
                  value={note}
                  maxLength={300}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="e.g. Kiln batch 14"
                />
              )}
            </Field>
          </form>
        ) : null}
      </Dialog>
    </>
  );
}
