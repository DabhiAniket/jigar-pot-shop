'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cartCount, useCart, useCartReady } from '@/lib/cart';
import { cn } from '@/lib/utils';

interface NavCategory {
  name: string;
  nameGu: string | null;
  slug: string;
}

export function SiteHeader({ categories }: { categories: NavCategory[] }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const collectionsRef = useRef<HTMLDivElement>(null);
  const cart = useCart();
  const ready = useCartReady();
  const count = ready ? cartCount(cart) : 0;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
    setCollectionsOpen(false);
    setSearchOpen(false);
  }

  useEffect(() => {
    if (!collectionsOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!collectionsRef.current?.contains(event.target as Node)) setCollectionsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setCollectionsOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [collectionsOpen]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    if (menuOpen) document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={cn(
        'relative py-2 text-[0.9375rem] font-semibold text-brown transition-colors hover:text-terracotta-deep',
        pathname === href && 'text-terracotta-deep',
      )}
    >
      {label}
    </Link>
  );

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300',
        scrolled ? 'bg-cream/90 shadow-[0_1px_0_rgb(69_53_44/0.08)] backdrop-blur-md' : 'bg-cream',
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-brown focus:px-4 focus:py-2 focus:text-cream"
      >
        Skip to content
      </a>
      <div
        className={cn(
          'container-page flex items-center gap-4 transition-[height] duration-300',
          scrolled ? 'h-16' : 'h-[4.5rem] md:h-20',
        )}
      >
        <button
          type="button"
          className="-ml-2 rounded-full p-2 lg:hidden"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen(true)}
        >
          <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
            <path
              d="M4 7h16M4 12h16M4 17h10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <Link href="/" className="flex shrink-0 items-center" aria-label="Jigar Matka House — home">
          {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-optimised brand asset */}
          <img
            src="/brand/v1/logo-transparent-480.webp"
            srcSet="/brand/v1/logo-transparent-480.webp 480w, /brand/v1/logo-transparent-960.webp 960w"
            sizes="200px"
            width={480}
            height={143}
            alt="Jigar Matka House"
            className={cn(
              'w-auto transition-[height] duration-300',
              scrolled ? 'h-10' : 'h-11 md:h-14',
            )}
          />
        </Link>

        <nav aria-label="Main" className="ml-6 hidden items-center gap-7 lg:flex">
          {navLink('/shop', 'Shop')}
          <div ref={collectionsRef} className="relative">
            <button
              type="button"
              className="flex items-center gap-1 py-2 text-[0.9375rem] font-semibold text-brown hover:text-terracotta-deep"
              aria-expanded={collectionsOpen}
              aria-controls="collections-menu"
              onClick={() => setCollectionsOpen((open) => !open)}
            >
              Collections
              <svg
                viewBox="0 0 12 8"
                className={cn('size-3 transition-transform', collectionsOpen && 'rotate-180')}
                aria-hidden="true"
              >
                <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.6" fill="none" />
              </svg>
            </button>
            {collectionsOpen ? (
              <div
                id="collections-menu"
                className="absolute left-1/2 top-full z-50 mt-3 w-[34rem] -translate-x-1/2 rounded-3xl border border-brown/10 bg-cream p-3 shadow-lift"
              >
                <ul className="grid grid-cols-2 gap-1">
                  {categories.map((category) => (
                    <li key={category.slug}>
                      <Link
                        href={`/collections/${category.slug}`}
                        className="flex flex-col rounded-2xl px-4 py-3 transition-colors hover:bg-cream-deep"
                      >
                        <span className="font-semibold text-brown">{category.name}</span>
                        {category.nameGu ? (
                          <span lang="gu" className="text-sm text-brown-muted">
                            {category.nameGu}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          {navLink('/#craft', 'Our Craft')}
          {navLink('/track-order', 'Track Order')}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {searchOpen ? (
            <form action="/shop" role="search" className="hidden items-center sm:flex">
              <label htmlFor="header-search" className="sr-only">
                Search products
              </label>
              <input
                id="header-search"
                name="q"
                type="search"
                autoFocus
                placeholder="Search matkas, planters…"
                maxLength={80}
                onBlur={(event) => !event.currentTarget.value && setSearchOpen(false)}
                className="h-10 w-56 rounded-full border border-brown/20 bg-white/80 px-4 text-sm focus:border-terracotta-deep focus:outline-none"
              />
            </form>
          ) : null}
          <button
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            className={cn('rounded-full p-2.5 hover:bg-brown/5', searchOpen && 'sm:hidden')}
            aria-label="Search products"
            aria-expanded={searchOpen}
          >
            <svg viewBox="0 0 24 24" className="size-5.5" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
              <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <Link
            href="/cart"
            className="relative rounded-full p-2.5 hover:bg-brown/5"
            aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
          >
            <svg viewBox="0 0 24 24" className="size-5.5" aria-hidden="true">
              <path
                d="M5 8h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8z"
                stroke="currentColor"
                strokeWidth="1.8"
                fill="none"
                strokeLinejoin="round"
              />
              <path
                d="M9 8V6.5a3 3 0 0 1 6 0V8"
                stroke="currentColor"
                strokeWidth="1.8"
                fill="none"
              />
            </svg>
            {count > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1 text-[0.6875rem] font-bold text-white">
                {count}
              </span>
            ) : null}
          </Link>
          <span className="sr-only" aria-live="polite">
            {ready ? `${count} items in cart` : ''}
          </span>
        </div>
      </div>

      {searchOpen ? (
        <form action="/shop" role="search" className="container-page pb-3 sm:hidden">
          <label htmlFor="header-search-mobile" className="sr-only">
            Search products
          </label>
          <input
            id="header-search-mobile"
            name="q"
            type="search"
            autoFocus
            placeholder="Search matkas, planters…"
            maxLength={80}
            className="h-11 w-full rounded-full border border-brown/20 bg-white/80 px-4 text-sm focus:border-terracotta-deep focus:outline-none"
          />
        </form>
      ) : null}

      {menuOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <button
            type="button"
            className="absolute inset-0 bg-brown-deep/50"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col overflow-y-auto bg-cream px-6 py-5 shadow-lift">
            <div className="mb-6 flex items-center justify-between">
              {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
              <img
                src="/brand/v1/logo-transparent-480.webp"
                width={480}
                height={143}
                alt=""
                className="h-10 w-auto"
              />
              <button
                type="button"
                className="rounded-full p-2"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                autoFocus
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
            <nav aria-label="Mobile" className="flex flex-col gap-1 text-lg font-semibold">
              <Link href="/shop" className="rounded-xl px-3 py-2.5 hover:bg-cream-deep">
                Shop all
              </Link>
              <p className="eyebrow mt-4 mb-1 px-3">Collections</p>
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/collections/${category.slug}`}
                  className="rounded-xl px-3 py-2 text-base hover:bg-cream-deep"
                >
                  {category.name}
                </Link>
              ))}
              <div className="gold-rule my-4" />
              <Link href="/#craft" className="rounded-xl px-3 py-2.5 hover:bg-cream-deep">
                Our Craft
              </Link>
              <Link href="/track-order" className="rounded-xl px-3 py-2.5 hover:bg-cream-deep">
                Track Order
              </Link>
              <Link href="/cart" className="rounded-xl px-3 py-2.5 hover:bg-cream-deep">
                Cart {count > 0 ? `(${count})` : ''}
              </Link>
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
