import type { HomeContentDTO } from '@jmh/shared';
import { ButtonLink } from '@/components/ui/button';
import { ProductImage } from '@/components/store/product-image';
import { storyAssets } from '@/lib/story-assets';

/**
 * Opening scene. The pot's reveal, the light sweep and the floating dust are CSS animations, so
 * the hero renders fully without JavaScript and calms down under prefers-reduced-motion.
 * A configured background video (MP4/WebM + poster) replaces the ambient layer on larger screens.
 */
export function Hero({ hero }: { hero: HomeContentDTO['hero'] }) {
  const art = storyAssets.hero;
  const video = hero.video.mp4Url || hero.video.webmUrl ? hero.video : null;

  return (
    <section aria-labelledby="hero-title" className="grain relative isolate overflow-hidden">
      {/* Ambient light: warm key light upper right, cool shade lower left. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-1/3 right-[-15%] h-[120%] w-[75%] rounded-full bg-[radial-gradient(closest-side,rgb(214_166_83/0.28),transparent)]" />
        <div className="absolute bottom-[-30%] left-[-20%] h-[90%] w-[70%] rounded-full bg-[radial-gradient(closest-side,rgb(184_92_56/0.12),transparent)]" />
        {video ? (
          <video
            className="absolute inset-0 hidden size-full object-cover opacity-30 motion-safe:md:block"
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            poster={video.posterUrl ?? undefined}
            aria-hidden="true"
          >
            {video.webmUrl ? <source src={video.webmUrl} type="video/webm" /> : null}
            {video.mp4Url ? <source src={video.mp4Url} type="video/mp4" /> : null}
          </video>
        ) : null}
        {Array.from({ length: 9 }).map((_, i) => (
          <span
            key={i}
            className="animate-dust absolute hidden size-1 rounded-full bg-gold/60 md:block"
            style={{
              left: `${48 + ((i * 37) % 46)}%`,
              top: `${40 + ((i * 23) % 50)}%`,
              animationDelay: `${i * 1.1}s`,
            }}
          />
        ))}
      </div>

      <div className="container-page grid min-h-[calc(100svh-6rem)] items-center gap-8 pt-6 pb-14 lg:grid-cols-12 lg:gap-6 lg:pt-0 lg:pb-10">
        <div className="relative z-10 order-2 lg:order-1 lg:col-span-6 xl:col-span-5">
          {hero.eyebrow ? (
            <p className="eyebrow animate-rise" style={{ animationDelay: '0.1s' }}>
              {hero.eyebrow}
            </p>
          ) : null}
          <h1
            id="hero-title"
            lang={hero.headlineLang}
            className={
              hero.headlineLang === 'gu'
                ? 'animate-rise mt-5 font-gujarati text-[2.6rem] leading-[1.18] font-semibold text-brown sm:text-6xl lg:text-[4.35rem]'
                : 'animate-rise mt-5 text-5xl leading-[1.02] font-medium text-brown sm:text-6xl lg:text-7xl'
            }
            style={{ animationDelay: '0.25s' }}
          >
            {hero.headline}
          </h1>
          <div
            className="animate-rise mt-6 h-px w-24 bg-gradient-to-r from-gold to-transparent"
            style={{ animationDelay: '0.4s' }}
          />
          {hero.subheadline ? (
            <p
              className="animate-rise mt-6 max-w-md text-lg leading-relaxed text-brown-muted md:text-xl"
              style={{ animationDelay: '0.5s' }}
            >
              {hero.subheadline}
            </p>
          ) : null}
          <div
            className="animate-rise mt-9 flex flex-wrap gap-3"
            style={{ animationDelay: '0.65s' }}
          >
            <ButtonLink href={hero.primaryCta.href} size="lg">
              {hero.primaryCta.label}
            </ButtonLink>
            <ButtonLink href={hero.secondaryCta.href} size="lg" variant="secondary">
              {hero.secondaryCta.label}
            </ButtonLink>
          </div>
        </div>

        <div className="relative order-1 mx-auto w-full max-w-[34rem] lg:order-2 lg:col-span-6 lg:max-w-none xl:col-span-7">
          <div className="relative mx-auto aspect-[4/5] w-[78%] sm:w-[62%] lg:w-[78%]">
            {art ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimised render */}
                <img
                  src={art.shadow.src}
                  srcSet={art.shadow.srcSet}
                  sizes="(min-width: 1024px) 40vw, 70vw"
                  width={art.shadow.width}
                  height={art.shadow.height}
                  alt=""
                  aria-hidden="true"
                  className="animate-shadow absolute inset-0 size-full object-contain"
                />
                {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimised render; LCP image */}
                <img
                  src={art.pot.src}
                  srcSet={art.pot.srcSet}
                  sizes="(min-width: 1024px) 40vw, 70vw"
                  width={art.pot.width}
                  height={art.pot.height}
                  alt={art.alt}
                  fetchPriority="high"
                  decoding="async"
                  className="animate-pot relative size-full object-contain drop-shadow-[0_30px_40px_rgb(69_53_44/0.18)]"
                />
              </>
            ) : hero.image ? (
              <ProductImage
                image={hero.image}
                sizes="(min-width: 1024px) 40vw, 70vw"
                priority
                fit="contain"
                className="animate-pot size-full rounded-[2rem]"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- brand artwork fallback
              <img
                src="/brand/v1/emblem-512.webp"
                width={512}
                height={512}
                alt="Jigar Matka House"
                className="animate-pot size-full object-contain"
              />
            )}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-[45%]"
            >
              <div className="animate-sweep absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent mix-blend-soft-light" />
            </div>
          </div>
        </div>
      </div>

      <a
        href="#story"
        className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs font-semibold tracking-[0.2em] text-brown-muted uppercase md:flex"
      >
        Scroll
        <span
          className="block h-10 w-px bg-gradient-to-b from-brown-muted to-transparent"
          aria-hidden="true"
        />
      </a>
    </section>
  );
}
