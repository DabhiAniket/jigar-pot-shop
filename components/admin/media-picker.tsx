'use client';

import { useEffect, useState } from 'react';
import type { MediaAssetDTO, Paginated } from '@jmh/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api/client';
import { ImageUploadDialog } from './image-uploader';

/** Choose an existing processed image from the library, or upload a new one. */
export function MediaPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (asset: MediaAssetDTO) => void;
}) {
  const [assets, setAssets] = useState<MediaAssetDTO[] | null>(null);
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<Paginated<MediaAssetDTO>>(
        `/admin/media?status=ready&limit=60${query ? `&q=${encodeURIComponent(query)}` : ''}`,
        { signal: controller.signal },
      )
        .then((response) => setAssets(response.data))
        .catch(() => undefined);
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  return (
    <>
      <Dialog
        open={open && !uploading}
        onClose={onClose}
        size="xl"
        title="Image library"
        description="Pick a processed image or upload a new one."
        footer={<Button onClick={() => setUploading(true)}>Upload new image</Button>}
      >
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by file name or alt text"
          aria-label="Search images"
          className="mb-4 h-10 w-full rounded-xl border border-brown/20 bg-white px-3 text-sm"
        />
        {assets === null ? (
          <div className="flex justify-center py-10">
            <Spinner label="Loading images" />
          </div>
        ) : assets.length === 0 ? (
          <p className="py-10 text-center text-brown-muted">No images yet. Upload the first one.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {assets.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(asset);
                    onClose();
                  }}
                  className="block w-full overflow-hidden rounded-xl border-2 border-transparent hover:border-terracotta"
                  title={asset.alt || asset.originalFilename}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail variant */}
                  <img
                    src={asset.variants[0]?.url}
                    alt={asset.alt || asset.originalFilename}
                    className="aspect-square w-full bg-cream-deep object-contain"
                    loading="lazy"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
      <ImageUploadDialog
        open={uploading}
        onClose={() => setUploading(false)}
        onUploaded={(asset) => {
          onPick(asset);
          setUploading(false);
          onClose();
        }}
      />
    </>
  );
}
