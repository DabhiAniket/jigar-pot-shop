'use client';

import Link from 'next/link';
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CategoryDTO } from '@jmh/shared';
import { buttonClasses } from '@/components/ui/button';
import { ProductImage } from '@/components/store/product-image';
import { storyAssets } from '@/lib/story-assets';

interface StoryProps {
  chapters: { title: string; body: string }[];
  categories: CategoryDTO[];
}

// ── Capability decision ────────────────────────────────────────────────────────────────────────
// The cinematic version needs motion allowed, a capable device and the frame sequence. It is only
// switched on while the visitor is still near the top of the page, so the swap from the static
// server-rendered version never happens in view.
let cinematicDecision: boolean | null = null;
function decideCinematic(): boolean {
  if (cinematicDecision !== null) return cinematicDecision;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const constrained =
    Boolean(nav.connection?.saveData) ||
    (nav.deviceMemory !== undefined && nav.deviceMemory < 3) ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency < 4);
  cinematicDecision =
    !reduced &&
    !constrained &&
    Boolean(storyAssets.sequence) &&
    window.scrollY < window.innerHeight * 0.6;
  return cinematicDecision;
}
const noopSubscribe = () => () => undefined;

export function PotteryStory({ chapters, categories }: StoryProps) {
  const cinematic = useSyncExternalStore(noopSubscribe, decideCinematic, () => false);
  const featured = categories.filter((category) => category.image).slice(0, 4);

  return (
    <section id="story" aria-label="The making of a matka" className="relative">
      {cinematic ? <Turntable chapters={chapters} /> : <StaticIntro chapters={chapters} />}
      {storyAssets.collection ? cinematic ? <CollectionReveal /> : <StaticCollection /> : null}
      <TextureTriptych />
      {featured.length ? (
        cinematic ? (
          <CategoryTransitions categories={featured} />
        ) : (
          <StaticCategories categories={featured} />
        )
      ) : null}
    </section>
  );
}

// ── Act 1: turntable ───────────────────────────────────────────────────────────────────────────

/** Coarse-to-fine load order (every 8th frame, then every 4th, …) so scrubbing works early. */
function progressiveOrder(count: number): number[] {
  const order: number[] = [];
  const seen = new Set<number>();
  for (let step = 8; step >= 1; step = Math.floor(step / 2)) {
    for (let i = 0; i < count; i += step) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
    if (step === 1) break;
  }
  if (!seen.has(count - 1)) order.push(count - 1);
  return order;
}

function Turntable({ chapters }: { chapters: StoryProps['chapters'] }) {
  const sequence = storyAssets.sequence!;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frames = useRef<(HTMLImageElement | null)[]>([]);
  const progressRef = useRef(0);
  const frameRequest = useRef<number | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const draw = useCallback(() => {
    frameRequest.current = null;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || urls.length === 0) return;
    const target = Math.round(progressRef.current * (urls.length - 1));
    let image: HTMLImageElement | null = null;
    for (let offset = 0; offset < urls.length && !image; offset++) {
      image = frames.current[target - offset] ?? frames.current[target + offset] ?? null;
    }
    if (!image) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const wide = width > height * 1.15;
    let scale: number;
    if (wide) {
      // Fill the stage (cover), but never zoom so far past "contain" that the finished pot is cropped.
      const contain = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      const cover = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      scale = Math.min(cover, contain * 1.3);
    } else {
      scale = Math.min(width / image.naturalWidth, (height * 0.7) / image.naturalHeight);
    }
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const centerX = wide ? width * 0.58 : width / 2;
    const top = wide ? (height - drawHeight) / 2 : height * 0.06;
    ctx.drawImage(image, centerX - drawWidth / 2, top, drawWidth, drawHeight);
  }, [urls]);

  const requestDraw = useCallback(() => {
    if (frameRequest.current === null) frameRequest.current = requestAnimationFrame(draw);
  }, [draw]);

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    progressRef.current = value;
    requestDraw();
  });

  // Pick the frame set once the section is about to come into view.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setUrls(window.innerWidth < 768 ? sequence.mobile : sequence.desktop);
          observer.disconnect();
        }
      },
      { rootMargin: '150% 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [sequence]);

  useEffect(() => {
    if (urls.length === 0) return;
    let cancelled = false;
    frames.current = new Array(urls.length).fill(null);
    const order = progressiveOrder(urls.length);
    let cursor = 0;
    let inflight = 0;
    const pump = () => {
      while (!cancelled && inflight < 6 && cursor < order.length) {
        const index = order[cursor++]!;
        const image = new Image();
        image.decoding = 'async';
        image.src = urls[index]!;
        inflight++;
        image
          .decode()
          .then(() => {
            if (cancelled) return;
            frames.current[index] = image;
            requestDraw();
          })
          .catch(() => undefined)
          .finally(() => {
            inflight--;
            pump();
          });
      }
    };
    pump();
    return () => {
      cancelled = true;
    };
  }, [urls, requestDraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      requestDraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      if (frameRequest.current !== null) {
        cancelAnimationFrame(frameRequest.current);
        // Reset, or every later requestDraw() would think a frame is still pending.
        frameRequest.current = null;
      }
    };
  }, [requestDraw]);

  const count = chapters.length;
  return (
    <div ref={containerRef} className="relative h-[380vh]">
      <div className="grain sticky top-0 h-svh overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(60%_55%_at_62%_45%,rgb(214_166_83/0.16),transparent_70%)]"
        />
        {/* Vignette mask: the close-up frames dissolve into the page instead of showing hard edges. */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 size-full [mask-image:radial-gradient(ellipse_75%_70%_at_58%_50%,#000_55%,transparent_100%)] max-md:[mask-image:radial-gradient(ellipse_90%_45%_at_50%_38%,#000_60%,transparent_100%)]"
          aria-hidden="true"
        />
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 hidden w-[52%] bg-gradient-to-r from-cream via-cream/85 to-transparent md:block"
        />
        <div className="container-page relative flex h-full items-end pb-14 md:items-center md:pb-0">
          <div className="relative w-full max-w-md md:max-w-sm lg:max-w-md">
            <p className="eyebrow mb-4">The making of a matka</p>
            <div className="relative min-h-[11rem]">
              {chapters.map((chapter, index) => (
                <Chapter
                  key={chapter.title}
                  progress={scrollYProgress}
                  index={index}
                  count={count}
                  {...chapter}
                />
              ))}
            </div>
          </div>
        </div>
        <ProgressRail progress={scrollYProgress} count={count} />
      </div>
    </div>
  );
}

function Chapter({
  progress,
  index,
  count,
  title,
  body,
}: {
  progress: MotionValue<number>;
  index: number;
  count: number;
  title: string;
  body: string;
}) {
  const span = 0.86 / count;
  const start = 0.06 + index * span;
  const end = start + span;
  const fade = span * 0.22;
  const isLast = index === count - 1;
  const opacity = useTransform(
    progress,
    isLast ? [start, start + fade] : [start, start + fade, end - fade, end],
    isLast ? [0, 1] : [0, 1, 1, 0],
  );
  const y = useTransform(progress, [start, start + fade], [24, 0]);
  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute inset-x-0 bottom-0 md:top-0 md:bottom-auto"
    >
      <span className="font-display text-sm text-terracotta-deep">
        {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
      </span>
      <h2 className="mt-2 text-4xl leading-[1.05] font-medium md:text-5xl">{title}</h2>
      <p className="mt-4 text-lg leading-relaxed text-brown-muted">{body}</p>
    </motion.div>
  );
}

function ProgressRail({ progress, count }: { progress: MotionValue<number>; count: number }) {
  const height = useTransform(progress, [0, 1], ['0%', '100%']);
  return (
    <div
      aria-hidden="true"
      className="absolute top-1/2 right-6 hidden h-48 w-px -translate-y-1/2 bg-brown/15 md:block"
    >
      <motion.div style={{ height }} className="w-px bg-gold" />
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="absolute -left-[3px] size-[7px] rounded-full border border-gold bg-cream"
          style={{ top: `${(i / Math.max(1, count - 1)) * 100}%` }}
        />
      ))}
    </div>
  );
}

function StaticIntro({ chapters }: { chapters: StoryProps['chapters'] }) {
  const hero = storyAssets.hero;
  return (
    <div className="container-page grid items-center gap-10 py-20 md:grid-cols-2 md:py-28">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-sm">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element -- pre-optimised render
          <img
            src={hero.pot.src}
            srcSet={hero.pot.srcSet}
            sizes="(min-width: 768px) 30vw, 80vw"
            width={hero.pot.width}
            height={hero.pot.height}
            alt={hero.alt}
            loading="lazy"
            className="size-full object-contain"
          />
        ) : null}
      </div>
      <div>
        <p className="eyebrow mb-4">The making of a matka</p>
        <ol className="space-y-8">
          {chapters.map((chapter, index) => (
            <li key={chapter.title} className="reveal border-t border-gold/40 pt-6">
              <span className="font-display text-sm text-terracotta-deep">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h2 className="mt-1 text-3xl font-medium">{chapter.title}</h2>
              <p className="mt-2 text-lg leading-relaxed text-brown-muted">{chapter.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ── Act 2: collection reveal ───────────────────────────────────────────────────────────────────

function CollectionReveal() {
  const collection = storyAssets.collection!;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const scale = useTransform(scrollYProgress, [0, 0.75], [1.5, 1]);
  const clipPath = useTransform(
    scrollYProgress,
    [0, 0.55],
    ['inset(16% 20% 16% 20% round 48px)', 'inset(0% 0% 0% 0% round 0px)'],
  );
  const captionOpacity = useTransform(scrollYProgress, [0.5, 0.7], [0, 1]);
  const captionY = useTransform(scrollYProgress, [0.5, 0.7], [30, 0]);
  return (
    <div ref={ref} className="relative h-[230vh]">
      <div className="sticky top-0 h-svh overflow-hidden bg-cream">
        <motion.div style={{ clipPath }} className="absolute inset-0">
          <motion.img
            style={{ scale }}
            src={collection.src}
            srcSet={collection.srcSet}
            sizes="100vw"
            width={collection.width}
            height={collection.height}
            alt={collection.alt}
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-brown-deep/55 to-transparent"
          />
        </motion.div>
        <motion.div
          style={{ opacity: captionOpacity, y: captionY }}
          className="container-page absolute inset-x-0 bottom-12 text-cream md:bottom-16"
        >
          <p className="font-sans text-xs font-bold tracking-[0.2em] text-gold uppercase">
            The collection
          </p>
          <h2 className="mt-3 max-w-2xl text-4xl leading-[1.05] font-medium md:text-6xl">
            One craft. Many forms.
          </h2>
          <p className="mt-4 max-w-lg text-lg text-cream/85">
            From water pots that keep summer at bay to lamps for festival nights.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function StaticCollection() {
  const collection = storyAssets.collection!;
  return (
    <figure className="container-page py-10">
      <div className="overflow-hidden rounded-[2rem]">
        {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimised render */}
        <img
          src={collection.src}
          srcSet={collection.srcSet}
          sizes="(min-width: 1400px) 1400px, 100vw"
          width={collection.width}
          height={collection.height}
          alt={collection.alt}
          loading="lazy"
          className="parallax-slow h-auto w-full"
        />
      </div>
      <figcaption className="mt-6 max-w-2xl">
        <h2 className="text-3xl font-medium md:text-5xl">One craft. Many forms.</h2>
        <p className="mt-3 text-lg text-brown-muted">
          From water pots that keep summer at bay to lamps for festival nights.
        </p>
      </figcaption>
    </figure>
  );
}

// ── Act 3: close-ups (CSS scroll-driven parallax; no JavaScript needed) ───────────────────────────

function TextureTriptych() {
  const textures = storyAssets.textures;
  if (textures.length === 0) return null;
  return (
    <div className="container-page py-20 md:py-28">
      <div className="mb-12 max-w-2xl">
        <p className="eyebrow mb-3">Up close</p>
        <h2 className="text-3xl leading-[1.08] font-medium md:text-5xl">Details you can feel</h2>
      </div>
      <ul className="grid gap-6 md:grid-cols-3 md:gap-8">
        {textures.map((texture, index) => (
          <li key={texture.src} className={index === 1 ? 'md:mt-16' : index === 2 ? 'md:mt-8' : ''}>
            <figure className="reveal">
              <div className="overflow-hidden rounded-[1.75rem] bg-cream-deep">
                {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimised render */}
                <img
                  src={texture.src}
                  srcSet={texture.srcSet}
                  sizes="(min-width: 768px) 30vw, 100vw"
                  width={texture.width}
                  height={texture.height}
                  alt={texture.alt}
                  loading="lazy"
                  decoding="async"
                  className="parallax-slow aspect-[4/5] w-full scale-110 object-cover"
                />
              </div>
              <figcaption className="mt-4">
                <h3 className="text-xl font-medium">{texture.title}</h3>
                <p className="mt-1 text-brown-muted">{texture.caption}</p>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Act 4: category transitions ─────────────────────────────────────────────────────────────────

function CategoryTransitions({ categories }: { categories: CategoryDTO[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [distance, setDistance] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const x = useTransform(scrollYProgress, [0.05, 0.95], [0, -distance]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setDistance(Math.max(0, track.scrollWidth - window.innerWidth));
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const height = useMemo(() => `${120 + categories.length * 55}vh`, [categories.length]);
  return (
    <div ref={ref} className="relative" style={{ height }}>
      <div className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden">
        <div className="container-page mb-8">
          <p className="eyebrow mb-3">Collections</p>
          <h2 className="text-3xl leading-[1.08] font-medium md:text-5xl">Find your form</h2>
        </div>
        <motion.ul
          ref={trackRef}
          style={{ x }}
          className="flex w-max gap-5 px-4 sm:px-6 md:gap-8 lg:px-10"
        >
          {categories.map((category) => (
            <li key={category.id} className="w-[72vw] shrink-0 sm:w-[48vw] lg:w-[34vw]">
              <CategoryPanel category={category} />
            </li>
          ))}
          <li className="flex w-[72vw] shrink-0 items-center sm:w-[40vw] lg:w-[28vw]">
            <div className="rounded-[2rem] bg-brown p-8 text-cream md:p-10">
              <h3 className="text-3xl font-medium md:text-4xl">The whole collection</h3>
              <p className="mt-3 text-cream/80">Every pot, planter and lamp in one place.</p>
              <Link href="/shop" className={buttonClasses('primary', 'lg', 'mt-8')}>
                Explore the collection
              </Link>
            </div>
          </li>
        </motion.ul>
      </div>
    </div>
  );
}

function CategoryPanel({ category }: { category: CategoryDTO }) {
  return (
    <Link href={`/collections/${category.slug}`} className="group block">
      <div className="aspect-[4/5] overflow-hidden rounded-[2rem]">
        <ProductImage
          image={category.image}
          sizes="(min-width: 1024px) 34vw, 72vw"
          className="size-full transition-transform duration-700 group-hover:scale-[1.04]"
        />
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <div>
          <h3 className="text-2xl font-medium md:text-3xl">{category.name}</h3>
          {category.nameGu ? (
            <p lang="gu" className="text-brown-muted">
              {category.nameGu}
            </p>
          ) : null}
        </div>
        <span className="text-sm font-semibold text-terracotta-deep">Explore →</span>
      </div>
    </Link>
  );
}

function StaticCategories({ categories }: { categories: CategoryDTO[] }) {
  return (
    <div className="container-page py-16">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">Collections</p>
          <h2 className="text-3xl font-medium md:text-5xl">Find your form</h2>
        </div>
        <Link href="/shop" className={buttonClasses('secondary', 'md', 'hidden sm:inline-flex')}>
          Explore the collection
        </Link>
      </div>
      <ul className="scrollbar-none -mx-4 flex snap-x gap-5 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
        {categories.map((category) => (
          <li key={category.id} className="w-[70vw] shrink-0 snap-start md:w-auto">
            <CategoryPanel category={category} />
          </li>
        ))}
      </ul>
      <Link href="/shop" className={buttonClasses('primary', 'lg', 'mt-10 sm:hidden')}>
        Explore the collection
      </Link>
    </div>
  );
}
