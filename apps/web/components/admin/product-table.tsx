'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  formatINR,
  PRODUCT_BULK_ACTIONS,
  type AdminProductListItem,
  type ProductBulkAction,
} from '@jmh/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/misc';
import { formatDateTime } from '@/lib/utils';
import { useAdmin, useMutation } from './admin-context';
import { filterInput, ProductStatusBadge, TableWrap } from './ui';

const ACTION_LABELS: Record<ProductBulkAction, string> = {
  publish: 'Publish',
  unpublish: 'Unpublish (move to draft)',
  archive: 'Archive',
  assign_category: 'Move to category…',
  feature: 'Mark featured',
  unfeature: 'Remove featured',
  mark_bestseller: 'Mark bestseller',
  unmark_bestseller: 'Remove bestseller',
};

export function ProductTable({
  products,
  categories,
}: {
  products: AdminProductListItem[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { can } = useAdmin();
  const { run, busy } = useMutation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<ProductBulkAction>('publish');
  const [categoryId, setCategoryId] = useState('');
  const [confirm, setConfirm] = useState<
    null | { kind: 'bulk' } | { kind: 'delete'; product: AdminProductListItem }
  >(null);
  const writable = can('products:write');

  if (products.length === 0) {
    return (
      <EmptyState title="No products found">
        Try a different filter, or add your first product.
      </EmptyState>
    );
  }

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      {writable && selected.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl bg-brown px-4 py-3 text-cream">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <select
            value={action}
            onChange={(event) => setAction(event.target.value as ProductBulkAction)}
            aria-label="Bulk action"
            className={`${filterInput} text-brown`}
          >
            {PRODUCT_BULK_ACTIONS.map((value) => (
              <option key={value} value={value}>
                {ACTION_LABELS[value]}
              </option>
            ))}
          </select>
          {action === 'assign_category' ? (
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              aria-label="Target category"
              className={`${filterInput} text-brown`}
            >
              <option value="">Choose category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          ) : null}
          <Button
            size="sm"
            variant="primary"
            onClick={() => setConfirm({ kind: 'bulk' })}
            disabled={action === 'assign_category' && !categoryId}
          >
            Apply
          </Button>
          <button
            type="button"
            className="text-sm underline"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      ) : null}
      <TableWrap>
        <thead>
          <tr>
            {writable ? (
              <th className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all products on this page"
                  checked={selected.size === products.length}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked ? new Set(products.map((p) => p.id)) : new Set(),
                    )
                  }
                  className="size-4 accent-terracotta"
                />
              </th>
            ) : null}
            <th>Product</th>
            <th>Status</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Updated</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              {writable ? (
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${product.name}`}
                    checked={selected.has(product.id)}
                    onChange={() => toggle(product.id)}
                    className="size-4 accent-terracotta"
                  />
                </td>
              ) : null}
              <td>
                <div className="flex items-center gap-3">
                  {product.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                    <img
                      src={product.thumbnail}
                      alt=""
                      width={48}
                      height={48}
                      className="size-12 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="flex size-12 items-center justify-center rounded-xl bg-cream-deep text-xs text-brown-muted">
                      No image
                    </span>
                  )}
                  <div>
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="font-semibold hover:text-terracotta-deep"
                    >
                      {product.name}
                    </Link>
                    <div className="text-xs text-brown-muted">
                      {product.sku ?? 'No SKU'} · {product.category?.name ?? 'Uncategorised'}
                      {product.isFeatured ? ' · Featured' : ''}
                      {product.isBestseller ? ' · Bestseller' : ''}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <ProductStatusBadge status={product.status} />
              </td>
              <td>
                {product.salePrice != null ? (
                  <>
                    <span className="font-semibold">{formatINR(product.salePrice)}</span>{' '}
                    <span className="text-xs text-brown-muted line-through">
                      {formatINR(product.price)}
                    </span>
                  </>
                ) : (
                  <span className="font-semibold">{formatINR(product.price)}</span>
                )}
              </td>
              <td
                className={
                  product.trackInventory && product.lowStock ? 'font-semibold text-danger' : ''
                }
              >
                {product.trackInventory ? product.stock : 'Not tracked'}
                {product.hasVariants ? (
                  <span className="block text-xs font-normal text-brown-muted">
                    across variants
                  </span>
                ) : null}
              </td>
              <td className="text-xs text-brown-muted">{formatDateTime(product.updatedAt)}</td>
              <td className="text-right whitespace-nowrap">
                <Link
                  href={`/admin/products/${product.id}`}
                  className="mr-3 font-semibold text-terracotta-deep"
                >
                  {writable ? 'Edit' : 'View'}
                </Link>
                {writable ? (
                  <button
                    type="button"
                    className="mr-3 font-semibold"
                    onClick={async () => {
                      const result = await run<{ data: { id: string } }>(
                        `/products/${product.id}/duplicate`,
                        { success: 'Draft copy created', refresh: false },
                      );
                      if (result) router.push(`/admin/products/${result.data.id}`);
                    }}
                  >
                    Duplicate
                  </button>
                ) : null}
                {can('products:delete') ? (
                  <button
                    type="button"
                    className="font-semibold text-danger"
                    onClick={() => setConfirm({ kind: 'delete', product })}
                  >
                    Delete
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <ConfirmDialog
        open={confirm?.kind === 'bulk'}
        title={`${ACTION_LABELS[action].replace('…', '')} ${selected.size} product(s)?`}
        message={
          action === 'publish'
            ? 'Products without images are skipped — they cannot be published.'
            : 'This updates every selected product.'
        }
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          const result = await run<{ data: { modified: number; skipped: number } }>(
            '/products/bulk',
            {
              body: { ids: [...selected], action, categoryId: categoryId || null },
            },
          );
          if (result) {
            setSelected(new Set());
            setConfirm(null);
          }
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        title="Delete this product?"
        destructive
        confirmLabel="Delete permanently"
        message={
          confirm?.kind === 'delete' ? (
            <>
              <strong>{confirm.product.name}</strong> will be removed from the store. Past orders
              keep their own copy of the product details. Consider archiving instead if you may sell
              it again.
            </>
          ) : null
        }
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm?.kind !== 'delete') return;
          const result = await run(`/products/${confirm.product.id}`, {
            method: 'DELETE',
            success: 'Product deleted',
          });
          if (result !== null) setConfirm(null);
        }}
      />
    </>
  );
}
