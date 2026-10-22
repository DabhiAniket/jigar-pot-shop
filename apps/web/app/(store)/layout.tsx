import Link from 'next/link';
import { SiteFooter } from '@/components/store/site-footer';
import { SiteHeader } from '@/components/store/site-header';
import { getCategories, getSettings } from '@/lib/api/store-data';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
  const banner = settings?.banners[0] ?? null;
  const announcement = banner ? banner.headline : (settings?.delivery.note ?? null);

  return (
    <>
      {announcement ? (
        <div className="bg-brown text-cream">
          <p className="container-page flex min-h-9 items-center justify-center gap-3 py-1.5 text-center text-[0.8125rem] font-medium tracking-wide">
            <span>{announcement}</span>
            {banner?.ctaHref ? (
              <Link
                href={banner.ctaHref}
                className="font-semibold text-gold underline-offset-4 hover:underline"
              >
                {banner.ctaLabel ?? 'Shop now'} →
              </Link>
            ) : null}
          </p>
        </div>
      ) : null}
      <SiteHeader
        categories={categories.map(({ name, nameGu, slug }) => ({ name, nameGu, slug }))}
      />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter settings={settings} categories={categories} />
    </>
  );
}
