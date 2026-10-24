// Builds optimised brand assets for the storefront from the supplied artwork in assets/brand-source.
//   node scripts/build-brand-assets.mjs
// Outputs WebP images to public/brand/v1 and app icons to app/.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(path.join(root, 'package.json'));
const sharp = require('sharp');

const src = (name) => path.join(root, 'assets/brand-source', name);
const outDir = path.join(root, 'public/brand/v1');
const appDir = path.join(root, 'app');
await fs.mkdir(outDir, { recursive: true });

const CREAM = { r: 246, g: 240, b: 229, alpha: 1 };

// 1. Horizontal logo (white background, shown with mix-blend-mode: multiply on light surfaces).
const logo = await sharp(src('logo-horizontal.png')).trim({ threshold: 12 }).toBuffer();
for (const width of [480, 960]) {
  await sharp(logo)
    .resize({ width })
    .webp({ quality: 90, effort: 6 })
    .toFile(path.join(outDir, `logo-${width}.webp`));
}

// 2. Circular emblem with a transparent surround, for the dark footer.
const EMBLEM = { cx: 628, cy: 628, r: 592 };
const size = EMBLEM.r * 2;
const circle = Buffer.from(
  `<svg width="${size}" height="${size}"><circle cx="${EMBLEM.r}" cy="${EMBLEM.r}" r="${EMBLEM.r}" fill="#fff"/></svg>`,
);
const emblem = await sharp(src('emblem-sign.png'))
  .extract({ left: EMBLEM.cx - EMBLEM.r, top: EMBLEM.cy - EMBLEM.r, width: size, height: size })
  .composite([{ input: circle, blend: 'dest-in' }])
  .png()
  .toBuffer();
for (const width of [256, 512]) {
  await sharp(emblem)
    .resize({ width })
    .webp({ quality: 88, alphaQuality: 90, effort: 6 })
    .toFile(path.join(outDir, `emblem-${width}.webp`));
}

// 3. Store photograph.
for (const width of [960, 1600]) {
  await sharp(src('store-front.png'))
    .resize({ width })
    .webp({ quality: 80, effort: 6, smartSubsample: true })
    .toFile(path.join(outDir, `store-front-${width}.webp`));
}

// 4. App icons: the brand pot from the logo on a cream tile.
const pot = await sharp(src('logo-horizontal.png'))
  .extract({ left: 172, top: 46, width: 566, height: 566 })
  .toBuffer();
const tile = (sizePx, radius) =>
  sharp({ create: { width: sizePx, height: sizePx, channels: 4, background: CREAM } })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${sizePx}" height="${sizePx}"><rect width="${sizePx}" height="${sizePx}" rx="${radius}" fill="#fff"/></svg>`,
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();
async function icon(sizePx, file, rounded = true) {
  const inner = Math.round(sizePx * 0.86);
  const potResized = await sharp(pot)
    .resize({ width: inner, height: inner })
    .modulate({ saturation: 1.05 })
    .toBuffer();
  const base = rounded
    ? await tile(sizePx, Math.round(sizePx * 0.22))
    : await sharp({ create: { width: sizePx, height: sizePx, channels: 4, background: CREAM } })
        .png()
        .toBuffer();
  const offset = Math.round((sizePx - inner) / 2);
  // Multiply makes the artwork's white background take on the cream tile colour.
  const image = await sharp(base)
    .composite([{ input: potResized, left: offset, top: offset, blend: 'multiply' }])
    .png()
    .toBuffer();
  await fs.writeFile(file, image);
  return image;
}
await icon(512, path.join(appDir, 'icon.png'));
await icon(180, path.join(appDir, 'apple-icon.png'), false);

// favicon.ico containing a single 32×32 PNG (ICO allows embedded PNG data).
const favicon = await sharp(await icon(64, path.join(outDir, '.tmp-icon.png')))
  .resize(32, 32)
  .png()
  .toBuffer();
await fs.rm(path.join(outDir, '.tmp-icon.png'));
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6);
header.writeUInt8(32, 7);
header.writeUInt8(0, 8);
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(favicon.length, 14);
header.writeUInt32LE(22, 18);
await fs.writeFile(path.join(appDir, 'favicon.ico'), Buffer.concat([header, favicon]));

// 5. Default Open Graph image: the shop front with its signboard.
await sharp(src('store-front.png'))
  .extract({ left: 0, top: 0, width: 1374, height: 721 })
  .resize(1200, 630)
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(path.join(appDir, 'opengraph-image.jpg'));

const files = await fs.readdir(outDir);
for (const file of files.sort()) {
  const stat = await fs.stat(path.join(outDir, file));
  console.log(`brand/v1/${file}  ${(stat.size / 1024).toFixed(0)} KB`);
}
console.log('app/icon.png, app/apple-icon.png, app/favicon.ico, app/opengraph-image.jpg written');
