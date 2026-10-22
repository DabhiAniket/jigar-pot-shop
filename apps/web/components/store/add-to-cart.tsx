'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cart } from '@/lib/cart';
import { buttonClasses } from '@/components/ui/button';

export interface QuickAddProduct {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  unitPrice: number;
  hasVariants: boolean;
  available: boolean;
}

/** Card-level action: add simple products directly; send variant products to their page. */
export function QuickAddButton({ product }: { product: QuickAddProduct }) {
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 2200);
    return () => clearTimeout(timer);
  }, [added]);

  if (!product.available) {
    return (
      <span
        className={buttonClasses('secondary', 'sm', 'w-full cursor-default opacity-60')}
        aria-disabled="true"
      >
        Out of stock
      </span>
    );
  }
  if (product.hasVariants) {
    return (
      <Link
        href={`/products/${product.slug}`}
        className={buttonClasses('secondary', 'sm', 'w-full')}
        aria-label={`Choose options for ${product.name}`}
      >
        Choose options
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={buttonClasses(added ? 'dark' : 'primary', 'sm', 'w-full')}
      aria-label={added ? `${product.name} added to cart` : `Add ${product.name} to cart`}
      onClick={() => {
        cart.add({
          productId: product.id,
          variantId: null,
          quantity: 1,
          name: product.name,
          variantName: null,
          slug: product.slug,
          image: product.image,
          unitPrice: product.unitPrice,
        });
        setAdded(true);
      }}
    >
      <span aria-live="polite">{added ? 'Added to cart ✓' : 'Add to cart'}</span>
    </button>
  );
}
