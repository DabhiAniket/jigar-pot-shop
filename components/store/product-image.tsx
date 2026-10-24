import type { ImageDTO } from '@jmh/shared';
import { cn } from '@/lib/utils';

interface ProductImageProps {
  image: ImageDTO | null;
  /** CSS `sizes` hint so the browser picks the right WebP variant. */
  sizes: string;
  alt?: string;
  className?: string;
  priority?: boolean;
  fit?: 'cover' | 'contain';
}

/**
 * Responsive product image backed by the pipeline's pre-generated WebP variants. Width/height
 * attributes reserve space (no layout shift) and the inline blur placeholder shows while loading.
 */
export function ProductImage({
  image,
  sizes,
  alt,
  className,
  priority,
  fit = 'cover',
}: ProductImageProps) {
  if (!image || image.variants.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center bg-cream-deep text-brown-muted', className)}
        role="img"
        aria-label={alt ?? 'Image coming soon'}
      >
        <svg viewBox="0 0 48 48" className="size-10 opacity-50" aria-hidden="true">
          <path
            d="M16 10h16M18 10c0 3-6 5-6 14 0 8 5 14 12 14s12-6 12-14c0-9-6-11-6-14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      </div>
    );
  }
  const largest = image.variants[image.variants.length - 1]!;
  const fallback = image.variants.find((variant) => variant.width >= 560) ?? largest;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- variants are already optimised WebP from our pipeline
    <img
      src={fallback.url}
      srcSet={image.variants.map((variant) => `${variant.url} ${variant.width}w`).join(', ')}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={alt ?? image.alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={cn(
        fit === 'cover' ? 'object-cover' : 'object-contain',
        'bg-cream-deep',
        className,
      )}
      style={
        image.placeholder
          ? {
              backgroundImage: `url(${image.placeholder})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    />
  );
}
