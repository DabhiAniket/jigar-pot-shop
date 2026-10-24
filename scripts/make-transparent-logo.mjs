// Builds a transparent version of the horizontal logo from its white-background artwork.
// Background = near-white regions connected to the border, plus enclosed near-white letter
// counters right of the pot. Edge pixels get anti-aliased alpha (white is "un-mixed" out).
//   node scripts/make-transparent-logo.mjs
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(path.join(root, 'package.json'));
const sharp = require('sharp');

const src = path.join(root, 'assets/brand-source/logo-horizontal.png');
const trimmed = await sharp(src)
  .trim({ threshold: 12 })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H } = trimmed.info;
const px = trimmed.data;
const N = W * H;
const nearWhite = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const r = px[i * 3],
    g = px[i * 3 + 1],
    b = px[i * 3 + 2];
  const min = Math.min(r, g, b),
    max = Math.max(r, g, b);
  nearWhite[i] = min > 228 && max - min < 22 ? 1 : 0;
}
// Connected components of near-white pixels.
const label = new Int32Array(N).fill(-1);
const bg = new Uint8Array(N);
const stack = new Int32Array(N);
const POT_RIGHT = Math.round(W * 0.33); // pot + swoosh occupy the left third
for (let start = 0; start < N; start++) {
  if (!nearWhite[start] || label[start] !== -1) continue;
  let sp = 0,
    size = 0,
    touchesBorder = false,
    minX = W;
  stack[sp++] = start;
  label[start] = start;
  const members = [];
  while (sp) {
    const p = stack[--sp];
    members.push(p);
    size++;
    const x = p % W,
      y = (p / W) | 0;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touchesBorder = true;
    if (x < minX) minX = x;
    for (const q of [p - 1, p + 1, p - W, p + W]) {
      if (q < 0 || q >= N) continue;
      if ((q === p - 1 && x === 0) || (q === p + 1 && x === W - 1)) continue;
      if (nearWhite[q] && label[q] === -1) {
        label[q] = start;
        stack[sp++] = q;
      }
    }
  }
  if (touchesBorder || (size > 40 && minX > POT_RIGHT)) for (const p of members) bg[p] = 1;
}
// Distance-1/2 edge band around the background for anti-aliasing.
const out = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  const r = px[i * 3],
    g = px[i * 3 + 1],
    b = px[i * 3 + 2];
  let alpha = 255;
  if (bg[i]) alpha = 0;
  else {
    const x = i % W,
      y = (i / W) | 0;
    let nearBg = false;
    for (let dy = -2; dy <= 2 && !nearBg; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx,
          yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && bg[yy * W + xx]) {
          nearBg = true;
          break;
        }
      }
    if (nearBg) {
      const min = Math.min(r, g, b);
      alpha = Math.max(0, Math.min(255, Math.round(((255 - min) / 115) * 255)));
    }
  }
  const a = alpha / 255;
  const unmix = (c) =>
    a > 0.02 ? Math.max(0, Math.min(255, Math.round((c - (1 - a) * 255) / a))) : 0;
  out[i * 4] = alpha < 255 ? unmix(r) : r;
  out[i * 4 + 1] = alpha < 255 ? unmix(g) : g;
  out[i * 4 + 2] = alpha < 255 ? unmix(b) : b;
  out[i * 4 + 3] = alpha;
}
const outDir = path.join(root, 'public/brand/v1');
for (const width of [480, 960]) {
  await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .resize({ width })
    .webp({ quality: 90, alphaQuality: 95, effort: 6 })
    .toFile(path.join(outDir, `logo-transparent-${width}.webp`));
}
console.log(`logo-transparent-480.webp / -960.webp written (${W}×${H} source)`);
