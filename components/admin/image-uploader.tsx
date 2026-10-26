'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { ACCEPTED_IMAGE_MIME_TYPES, type MediaAssetDTO } from '@jmh/shared';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { FormError } from '@/components/ui/form';
import { api, ClientApiError, uploadToBlob, uploadWithProgress } from '@/lib/api/client';
import { cn } from '@/lib/utils';

const MAX_BYTES = 15 * 1024 * 1024;
// Vercel functions reject request bodies over 4.5 MB; bigger files upload straight to Blob.
const MAX_DIRECT_BYTES = 4 * 1024 * 1024;
const ASPECTS = [
  { label: 'Square 1:1', value: 1, hint: 'Recommended for product cards' },
  { label: 'Portrait 4:5', value: 4 / 5 },
  { label: 'Portrait 3:4', value: 3 / 4 },
  { label: 'Landscape 16:9', value: 16 / 9, hint: 'Banners' },
  { label: 'Original', value: 0 },
];

type Step = 'select' | 'loading' | 'crop' | 'preview' | 'uploading' | 'processing' | 'done';

/** Renders exactly what the server will produce: rotate around the centre, then extract the crop. */
async function renderPreview(source: ImageBitmap, crop: Area, rotation: number): Promise<string> {
  const radians = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const boundsWidth = source.width * cos + source.height * sin;
  const boundsHeight = source.width * sin + source.height * cos;
  const scale = Math.min(1, 900 / Math.max(crop.width, crop.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(crop.width * scale);
  canvas.height = Math.round(crop.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f6f0e5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.translate(-crop.x, -crop.y);
  ctx.translate(boundsWidth / 2, boundsHeight / 2);
  ctx.rotate(radians);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas.toDataURL('image/jpeg', 0.85);
}

/** An already processed image to crop again; the result is a new image, the original stays. */
export interface EditSource {
  id: string;
  alt: string;
  /** URL of the largest stored variant: crop coordinates are relative to this image. */
  url: string;
}

export function ImageUploadDialog({
  open,
  onClose,
  onUploaded,
  defaultAlt = '',
  source,
  replaceId,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: (asset: MediaAssetDTO) => void;
  defaultAlt?: string;
  source?: EditSource;
  /** Upload a new picture for this existing image: its record, and every use of it, is kept. */
  replaceId?: string;
}) {
  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [alt, setAlt] = useState(defaultAlt);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const cancelled = useRef(false);

  const reset = useCallback(() => {
    setStep('select');
    setFile(null);
    setBitmap(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspect(1);
    setArea(null);
    setPreview(null);
    setProgress(0);
    setError(null);
    setObjectUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  useEffect(
    () => () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl],
  );

  const uploadPath = replaceId ? `/admin/media/${replaceId}/replace` : '/admin/media';
  const sourceId = source?.id;
  const sourceUrl = source?.url;
  const sourceAlt = source?.alt;
  const [loadKey, setLoadKey] = useState(0);
  useEffect(() => {
    if (!open || !sourceUrl) return;
    let active = true;
    (async () => {
      setStep('loading');
      setError(null);
      try {
        // Same-origin in development; Blob and CDN URLs allow cross-origin reads.
        const response = await fetch(sourceUrl);
        if (!response.ok) throw new Error(String(response.status));
        const blob = await response.blob();
        const decoded = await createImageBitmap(blob, { imageOrientation: 'from-image' });
        if (!active) return;
        setBitmap(decoded);
        setObjectUrl(URL.createObjectURL(blob));
        setAlt(sourceAlt ?? '');
        setAspect(0); // start from the whole image so nothing is cut until the admin chooses
        setStep('crop');
      } catch {
        if (active) setError('Could not load this image for editing. Check your connection.');
      }
    })();
    return () => {
      active = false;
    };
  }, [open, sourceId, sourceUrl, sourceAlt, loadKey]);

  const choose = async (selected: File | undefined) => {
    setError(null);
    if (!selected) return;
    if (!(ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(selected.type)) {
      setError('Please choose a JPEG, PNG or WebP image.');
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError('This image is larger than 15 MB. Please choose a smaller file.');
      return;
    }
    try {
      // Browsers apply EXIF orientation here, matching the server's auto-orient step.
      const decoded = await createImageBitmap(selected, { imageOrientation: 'from-image' });
      if (decoded.width < 200 || decoded.height < 200) {
        setError('Images must be at least 200×200 pixels.');
        return;
      }
      setBitmap(decoded);
      setFile(selected);
      setObjectUrl(URL.createObjectURL(selected));
      setAlt(
        (current) => current || selected.name.replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' '),
      );
      setStep('crop');
    } catch {
      setError('This file could not be read as an image.');
    }
  };

  const goPreview = async () => {
    if (!bitmap || !area) return;
    setPreview(await renderPreview(bitmap, area, rotation));
    setStep('preview');
  };

  const upload = async () => {
    if ((!file && !source) || !area) return;
    cancelled.current = false;
    setStep('uploading');
    setError(null);
    const cropArea = {
      x: Math.max(0, Math.round(area.x)),
      y: Math.max(0, Math.round(area.y)),
      width: Math.round(area.width),
      height: Math.round(area.height),
      rotation: Math.round(rotation),
    };
    try {
      let created: { data: MediaAssetDTO };
      if (source) {
        created = await api<{ data: MediaAssetDTO }>(`/admin/media/${source.id}/recrop`, {
          body: { alt: alt.trim().slice(0, 200), crop: cropArea },
        });
      } else if (file!.size <= MAX_DIRECT_BYTES) {
        const form = new FormData();
        form.append('alt', alt.trim().slice(0, 200));
        form.append('crop', JSON.stringify(cropArea));
        form.append('file', file!);
        const request = uploadWithProgress<{ data: MediaAssetDTO }>(uploadPath, form, setProgress);
        abortRef.current = request.abort;
        created = await request.promise;
      } else {
        const controller = new AbortController();
        abortRef.current = () => controller.abort();
        const blobPathname = await uploadToBlob(file!, setProgress, controller.signal);
        created = await api<{ data: MediaAssetDTO }>(uploadPath, {
          body: {
            blobPathname,
            originalName: file!.name,
            alt: alt.trim().slice(0, 200),
            crop: cropArea,
          },
        });
      }
      const { data } = created;
      setStep('processing');
      // Poll until the worker has produced the WebP variants.
      for (let attempt = 0; attempt < 120 && !cancelled.current; attempt++) {
        const { data: asset } = await api<{ data: MediaAssetDTO }>(`/admin/media/${data.id}`);
        if (asset.status === 'ready') {
          setStep('done');
          onUploaded(asset);
          reset();
          onClose();
          return;
        }
        if (asset.status === 'failed')
          throw new ClientApiError(
            422,
            'PROCESSING_FAILED',
            asset.error ?? 'Image processing failed.',
          );
        await new Promise((resolve) => setTimeout(resolve, attempt < 10 ? 700 : 2000));
      }
      if (!cancelled.current)
        throw new ClientApiError(
          0,
          'TIMEOUT',
          'Processing is taking longer than expected. The image will appear in the library when ready.',
        );
    } catch (reason) {
      setStep('preview');
      setError(reason instanceof ClientApiError ? reason.message : 'Upload failed.');
    } finally {
      abortRef.current = null;
    }
  };

  const busy = step === 'uploading' || step === 'processing';
  const close = () => {
    cancelled.current = true;
    abortRef.current?.();
    reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={busy}
      size="xl"
      title={source ? 'Edit image' : replaceId ? 'Replace image' : 'Upload image'}
      description={
        source
          ? 'Crop, zoom or rotate the stored image. Nothing changes until you save; then every place that uses it shows the new crop.'
          : replaceId
            ? 'Choose a new picture, crop it and check the preview. Nothing changes until you save; then every place that uses this image shows the new one.'
            : 'Crop and preview, then the image is converted to optimised WebP sizes automatically.'
      }
      footer={
        step === 'crop' ? (
          <>
            {source ? null : (
              <Button variant="secondary" onClick={reset}>
                Choose another
              </Button>
            )}
            <Button onClick={goPreview} disabled={!area}>
              Preview
            </Button>
          </>
        ) : step === 'preview' || busy ? (
          <>
            <Button variant="secondary" onClick={() => setStep('crop')} disabled={busy}>
              Back to crop
            </Button>
            <Button onClick={upload} loading={busy}>
              {step === 'uploading'
                ? `Uploading ${Math.round(progress * 100)}%`
                : step === 'processing'
                  ? 'Processing…'
                  : source
                    ? 'Save changes'
                    : replaceId
                      ? 'Replace image'
                      : 'Upload & process'}
            </Button>
          </>
        ) : null
      }
    >
      <FormError message={error} />
      {step === 'loading' ? (
        <div className="flex flex-col items-center gap-3 py-16" role="status">
          {error ? (
            <Button variant="secondary" onClick={() => setLoadKey((key) => key + 1)}>
              Try again
            </Button>
          ) : (
            <Spinner label="Loading image" />
          )}
        </div>
      ) : null}
      {step === 'select' && !source ? (
        <label
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void choose(event.dataTransfer.files[0]);
          }}
          className={cn(
            'mt-3 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-16 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-terracotta-deep',
            dragging
              ? 'border-terracotta bg-terracotta-soft/40'
              : 'border-brown/25 hover:border-brown/50',
          )}
        >
          <span className="text-lg font-semibold">Drop an image here or choose a file</span>
          <span className="mt-1 text-sm text-brown-muted">
            JPEG, PNG or WebP · up to 15 MB · at least 200×200 px. On a phone you can take a photo.
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => void choose(event.target.files?.[0])}
          />
        </label>
      ) : null}

      {step === 'crop' && objectUrl && bitmap ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_16rem]">
          {/* Blank corners (after rotating) are saved in this colour, so the editor shows the same. */}
          <div
            className="relative h-[52vh] min-h-72 overflow-hidden rounded-2xl"
            style={{ backgroundColor: '#f6f0e5' }}
          >
            <Cropper
              image={objectUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect || bitmap.width / bitmap.height}
              minZoom={1}
              maxZoom={5}
              keyboardStep={8}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={(_, pixels) => setArea(pixels)}
              cropperProps={
                {
                  'aria-label': 'Crop area. Use the arrow keys to move the image.',
                } as React.HTMLAttributes<HTMLDivElement>
              }
            />
          </div>
          <div className="space-y-5 text-sm">
            <fieldset>
              <legend className="mb-2 font-semibold">Aspect ratio</legend>
              <div className="flex flex-col gap-1.5">
                {ASPECTS.map((option) => (
                  <label key={option.label} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="aspect"
                      checked={aspect === option.value}
                      onChange={() => setAspect(option.value)}
                      className="accent-terracotta"
                    />
                    {option.label}
                    {option.hint ? (
                      <span className="text-xs text-brown-muted">— {option.hint}</span>
                    ) : null}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="font-semibold">Zoom ({zoom.toFixed(1)}×)</span>
              <input
                type="range"
                min={1}
                max={5}
                step={0.05}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="mt-1 w-full accent-terracotta"
              />
            </label>
            <label className="block">
              <span className="font-semibold">Rotate ({Math.round(rotation)}°)</span>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={rotation}
                onChange={(event) => setRotation(Number(event.target.value))}
                className="mt-1 w-full accent-terracotta"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setRotation((r) => ((r - 90 + 540) % 360) - 180)}
              >
                ⟲ 90°
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setRotation((r) => ((r + 90 + 540) % 360) - 180)}
              >
                ⟳ 90°
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setZoom(1);
                  setRotation(0);
                  setCrop({ x: 0, y: 0 });
                }}
              >
                Reset
              </Button>
            </div>
            <p className="text-xs text-brown-muted">
              Original: {bitmap.width}×{bitmap.height}px
              {area ? ` · Crop: ${Math.round(area.width)}×${Math.round(area.height)}px` : ''}
            </p>
          </div>
        </div>
      ) : null}

      {(step === 'preview' || busy) && preview ? (
        <div className="grid gap-5 md:grid-cols-[1fr_18rem]">
          <div className="flex items-center justify-center rounded-2xl bg-cream-deep p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
            <img
              src={preview}
              alt="Preview of the cropped image"
              className="max-h-[50vh] w-auto rounded-xl shadow-soft"
            />
          </div>
          <div className="space-y-4 text-sm">
            <label className="block">
              <span className="font-semibold">Alt text</span>
              <span className="block text-xs text-brown-muted">
                Describe the product for screen readers and search engines.
              </span>
              <textarea
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
                maxLength={200}
                disabled={busy}
                className="mt-1 min-h-24 w-full rounded-xl border border-brown/20 bg-white p-3"
              />
            </label>
            {busy ? (
              <div role="status" aria-live="polite">
                <div className="h-2 overflow-hidden rounded-full bg-brown/10">
                  <div
                    className={cn(
                      'h-full bg-terracotta transition-[width]',
                      step === 'processing' && 'animate-pulse',
                    )}
                    style={{
                      width: `${step === 'processing' ? 100 : Math.round(progress * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-brown-muted">
                  {step === 'uploading'
                    ? 'Uploading the original…'
                    : 'Creating WebP sizes (thumbnail, card, standard, large)…'}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
