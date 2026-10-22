import type { Metadata } from 'next';
import type { HomePageDTO } from '@jmh/shared';
import { Hero } from '@/components/home/hero';
import { PotteryStory } from '@/components/home/pottery-story';
import {
  CategoryGrid,
  CraftSection,
  ProductSection,
  PromotionBanner,
  VisitStore,
} from '@/components/home/sections';
import { JsonLd } from '@/components/store/json-ld';
import { RecentlyViewed } from '@/components/store/recently-viewed';
import { buildSafeGet } from '@/lib/api/server';
import { getSettings } from '@/lib/api/store-data';
import { storeJsonLd } from '@/lib/seo';

export const revalidate = 60;

const FALLBACK: HomePageDTO = {
  content: {
    hero: {
      eyebrow: 'Handcrafted earthenware',
      headline: 'માટીની ખુશ્બૂ, પરંપરાનો સ્પર્શ',
      headlineLang: 'gu',
      subheadline: 'Discover handcrafted clay pots and timeless earthenware for your home.',
      primaryCta: { label: 'Shop Products', href: '/shop' },
      secondaryCta: { label: 'Explore Our Craft', href: '/#craft' },
      image: null,
      video: { mp4Url: null, webmUrl: null, posterUrl: null },
    },
    story: { enabled: false, chapters: [] },
    craft: { enabled: false, title: '', body: '', points: [] },
    featuredCategoryIds: [],
    sections: {
      bestsellers: true,
      newArrivals: true,
      offers: true,
      recentlyViewed: true,
      visitStore: true,
    },
  },
  categories: [],
  bestsellers: [],
  newArrivals: [],
  featured: [],
  offers: [],
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: {
      absolute:
        settings?.seo.defaultTitle ?? 'Jigar Matka House — Handcrafted Clay Pots & Earthenware',
    },
    description: settings?.seo.defaultDescription ?? undefined,
    alternates: { canonical: '/' },
  };
}

export default async function HomePage() {
  const [home, settings] = await Promise.all([
    buildSafeGet<{ data: HomePageDTO }>(
      '/home',
      { data: FALLBACK },
      { tags: ['catalog', 'home', 'promotions'] },
    ).then((r) => r.data),
    getSettings(),
  ]);
  const { content } = home;
  const storyCategories = content.featuredCategoryIds.length
    ? content.featuredCategoryIds
        .map((id) => home.categories.find((category) => category.id === id))
        .filter((category) => category !== undefined)
    : home.categories;

  return (
    <>
      <JsonLd data={storeJsonLd(settings)} />
      <Hero hero={content.hero} />
      {content.story.enabled ? (
        <PotteryStory chapters={content.story.chapters} categories={storyCategories} />
      ) : null}
      <PromotionBanner banner={settings?.banners[0]} />
      {content.sections.bestsellers ? (
        <ProductSection
          id="bestsellers"
          eyebrow="Loved by our customers"
          title="Bestsellers"
          products={home.bestsellers}
          href="/shop?bestseller=true"
        />
      ) : null}
      <CategoryGrid categories={home.categories} />
      {content.sections.newArrivals ? (
        <ProductSection
          id="new"
          eyebrow="Fresh from the kiln"
          title="New arrivals"
          products={home.newArrivals}
          href="/shop?sort=newest"
          tone="deep"
        />
      ) : null}
      <CraftSection craft={content.craft} />
      <ProductSection
        id="featured"
        eyebrow="Featured collection"
        title="Chosen for your home"
        products={home.featured}
        href="/shop?featured=true"
      />
      {content.sections.offers ? (
        <ProductSection
          id="offers"
          eyebrow="Special offers"
          title="Offers on handcrafted favourites"
          products={home.offers}
          href="/shop?onSale=true"
          tone="deep"
        />
      ) : null}
      {content.sections.visitStore ? <VisitStore settings={settings} /> : null}
      {content.sections.recentlyViewed ? <RecentlyViewed /> : null}
    </>
  );
}
