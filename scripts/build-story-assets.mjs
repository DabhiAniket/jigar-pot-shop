// Converts pottery renders (tools/pottery-renderer output) into:
//   apps/api/seed/images/...        JPEG sources for the demo seed (sent through the real upload pipeline)
//   apps/web/public/story/v1/...    WebP assets for the cinematic homepage + lib/story-assets.json
// Usage: node scripts/build-story-assets.mjs <renders-dir>
// Safe to re-run; missing render groups are simply skipped.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(path.join(root, 'apps/api/package.json'));
const sharp = require('sharp');

const renders = path.resolve(process.argv[2] ?? 'renders');
const seedDir = path.join(root, 'apps/api/seed/images');
const storyDir = path.join(root, 'apps/web/public/story/v1');
const manifestFile = path.join(root, 'apps/web/lib/story-assets.json');
const exists = (p) =>
  fs.access(p).then(
    () => true,
    () => false,
  );
const pngs = async (dir) =>
  (await exists(dir)) ? (await fs.readdir(dir)).filter((f) => f.endsWith('.png')).sort() : [];

let alts = {};
try {
  const manifest = JSON.parse(await fs.readFile(path.join(renders, 'manifest.json'), 'utf8'));
  for (const entry of manifest.files ?? manifest)
    if (entry.file && entry.description) alts[entry.file.replace(/\\/g, '/')] = entry.description;
} catch {
  alts = {};
}

// 1. Seed sources (JPEG keeps the repo small; the pipeline re-encodes to WebP anyway).
let seedCount = 0;
for (const group of ['products', 'categories']) {
  const base = path.join(renders, group);
  if (!(await exists(base))) continue;
  const entries = await fs.readdir(base, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      for (const file of await pngs(path.join(base, entry.name))) {
        const out = path.join(seedDir, group, entry.name, file.replace('.png', '.jpg'));
        await fs.mkdir(path.dirname(out), { recursive: true });
        await sharp(path.join(base, entry.name, file))
          .flatten({ background: '#f6f0e5' })
          .resize({ width: 1400, withoutEnlargement: true })
          .jpeg({ quality: 88, mozjpeg: true })
          .toFile(out);
        seedCount++;
      }
    } else if (entry.name.endsWith('.png')) {
      const out = path.join(seedDir, group, entry.name.replace('.png', '.jpg'));
      await fs.mkdir(path.dirname(out), { recursive: true });
      await sharp(path.join(base, entry.name))
        .flatten({ background: '#f6f0e5' })
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 88, mozjpeg: true })
        .toFile(out);
      seedCount++;
    }
  }
}

// 2. Story assets.
await fs.mkdir(storyDir, { recursive: true });
async function responsive(input, name, widths, options = {}) {
  const meta = await sharp(input).metadata();
  const files = [];
  for (const width of widths.filter((w) => w <= meta.width)) {
    const file = `${name}-${width}.webp`;
    await sharp(input)
      .resize({ width })
      .webp({ quality: options.quality ?? 80, alphaQuality: 90, effort: 5, smartSubsample: true })
      .toFile(path.join(storyDir, file));
    files.push({ width, url: `/story/v1/${file}` });
  }
  const largest = files.at(-1);
  return {
    src: largest.url,
    srcSet: files.map((f) => `${f.url} ${f.width}w`).join(', '),
    width: largest.width,
    height: Math.round((meta.height / meta.width) * largest.width),
  };
}

/**
 * The rendered shadow-catcher keeps a faint tint up to the frame edge, which shows as a box on the
 * page. Fade its alpha out with a soft ellipse centred on the contact shadow.
 */
async function fadeEdges(input) {
  const { width, height } = await sharp(input).metadata();
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}"><defs><radialGradient id="g" cx="50%" cy="78%" r="50%" gradientTransform="translate(0.5 0.78) scale(1 0.5) translate(-0.5 -0.78)">` +
      `<stop offset="0.55" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
      `<rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );
  return sharp(input)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

const manifest = {
  version: 'v1',
  available: false,
  hero: null,
  sequence: null,
  collection: null,
  textures: [],
};

if (
  (await exists(path.join(renders, 'hero/matka.png'))) &&
  (await exists(path.join(renders, 'hero/matka-shadow.png')))
) {
  manifest.hero = {
    pot: await responsive(path.join(renders, 'hero/matka.png'), 'hero-matka', [640, 1000, 1400], {
      quality: 82,
    }),
    shadow: await responsive(
      await fadeEdges(path.join(renders, 'hero/matka-shadow.png')),
      'hero-matka-shadow',
      [640, 1000, 1400],
      { quality: 70 },
    ),
    alt:
      alts['hero/matka.png'] ??
      'Round terracotta matka with a lid and a hand-painted cream zigzag band',
  };
}

const frames = await pngs(path.join(renders, 'sequence'));
if (frames.length >= 12) {
  await fs.mkdir(path.join(storyDir, 'seq/desktop'), { recursive: true });
  await fs.mkdir(path.join(storyDir, 'seq/mobile'), { recursive: true });
  const desktop = [];
  const mobile = [];
  const first = await sharp(path.join(renders, 'sequence', frames[0])).metadata();
  const cropWidth = Math.round(first.height * 0.8);
  for (const [index, file] of frames.entries()) {
    const input = path.join(renders, 'sequence', file);
    const name = `${String(index).padStart(3, '0')}.webp`;
    await sharp(input)
      .resize({ width: 1280 })
      .webp({ quality: 74, alphaQuality: 80, effort: 4 })
      .toFile(path.join(storyDir, 'seq/desktop', name));
    desktop.push(`/story/v1/seq/desktop/${name}`);
    if (index % 2 === 0) {
      // Portrait centre crop for phones.
      await sharp(input)
        .extract({
          left: Math.round((first.width - cropWidth) / 2),
          top: 0,
          width: cropWidth,
          height: first.height,
        })
        .resize({ width: 640 })
        .webp({ quality: 72, alphaQuality: 80, effort: 4 })
        .toFile(path.join(storyDir, 'seq/mobile', name));
      mobile.push(`/story/v1/seq/mobile/${name}`);
    }
  }
  manifest.sequence = {
    desktop,
    mobile,
    width: 1280,
    height: Math.round((first.height / first.width) * 1280),
    mobileWidth: 640,
    mobileHeight: Math.round((first.height / cropWidth) * 640),
  };
}

if (await exists(path.join(renders, 'collection/group.png'))) {
  manifest.collection = {
    ...(await responsive(
      path.join(renders, 'collection/group.png'),
      'collection',
      [960, 1600, 2400],
      { quality: 78 },
    )),
    alt:
      alts['collection/group.png'] ??
      'A collection of handcrafted terracotta pots, planters and lamps on a cream backdrop',
  };
}

const TEXTURES = [
  [
    'clay-grain',
    'Grain of the clay',
    'Throwing lines left by the potter’s wheel and the fine speckle of fired earth.',
  ],
  ['pattern-band', 'Painted by hand', 'Zigzags and dots brushed on one stroke at a time.'],
  ['rim-detail', 'A lid that fits', 'Turned rims and knobs that seal in the coolness.'],
];
for (const [name, title, caption] of TEXTURES) {
  const input = path.join(renders, 'texture', `${name}.png`);
  if (!(await exists(input))) continue;
  manifest.textures.push({
    ...(await responsive(input, `texture-${name}`, [800, 1400, 2000], { quality: 80 })),
    alt: alts[`texture/${name}.png`] ?? `${title}: close-up of terracotta`,
    title,
    caption,
  });
}

// Groups whose render sources are absent keep the assets already published in public/story/v1,
// so re-running the script with a partial renders directory never drops working assets.
async function published(name) {
  const files = (await fs.readdir(storyDir))
    .map((file) => file.match(new RegExp(`^${name}-(\\d+)\\.webp$`)))
    .filter(Boolean)
    .map((match) => ({ width: Number(match[1]), url: `/story/v1/${match[0]}` }))
    .sort((a, b) => a.width - b.width);
  if (files.length === 0) return null;
  const largest = files.at(-1);
  const meta = await sharp(path.join(storyDir, path.basename(largest.url))).metadata();
  return {
    src: largest.url,
    srcSet: files.map((f) => `${f.url} ${f.width}w`).join(', '),
    width: meta.width,
    height: meta.height,
  };
}
if (!manifest.hero) {
  const [pot, shadow] = [await published('hero-matka'), await published('hero-matka-shadow')];
  if (pot && shadow) {
    manifest.hero = {
      pot,
      shadow,
      alt: 'Round terracotta matka with a lid and a hand-painted cream zigzag band',
    };
  }
}
if (!manifest.sequence) {
  const list = async (dir) =>
    (await exists(path.join(storyDir, 'seq', dir)))
      ? (await fs.readdir(path.join(storyDir, 'seq', dir)))
          .sort()
          .map((f) => `/story/v1/seq/${dir}/${f}`)
      : [];
  const [desktop, mobile] = [await list('desktop'), await list('mobile')];
  if (desktop.length >= 12 && mobile.length) {
    const d = await sharp(path.join(storyDir, 'seq/desktop', path.basename(desktop[0]))).metadata();
    const m = await sharp(path.join(storyDir, 'seq/mobile', path.basename(mobile[0]))).metadata();
    manifest.sequence = {
      desktop,
      mobile,
      width: d.width,
      height: d.height,
      mobileWidth: m.width,
      mobileHeight: m.height,
    };
  }
}
if (!manifest.collection) {
  const collection = await published('collection');
  if (collection) {
    manifest.collection = {
      ...collection,
      alt: 'A collection of handcrafted terracotta pots, planters and lamps on a cream backdrop',
    };
  }
}
if (manifest.textures.length === 0) {
  for (const [name, title, caption] of TEXTURES) {
    const texture = await published(`texture-${name}`);
    if (texture)
      manifest.textures.push({
        ...texture,
        alt: `${title}: close-up of terracotta`,
        title,
        caption,
      });
  }
}

manifest.available = Boolean(
  manifest.hero || manifest.sequence || manifest.collection || manifest.textures.length,
);
await fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `seed images: ${seedCount}; hero: ${Boolean(manifest.hero)}; frames: ${manifest.sequence?.desktop.length ?? 0}/${manifest.sequence?.mobile.length ?? 0}; collection: ${Boolean(manifest.collection)}; textures: ${manifest.textures.length}`,
);
