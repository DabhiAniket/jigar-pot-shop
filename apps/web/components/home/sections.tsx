import Link from 'next/link';
import {
  buildWhatsAppUrl,
  type CategoryDTO,
  type HomeContentDTO,
  type ProductSummary,
  type PromotionBannerDTO,
  type PublicStoreSettings,
} from '@jmh/shared';
import { ProductRail } from '@/components/store/product-card';
import { ProductImage } from '@/components/store/product-image';
import { WhatsAppIcon } from '@/components/store/site-footer';
import { ButtonLink, buttonClasses } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/misc';
import { storyAssets } from '@/lib/story-assets';
import { cn, formatDate } from '@/lib/utils';

export function CategoryGrid({ categories }: { categories: CategoryDTO[] }) {
  if (categories.length === 0) return null;
  return (
    <section aria-labelledby="categories-title" className="container-page py-20 md:py-28">
      <SectionHeading
        id="categories-title"
        eyebrow="Shop by collection"
        title="Earthenware for every corner of home"
        action={
          <ButtonLink href="/shop" variant="secondary">
            View all products
          </ButtonLink>
        }
      />
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {categories.map((category, index) => (
          <li key={category.id} className={cn('reveal', index === 0 && 'col-span-2 row-span-2')}>
            <Link
              href={`/collections/${category.slug}`}
              className="group relative block h-full overflow-hidden rounded-[1.75rem] bg-cream-deep"
            >
              <div
                className={cn('overflow-hidden', index === 0 ? 'aspect-square' : 'aspect-[4/5]')}
              >
                <ProductImage
                  image={category.image}
                  sizes={
                    index === 0 ? '(min-width: 768px) 46vw, 92vw' : '(min-width: 768px) 22vw, 46vw'
                  }
                  className="size-full transition-transform duration-700 ease-[var(--ease-craft)] group-hover:scale-[1.05]"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brown-deep/70 via-brown-deep/25 to-transparent p-4 pt-16 text-cream md:p-6">
                <h3
                  className={cn(
                    'font-medium',
                    index === 0 ? 'text-3xl md:text-4xl' : 'text-xl md:text-2xl',
                  )}
                >
                  {category.name}
                </h3>
                {category.nameGu ? (
                  <p lang="gu" className="text-sm text-cream/85">
                    {category.nameGu}
                  </p>
                ) : null}
                <p className="mt-1 text-xs font-semibold tracking-[0.14em] text-gold uppercase">
                  {category.productCount} {category.productCount === 1 ? 'piece' : 'pieces'}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProductSection({
  id,
  eyebrow,
  title,
  description,
  products,
  href,
  tone = 'cream',
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  products: ProductSummary[];
  href: string;
  tone?: 'cream' | 'deep';
}) {
  if (products.length === 0) return null;
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn('py-20 md:py-24', tone === 'deep' && 'bg-cream-deep')}
    >
      <div className="container-page">
        <SectionHeading
          id={`${id}-title`}
          eyebrow={eyebrow}
          title={title}
          description={description}
          action={
            <Link
              href={href}
              className="text-sm font-semibold text-terracotta-deep underline-offset-4 hover:underline"
            >
              See all →
            </Link>
          }
        />
        <ProductRail products={products.slice(0, 8)} />
      </div>
    </section>
  );
}

export function CraftSection({ craft }: { craft: HomeContentDTO['craft'] }) {
  if (!craft.enabled) return null;
  const texture = storyAssets.textures[0];
  return (
    <section id="craft" aria-labelledby="craft-title" className="scroll-mt-24 bg-brown text-cream">
      <div className="container-page grid items-center gap-12 py-20 md:grid-cols-12 md:py-28">
        <div className="md:col-span-5">
          {texture ? (
            <div className="overflow-hidden rounded-[2rem]">
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimised render */}
              <img
                src={texture.src}
                srcSet={texture.srcSet}
                sizes="(min-width: 768px) 40vw, 100vw"
                width={texture.width}
                height={texture.height}
                alt={texture.alt}
                loading="lazy"
                className="parallax-slow aspect-[4/5] w-full scale-110 object-cover"
              />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- brand asset
            <img
              src="/brand/v1/emblem-512.webp"
              width={512}
              height={512}
              alt=""
              className="mx-auto w-3/4"
              loading="lazy"
            />
          )}
        </div>
        <div className="md:col-span-6 md:col-start-7">
          <p className="font-sans text-xs font-bold tracking-[0.2em] text-gold uppercase">
            Our craft
          </p>
          <h2 id="craft-title" className="mt-4 text-4xl leading-[1.05] font-medium md:text-6xl">
            {craft.title}
          </h2>
          <div className="mt-6 h-px w-24 bg-gradient-to-r from-gold to-transparent" />
          <p className="mt-6 text-lg leading-relaxed text-cream/80">{craft.body}</p>
          {craft.points.length ? (
            <ul className="mt-10 grid gap-6 sm:grid-cols-3">
              {craft.points.map((point) => (
                <li key={point.title} className="reveal border-t border-gold/40 pt-4">
                  <h3 className="font-display text-lg text-cream">{point.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-cream/70">{point.body}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function PromotionBanner({ banner }: { banner: PromotionBannerDTO | undefined }) {
  if (!banner) return null;
  return (
    <section aria-label="Current offer" className="container-page py-10">
      <div className="grain relative overflow-hidden rounded-[2rem] bg-terracotta px-6 py-12 text-white md:px-14 md:py-16">
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 size-80 rounded-full border border-white/15"
        />
        <div
          aria-hidden="true"
          className="absolute -right-10 -top-10 size-52 rounded-full border border-gold/40"
        />
        <div className="relative max-w-2xl">
          <p className="font-sans text-xs font-bold tracking-[0.2em] text-cream/90 uppercase">
            Limited time · until {formatDate(banner.endsAt)}
          </p>
          <h2 className="mt-3 text-4xl leading-[1.05] font-medium md:text-6xl">
            {banner.headline}
          </h2>
          {banner.subtext ? <p className="mt-4 text-lg text-white/90">{banner.subtext}</p> : null}
          {banner.code ? (
            <p className="mt-4 text-sm">
              Use code{' '}
              <span className="rounded-md bg-white/15 px-2 py-1 font-mono font-bold tracking-wider">
                {banner.code}
              </span>{' '}
              at checkout
            </p>
          ) : null}
          {banner.ctaHref ? (
            <Link href={banner.ctaHref} className={buttonClasses('dark', 'lg', 'mt-8')}>
              {banner.ctaLabel ?? 'Shop the offer'}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * "Inside the shop": an ambient, video-like scene made from the store photograph and close-ups
 * (slow Ken Burns drift, cross-fades, warm grade, film grain). Replace with a real clip later by
 * configuring a hero video in Admin → Homepage.
 */
export function VisitStore({ settings }: { settings: PublicStoreSettings | null }) {
  const address = settings?.address;
  const addressText = [address?.line1, address?.line2, address?.city].filter(Boolean).join(', ');
  const whatsapp = settings?.whatsappNumber
    ? buildWhatsAppUrl(
        settings.whatsappNumber,
        `Hello ${settings.storeName}! I would like to visit the store.`,
      )
    : null;
  const layers = [
    {
      src: '/brand/v1/store-front-1600.webp',
      srcSet: '/brand/v1/store-front-960.webp 960w, /brand/v1/store-front-1600.webp 1600w',
    },
    ...storyAssets.textures
      .slice(1, 3)
      .map((texture) => ({ src: texture.src, srcSet: texture.srcSet })),
  ];
  return (
    <section
      aria-labelledby="visit-title"
      className="relative isolate overflow-hidden bg-brown-deep text-cream"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        {layers.map((layer, index) => (
          // eslint-disable-next-line @next/next/no-img-element -- decorative ambient layer
          <img
            key={layer.src}
            src={layer.src}
            srcSet={layer.srcSet}
            sizes="100vw"
            alt=""
            loading="lazy"
            decoding="async"
            className={cn(
              'absolute inset-0 size-full object-cover',
              layers.length > 1 ? 'animate-film' : 'animate-ken-burns',
            )}
            style={{
              animationDelay: layers.length > 1 ? `${index * -6}s, ${index * -6}s` : undefined,
            }}
          />
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(47_36_30/0.92)_0%,rgb(47_36_30/0.7)_45%,rgb(47_36_30/0.25)_100%)]" />
        <div className="grain absolute inset-0" />
      </div>
      <div className="container-page flex min-h-[78svh] items-center py-20">
        <div className="max-w-xl">
          <p className="font-sans text-xs font-bold tracking-[0.2em] text-gold uppercase">
            Visit the shop
          </p>
          <h2 id="visit-title" className="mt-4 text-4xl leading-[1.05] font-medium md:text-6xl">
            Shelves of clay, warm light and a cup of chai
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-cream/80">
            Pick up your water pot in person, feel the weight of a handi, or ask us which planter
            suits your balcony.
          </p>
          {addressText ? <p className="mt-6 font-semibold text-cream">{addressText}</p> : null}
          <div className="mt-8 flex flex-wrap gap-3">
            {address?.mapUrl ? (
              <a
                href={address.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses('primary', 'lg')}
              >
                Get directions
              </a>
            ) : null}
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses('whatsapp', 'lg')}
              >
                <WhatsAppIcon className="size-5" /> Message us
              </a>
            ) : null}
            <ButtonLink
              href="/shop"
              variant="secondary"
              size="lg"
              className="border-cream/40 text-cream hover:border-cream hover:bg-cream/10"
            >
              Shop online
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
