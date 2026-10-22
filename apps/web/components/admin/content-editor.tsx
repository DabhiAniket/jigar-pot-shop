'use client';

import { useState } from 'react';
import type { HomeContentDTO, ImageDTO } from '@jmh/shared';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormError, Input, Select, Textarea } from '@/components/ui/form';
import { useMutation } from './admin-context';
import { MediaPicker } from './media-picker';
import { Card } from './ui';

type Item = { title: string; body: string };

const SECTION_LABELS: [keyof HomeContentDTO['sections'], string][] = [
  ['bestsellers', 'Bestsellers'],
  ['newArrivals', 'New arrivals'],
  ['offers', 'Special offers'],
  ['recentlyViewed', 'Recently viewed (per visitor)'],
  ['visitStore', 'Visit the shop'],
];

function ItemList({
  items,
  setItems,
  max,
  min,
  label,
  bodyMax,
  titleMax,
  errorPrefix,
  errors,
}: {
  items: Item[];
  setItems: (items: Item[]) => void;
  max: number;
  min: number;
  label: string;
  bodyMax: number;
  titleMax: number;
  errorPrefix: string;
  errors: Record<string, string[]>;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const error = Object.entries(errors).find(([key]) =>
          key.startsWith(`${errorPrefix}.${index}`),
        )?.[1][0];
        return (
          <div key={index} className="rounded-2xl border border-brown/10 p-3">
            <div className="grid gap-3 md:grid-cols-[14rem_1fr]">
              <label className="text-xs font-semibold">
                {label} {index + 1} title
                <input
                  value={item.title}
                  maxLength={titleMax}
                  onChange={(e) =>
                    setItems(
                      items.map((it, i) => (i === index ? { ...it, title: e.target.value } : it)),
                    )
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-brown/20 px-2 text-sm font-normal"
                />
              </label>
              <label className="text-xs font-semibold">
                Text
                <textarea
                  value={item.body}
                  maxLength={bodyMax}
                  onChange={(e) =>
                    setItems(
                      items.map((it, i) => (i === index ? { ...it, body: e.target.value } : it)),
                    )
                  }
                  className="mt-1 min-h-16 w-full rounded-lg border border-brown/20 p-2 text-sm font-normal"
                />
              </label>
            </div>
            <div className="mt-2 flex items-center justify-between">
              {error ? <p className="text-sm text-danger">{error}</p> : <span />}
              <button
                type="button"
                disabled={items.length <= min}
                onClick={() => setItems(items.filter((_, i) => i !== index))}
                className="text-sm font-semibold text-danger disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}
      <Button
        size="sm"
        variant="secondary"
        disabled={items.length >= max}
        onClick={() => setItems([...items, { title: '', body: '' }])}
      >
        Add {label.toLowerCase()}
      </Button>
    </div>
  );
}

export function ContentEditor({
  content,
  categories,
}: {
  content: HomeContentDTO;
  categories: { id: string; name: string }[];
}) {
  const { run, busy, error, fieldErrors } = useMutation();
  const [hero, setHero] = useState(content.hero);
  const [image, setImage] = useState<ImageDTO | null>(content.hero.image);
  const [storyEnabled, setStoryEnabled] = useState(content.story.enabled);
  const [chapters, setChapters] = useState<Item[]>(
    content.story.chapters.length ? content.story.chapters : [{ title: '', body: '' }],
  );
  const [craft, setCraft] = useState({
    enabled: content.craft.enabled,
    title: content.craft.title,
    body: content.craft.body,
  });
  const [points, setPoints] = useState<Item[]>(content.craft.points);
  const [featured, setFeatured] = useState<string[]>(content.featuredCategoryIds);
  const [sections, setSections] = useState(content.sections);
  const [picker, setPicker] = useState(false);
  const err = (path: string) => fieldErrors[path];
  const setHeroField = <K extends keyof typeof hero>(key: K, value: (typeof hero)[K]) =>
    setHero((current) => ({ ...current, [key]: value }));

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        await run('/content/home', {
          method: 'PUT',
          success: 'Homepage updated',
          body: {
            hero: {
              eyebrow: hero.eyebrow || null,
              headline: hero.headline,
              headlineLang: hero.headlineLang,
              subheadline: hero.subheadline || null,
              primaryCta: hero.primaryCta,
              secondaryCta: hero.secondaryCta,
              image: image ? { assetId: image.assetId, alt: image.alt } : null,
              video: {
                mp4Url: hero.video.mp4Url || null,
                webmUrl: hero.video.webmUrl || null,
                posterUrl: hero.video.posterUrl || null,
              },
            },
            story: { enabled: storyEnabled, chapters },
            craft: { ...craft, points },
            featuredCategoryIds: featured,
            sections,
          },
        });
      }}
    >
      <FormError
        message={Object.keys(fieldErrors).length ? 'Please correct the highlighted fields.' : error}
      />
      <Card title="Hero">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Eyebrow" error={err('hero.eyebrow')}>
            {(props) => (
              <Input
                {...props}
                value={hero.eyebrow ?? ''}
                maxLength={60}
                onChange={(e) => setHeroField('eyebrow', e.target.value)}
              />
            )}
          </Field>
          <Field label="Headline language" error={err('hero.headlineLang')}>
            {(props) => (
              <Select
                {...props}
                value={hero.headlineLang}
                onChange={(e) => setHeroField('headlineLang', e.target.value as 'gu' | 'en')}
              >
                <option value="gu">Gujarati</option>
                <option value="en">English</option>
              </Select>
            )}
          </Field>
          <Field label="Headline" required error={err('hero.headline')} className="md:col-span-2">
            {(props) => (
              <Input
                {...props}
                lang={hero.headlineLang}
                value={hero.headline}
                maxLength={120}
                onChange={(e) => setHeroField('headline', e.target.value)}
              />
            )}
          </Field>
          <Field label="Supporting text" error={err('hero.subheadline')} className="md:col-span-2">
            {(props) => (
              <Textarea
                {...props}
                value={hero.subheadline ?? ''}
                maxLength={240}
                className="min-h-20"
                onChange={(e) => setHeroField('subheadline', e.target.value)}
              />
            )}
          </Field>
          {(['primaryCta', 'secondaryCta'] as const).map((key) => (
            <div key={key} className="grid grid-cols-2 gap-3">
              <Field
                label={key === 'primaryCta' ? 'Primary button' : 'Secondary button'}
                required
                error={err(`hero.${key}.label`)}
              >
                {(props) => (
                  <Input
                    {...props}
                    value={hero[key].label}
                    maxLength={40}
                    onChange={(e) => setHeroField(key, { ...hero[key], label: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Link" required error={err(`hero.${key}.href`)}>
                {(props) => (
                  <Input
                    {...props}
                    value={hero[key].href}
                    maxLength={300}
                    onChange={(e) => setHeroField(key, { ...hero[key], href: e.target.value })}
                  />
                )}
              </Field>
            </div>
          ))}
          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-semibold">Hero image (optional)</p>
            <p className="mb-2 text-xs text-brown-muted">
              When empty, the studio-rendered matka is shown.
            </p>
            <div className="flex items-center gap-4">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- pipeline variant
                <img
                  src={image.variants[0]?.url}
                  alt={image.alt}
                  className="size-20 rounded-xl object-cover"
                />
              ) : null}
              <Button size="sm" variant="secondary" onClick={() => setPicker(true)}>
                {image ? 'Change image' : 'Choose image'}
              </Button>
              {image ? (
                <button
                  type="button"
                  className="text-sm font-semibold text-danger"
                  onClick={() => setImage(null)}
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          <div className="space-y-3 md:col-span-2">
            <p className="text-sm font-semibold">Background video (optional)</p>
            <p className="text-xs text-brown-muted">
              Short, muted, compressed clip hosted on your CDN (MP4 and/or WebM, plus a poster
              image). Shown on larger screens only and never for visitors who prefer reduced motion.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {(['mp4Url', 'webmUrl', 'posterUrl'] as const).map((key) => (
                <Field
                  key={key}
                  label={
                    key === 'mp4Url'
                      ? 'MP4 URL'
                      : key === 'webmUrl'
                        ? 'WebM URL'
                        : 'Poster image URL'
                  }
                  error={err(`hero.video.${key}`)}
                >
                  {(props) => (
                    <Input
                      {...props}
                      type="url"
                      value={hero.video[key] ?? ''}
                      onChange={(e) =>
                        setHeroField('video', { ...hero.video, [key]: e.target.value })
                      }
                    />
                  )}
                </Field>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Scroll story">
        <Checkbox
          label="Show the “making of a matka” story"
          checked={storyEnabled}
          onChange={(e) => setStoryEnabled(e.target.checked)}
        />
        <div className="mt-4">
          <ItemList
            items={chapters}
            setItems={setChapters}
            min={1}
            max={5}
            label="Chapter"
            titleMax={80}
            bodyMax={400}
            errorPrefix="story.chapters"
            errors={fieldErrors}
          />
        </div>
      </Card>

      <Card title="Craftsmanship section">
        <div className="space-y-4">
          <Checkbox
            label="Show this section"
            checked={craft.enabled}
            onChange={(e) => setCraft((c) => ({ ...c, enabled: e.target.checked }))}
          />
          <Field label="Title" required error={err('craft.title')}>
            {(props) => (
              <Input
                {...props}
                value={craft.title}
                maxLength={100}
                onChange={(e) => setCraft((c) => ({ ...c, title: e.target.value }))}
              />
            )}
          </Field>
          <Field label="Text" required error={err('craft.body')}>
            {(props) => (
              <Textarea
                {...props}
                value={craft.body}
                maxLength={1200}
                onChange={(e) => setCraft((c) => ({ ...c, body: e.target.value }))}
              />
            )}
          </Field>
          <ItemList
            items={points}
            setItems={setPoints}
            min={0}
            max={4}
            label="Point"
            titleMax={60}
            bodyMax={240}
            errorPrefix="craft.points"
            errors={fieldErrors}
          />
        </div>
      </Card>

      <Card title="Featured collections in the story">
        <p className="mb-3 text-sm text-brown-muted">
          Choose up to 12; when none are chosen, active categories with images are used.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Checkbox
              key={category.id}
              label={category.name}
              checked={featured.includes(category.id)}
              disabled={!featured.includes(category.id) && featured.length >= 12}
              onChange={(e) =>
                setFeatured((current) =>
                  e.target.checked
                    ? [...current, category.id]
                    : current.filter((id) => id !== category.id),
                )
              }
            />
          ))}
        </div>
      </Card>

      <Card title="Homepage sections">
        <div className="grid gap-2 sm:grid-cols-2">
          {SECTION_LABELS.map(([key, label]) => (
            <Checkbox
              key={key}
              label={label}
              checked={sections[key]}
              onChange={(e) => setSections((current) => ({ ...current, [key]: e.target.checked }))}
            />
          ))}
        </div>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" size="lg" loading={busy} className="shadow-lift">
          Save homepage
        </Button>
      </div>
      <MediaPicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(asset) =>
          setImage({
            assetId: asset.id,
            alt: asset.alt,
            width: asset.width ?? 0,
            height: asset.height ?? 0,
            placeholder: asset.placeholder,
            variants: asset.variants.map(({ name, url, width, height }) => ({
              name,
              url,
              width,
              height,
            })),
          })
        }
      />
    </form>
  );
}
