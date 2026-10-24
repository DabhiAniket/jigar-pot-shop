'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { ADMIN_ROLE_LABELS, type AdminMe, type Permission } from '@jmh/shared';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { AdminProvider } from './admin-context';

const NAV: { href: string; label: string; permission: Permission }[] = [
  { href: '/admin', label: 'Dashboard', permission: 'dashboard:read' },
  { href: '/admin/orders', label: 'Orders', permission: 'orders:read' },
  { href: '/admin/products', label: 'Products', permission: 'products:read' },
  { href: '/admin/categories', label: 'Categories', permission: 'products:read' },
  { href: '/admin/media', label: 'Image library', permission: 'media:read' },
  { href: '/admin/inventory', label: 'Inventory', permission: 'inventory:read' },
  { href: '/admin/customers', label: 'Customers', permission: 'customers:read' },
  { href: '/admin/promotions', label: 'Promotions', permission: 'promotions:read' },
  { href: '/admin/content', label: 'Homepage', permission: 'content:write' },
  { href: '/admin/settings', label: 'Store settings', permission: 'settings:read' },
  { href: '/admin/users', label: 'Admin users', permission: 'users:manage' },
  { href: '/admin/audit', label: 'Audit log', permission: 'audit:read' },
];

export function AdminShell({ me, children }: { me: AdminMe; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = me.mustChangePassword
    ? []
    : NAV.filter((item) => me.permissions.includes(item.permission));

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  const nav = (
    <nav aria-label="Admin" className="flex flex-col gap-0.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          aria-current={isActive(item.href) ? 'page' : undefined}
          className={cn(
            'rounded-xl px-3 py-2 text-[0.9375rem] font-medium transition-colors',
            isActive(item.href) ? 'bg-brown text-cream' : 'text-brown hover:bg-brown/5',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <AdminProvider me={me}>
      <div className="min-h-dvh bg-[#faf6ef] lg:grid lg:grid-cols-[15.5rem_1fr]">
        <aside className="no-print hidden border-r border-brown/10 bg-cream px-4 py-5 lg:flex lg:flex-col">
          <Link href="/admin" className="mb-6 block px-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- brand asset */}
            <img
              src="/brand/v1/logo-transparent-480.webp"
              width={480}
              height={143}
              alt="Jigar Matka House admin"
              className="h-10 w-auto"
            />
          </Link>
          {nav}
          <div className="mt-auto border-t border-brown/10 pt-4">
            <UserBox me={me} />
          </div>
        </aside>

        <div className="min-w-0">
          <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-brown/10 bg-cream/95 px-4 backdrop-blur lg:hidden">
            <button
              type="button"
              className="-ml-1 rounded-lg p-2"
              aria-label="Open admin menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <span className="font-display text-lg">Admin</span>
          </header>
          {open ? (
            <div
              className="fixed inset-0 z-50 lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Admin menu"
            >
              <button
                type="button"
                className="absolute inset-0 bg-brown-deep/50"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              />
              <div className="absolute inset-y-0 left-0 flex w-72 flex-col overflow-y-auto bg-cream p-4">
                {nav}
                <div className="mt-auto border-t border-brown/10 pt-4">
                  <UserBox me={me} />
                </div>
              </div>
            </div>
          ) : null}
          <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </AdminProvider>
  );
}

function UserBox({ me }: { me: AdminMe }) {
  return (
    <div className="px-2 text-sm">
      <p className="font-semibold">{me.name}</p>
      <p className="truncate text-brown-muted">{me.email}</p>
      <p className="mt-1 text-xs font-semibold tracking-wide text-terracotta-deep uppercase">
        {ADMIN_ROLE_LABELS[me.role]}
      </p>
      <div className="mt-3 flex gap-3">
        <Link href="/admin/account" className="font-semibold underline-offset-4 hover:underline">
          My account
        </Link>
        <button
          type="button"
          className="font-semibold text-terracotta-deep underline-offset-4 hover:underline"
          onClick={async () => {
            await api('/admin/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload so the server layout re-reads the session cookie
            window.location.assign('/admin/login');
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
