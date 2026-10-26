'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { MediaAssetDTO } from '@jmh/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Field, FormError, Textarea } from '@/components/ui/form';
import { Badge, EmptyState } from '@/components/ui/misc';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api/client';
import { formatDateTime } from '@/lib/utils';
import { useAdmin, useMutation } from './admin-context';
import { ImageUploadDialog } from './image-uploader';

type Detail = MediaAssetDTO & { usage: { products: number; categories: number; home: number } };

const kb = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;

export function MediaStatusBadge({ status }: { status: MediaAssetDTO['status'] }) {
  return (
    <Badge tone={status === 'ready' ? 'sage' : status === 'processing' ? 'gold' : 'danger'}>
      {status[0]!.toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export function MediaLibrary({ assets }: { assets: MediaAssetDTO[] }) {
  const router = useRouter();
  const { can, toast } = useAdmin();
  const save = useMutation();
  const remove = useMutation();
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [alt, setAlt] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const writable = can('media:write');

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    api<{ data: Detail }>(`/admin/media/${selectedId}`)
      .then((response) => {
        if (!active) return;
        setDetail(response.data);
        setAlt(response.data.alt);
      })
      .catch(() => active && toast('Could not load this image.', 'error'));
    return () => {
      active = false;
    };
  }, [selectedId, toast]);

  const close = () => {
    setSelectedId(null);
    setDetail(null);
  };
  const usageTotal = detail
    ? detail.usage.products + detail.usage.categories + detail.usage.home
    : 0;

  return (
    <>
      {writable ? (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setUploading(true)}>Upload image</Button>
        </div>
      ) : null}
      {assets.length === 0 ? (
        <EmptyState title="No images found">
          Upload product photos here; they are cropped and converted to WebP automatically.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {assets.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                onClick={() => setSelectedId(asset.id)}
                className="block w-full overflow-hidden rounded-2xl border border-brown/10 bg-white text-left transition-colors hover:border-terracotta"
              >
                {asset.variants[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- thumbnail variant
                  <img
                    src={asset.variants[0].url}
                    alt={asset.alt || asset.originalFilename}
                    loading="lazy"
                    className="aspect-square w-full bg-cream-deep object-contain"
                  />
                ) : (
                  <span className="flex aspect-square w-full items-center justify-center bg-cream-deep text-xs text-brown-muted">
                    {asset.status === 'processing' ? 'Processing…' : 'No preview'}
                  </span>
                )}
                <span className="block space-y-1 p-2.5">
                  <span className="block truncate text-xs font-semibold">
                    {asset.originalFilename}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <MediaStatusBadge status={asset.status} />
                    <span className="text-xs text-brown-muted">
                      {kb(asset.totalBytes || asset.sourceBytes)}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ImageUploadDialog
        open={uploading}
        onClose={() => setUploading(false)}
        onUploaded={() => {
          toast('Image uploaded and processed');
          router.refresh();
        }}
      />

      <ImageUploadDialog
        open={editing && Boolean(detail)}
        onClose={() => setEditing(false)}
        source={
          detail?.variants.length
            ? { id: detail.id, alt: detail.alt, url: detail.variants.at(-1)!.url }
            : undefined
        }
        onUploaded={() => {
          toast('Saved as a new image. The original is kept.');
          setEditing(false);
          close();
          router.refresh();
        }}
      />

      <Dialog
        open={Boolean(selectedId) && !confirmDelete && !editing}
        onClose={close}
        size="lg"
        busy={save.busy}
        title={detail?.originalFilename ?? 'Image'}
        footer={
          detail && writable ? (
            <>
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
              {detail.status === 'ready' && detail.variants.length ? (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Edit crop
                </Button>
              ) : null}
              <Button
                loading={save.busy}
                onClick={async () => {
                  const result = await save.run(`/media/${detail.id}`, {
                    method: 'PATCH',
                    body: { alt },
                    success: 'Alt text saved',
                  });
                  if (result) close();
                }}
              >
                Save alt text
              </Button>
            </>
          ) : null
        }
      >
        {!detail ? (
          <div className="flex justify-center py-10">
            <Spinner label="Loading image" />
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex items-center justify-center rounded-2xl bg-cream-deep p-3">
              {detail.variants.at(-1) ? (
                // eslint-disable-next-line @next/next/no-img-element -- pipeline variant
                <img
                  src={detail.variants[Math.min(1, detail.variants.length - 1)]!.url}
                  alt={detail.alt}
                  className="max-h-72 w-auto rounded-xl"
                />
              ) : (
                <MediaStatusBadge status={detail.status} />
              )}
            </div>
            <div className="space-y-4 text-sm">
              <FormError message={detail.error} />
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                <dt className="text-brown-muted">Status</dt>
                <dd>
                  <MediaStatusBadge status={detail.status} />
                </dd>
                <dt className="text-brown-muted">Original</dt>
                <dd>
                  {detail.sourceWidth}×{detail.sourceHeight} · {detail.sourceFormat?.toUpperCase()}{' '}
                  · {kb(detail.sourceBytes)}
                </dd>
                <dt className="text-brown-muted">Output</dt>
                <dd>{detail.width ? `${detail.width}×${detail.height} WebP` : '—'}</dd>
                <dt className="text-brown-muted">Uploaded</dt>
                <dd>{formatDateTime(detail.createdAt)}</dd>
                <dt className="text-brown-muted">Used by</dt>
                <dd>
                  {usageTotal === 0
                    ? 'Not used'
                    : `${detail.usage.products} product(s), ${detail.usage.categories} categor${detail.usage.categories === 1 ? 'y' : 'ies'}, ${detail.usage.home} homepage`}
                </dd>
              </dl>
              {detail.variants.length ? (
                <div>
                  <p className="mb-1 font-semibold">Generated sizes</p>
                  <ul className="space-y-1">
                    {detail.variants.map((variant) => (
                      <li key={variant.name} className="flex justify-between gap-2">
                        <a
                          href={variant.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-terracotta-deep underline-offset-4 hover:underline"
                        >
                          {variant.name}
                        </a>
                        <span className="text-brown-muted">
                          {variant.width}×{variant.height} · {kb(variant.bytes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Field
                label="Alt text"
                hint="Default description used when the image is added to a product."
              >
                {(props) => (
                  <Textarea
                    {...props}
                    value={alt}
                    maxLength={200}
                    disabled={!writable}
                    onChange={(event) => setAlt(event.target.value)}
                    className="min-h-20"
                  />
                )}
              </Field>
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this image?"
        destructive
        confirmLabel="Delete image"
        message={
          usageTotal > 0
            ? 'This image is still in use. Remove it from those products, categories or the homepage first — deletion will be refused.'
            : 'All generated sizes are removed from storage. This cannot be undone.'
        }
        busy={remove.busy}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!detail) return;
          const result = await remove.run(`/media/${detail.id}`, {
            method: 'DELETE',
            success: 'Image deleted',
          });
          setConfirmDelete(false);
          if (result !== null) close();
        }}
      />
    </>
  );
}
