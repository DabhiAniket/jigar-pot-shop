// Post-processing on the float frame buffer (8 floats / pixel:
// premultiplied r,g,b,a, depth, glow r,g,b) → 8-bit RGB or RGBA.
import { hash2f } from './noise.mjs';
import { srgbEncode, tonemap, acesChannel } from './renderer.mjs';

function boxBlurH(src, dst, W, H, C, r) {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    for (let c = 0; c < C; c++) {
      let acc = 0;
      const row = y * W;
      for (let x = -r; x <= r; x++) acc += src[(row + Math.min(W - 1, Math.max(0, x))) * C + c];
      for (let x = 0; x < W; x++) {
        dst[(row + x) * C + c] = acc * inv;
        const xa = Math.min(W - 1, x + r + 1), xs = Math.max(0, x - r);
        acc += src[(row + xa) * C + c] - src[(row + xs) * C + c];
      }
    }
  }
}
function boxBlurV(src, dst, W, H, C, r) {
  const inv = 1 / (2 * r + 1);
  for (let x = 0; x < W; x++) {
    for (let c = 0; c < C; c++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += src[(Math.min(H - 1, Math.max(0, y)) * W + x) * C + c];
      for (let y = 0; y < H; y++) {
        dst[(y * W + x) * C + c] = acc * inv;
        const ya = Math.min(H - 1, y + r + 1), ys = Math.max(0, y - r);
        acc += src[(ya * W + x) * C + c] - src[(ys * W + x) * C + c];
      }
    }
  }
}
/** approximate gaussian blur (3 box passes) of a C-channel float image, in place */
export function gaussBlur(img, W, H, C, sigma) {
  if (sigma < 0.5) return img;
  const r = Math.max(1, Math.round(Math.sqrt(12 * sigma * sigma / 3 + 1) / 2));
  const tmp = new Float32Array(img.length);
  for (let i = 0; i < 3; i++) { boxBlurH(img, tmp, W, H, C, r); boxBlurV(tmp, img, W, H, C, r); }
  return img;
}

/** Depth of field by scatter-as-gather on a Vogel disk. */
function depthOfField(buf, W, H, dof) {
  const N = W * H;
  const col = new Float32Array(N * 4), coc = new Float32Array(N), dep = new Float32Array(N);
  const zf = dof.focus, K = dof.strength * W, maxR = Math.max(1, dof.max * W);
  for (let i = 0; i < N; i++) {
    for (let c = 0; c < 4; c++) col[i * 4 + c] = buf[i * 8 + c];
    const z = Math.max(1e-3, buf[i * 8 + 4]);
    dep[i] = z;
    coc[i] = Math.min(maxR, K * Math.abs(1 / zf - 1 / z));
  }
  const S = dof.samples ?? 72;
  const GA = Math.PI * (3 - Math.sqrt(5));
  const ox = new Float32Array(S), oy = new Float32Array(S), od = new Float32Array(S);
  for (let k = 0; k < S; k++) {
    const rr = Math.sqrt((k + 0.5) / S);
    ox[k] = Math.cos(k * GA) * rr; oy[k] = Math.sin(k * GA) * rr; od[k] = rr;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const cp = coc[i], zp = dep[i];
    // search radius: own CoC or max neighbourhood CoC
    const R = Math.max(cp, maxR * 0.85);
    if (R < 0.75) continue;
    const rot = hash2f(x, y + 91) * Math.PI * 2, cr = Math.cos(rot), sr = Math.sin(rot);
    let wr = 0, wg = 0, wb = 0, wa = 0, ws = 0;
    const w0 = 1 / Math.max(1, cp * cp);
    wr += col[i * 4] * w0; wg += col[i * 4 + 1] * w0; wb += col[i * 4 + 2] * w0; wa += col[i * 4 + 3] * w0; ws += w0;
    for (let k = 0; k < S; k++) {
      const dx = (ox[k] * cr - oy[k] * sr) * R, dy = (ox[k] * sr + oy[k] * cr) * R;
      const qx = Math.round(x + dx), qy = Math.round(y + dy);
      if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
      const j = qy * W + qx;
      const dist = od[k] * R;
      const cq = coc[j];
      // q scatters onto p if its circle of confusion covers p
      let w = Math.min(1, Math.max(0, cq - dist + 0.5));
      // background samples behind an in-focus pixel must not bleed over it
      if (dep[j] > zp * 1.02) w = Math.min(w, Math.min(1, Math.max(0, cp - dist + 0.5)));
      w /= Math.max(1, cq * cq);
      wr += col[j * 4] * w; wg += col[j * 4 + 1] * w; wb += col[j * 4 + 2] * w; wa += col[j * 4 + 3] * w; ws += w;
    }
    buf[i * 8] = wr / ws; buf[i * 8 + 1] = wg / ws; buf[i * 8 + 2] = wb / ws; buf[i * 8 + 3] = wa / ws;
  }
}

/**
 * @returns {{channels:number, data:Uint8Array}}
 */
export function finishImage(buf, W, H, opts) {
  const N = W * H;
  const alpha = opts.alpha;
  const post = opts.post || {};
  // bloom from emissive glow
  if (post.bloom) {
    const g = new Float32Array(N * 3);
    let any = 0;
    for (let i = 0; i < N; i++) { g[i * 3] = buf[i * 8 + 5]; g[i * 3 + 1] = buf[i * 8 + 6]; g[i * 3 + 2] = buf[i * 8 + 7]; any += g[i * 3]; }
    if (any > 0) {
      const g2 = Float32Array.from(g);
      gaussBlur(g, W, H, 3, post.bloom.sigma * W);
      gaussBlur(g2, W, H, 3, post.bloom.sigma * W * 4);
      const k = post.bloom.strength;
      for (let i = 0; i < N; i++) {
        const r = (g[i * 3] + g2[i * 3] * 0.6) * k, gg = (g[i * 3 + 1] + g2[i * 3 + 1] * 0.6) * k, b = (g[i * 3 + 2] + g2[i * 3 + 2] * 0.6) * k;
        // soft screen blend in display space
        const tr = 1 - Math.exp(-r), tg = 1 - Math.exp(-gg), tb = 1 - Math.exp(-b);
        const a = buf[i * 8 + 3];
        buf[i * 8] = 1 - (1 - buf[i * 8]) * (1 - tr * a) - (1 - a) * 0; // premultiplied for opaque a=1
        buf[i * 8 + 1] = 1 - (1 - buf[i * 8 + 1]) * (1 - tg * a);
        buf[i * 8 + 2] = 1 - (1 - buf[i * 8 + 2]) * (1 - tb * a);
      }
    }
  }
  if (post.dof) depthOfField(buf, W, H, post.dof);
  const C = alpha ? 4 : 3;
  const out = new Uint8Array(N * C);
  const cream = opts.creamBytes; // [r,g,b] exact
  const edge = !alpha && post.edge !== false;
  const margin = Math.max(2, Math.round(Math.min(W, H) * (post.edgeMargin ?? 0.035)));
  const grain = alpha ? 0 : (post.grain ?? 1.0);
  const seed = opts.seed ?? 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let m = 1;
      if (edge) {
        const d = Math.min(x, y, W - 1 - x, H - 1 - y);
        const t = Math.min(1, d / margin);
        m = t * t * (3 - 2 * t);
      }
      if (alpha) {
        const a = buf[i * 8 + 3];
        let r = 0, g = 0, b = 0;
        if (a > 1e-5) { r = buf[i * 8] / a; g = buf[i * 8 + 1] / a; b = buf[i * 8 + 2] / a; }
        const ab = Math.round(Math.min(1, Math.max(0, a)) * 255);
        out[i * 4] = ab ? Math.round(Math.min(1, Math.max(0, r)) * 255) : 0;
        out[i * 4 + 1] = ab ? Math.round(Math.min(1, Math.max(0, g)) * 255) : 0;
        out[i * 4 + 2] = ab ? Math.round(Math.min(1, Math.max(0, b)) * 255) : 0;
        out[i * 4 + 3] = ab;
        continue;
      }
      if (m <= 0) { out[i * 3] = cream[0]; out[i * 3 + 1] = cream[1]; out[i * 3 + 2] = cream[2]; continue; }
      let r = srgbEncode(buf[i * 8]) * 255, g = srgbEncode(buf[i * 8 + 1]) * 255, b = srgbEncode(buf[i * 8 + 2]) * 255;
      if (grain > 0) {
        const n = (hash2f(x * 3 + seed, y) + hash2f(x, y * 5 + seed * 7) + hash2f(x * 7 + 13, y * 3 + seed * 3) - 1.5) * 2.0;
        const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
        const amp = grain * (0.6 + 1.0 * (1 - lum) * lum * 4) * m;
        const cn = (hash2f(x * 11 + seed, y * 13) - 0.5) * 0.6;
        r += n * amp * (1 + cn * 0.3); g += n * amp; b += n * amp * (1 - cn * 0.3);
      }
      if (m < 1) {
        r = cream[0] + (r - cream[0]) * m; g = cream[1] + (g - cream[1]) * m; b = cream[2] + (b - cream[2]) * m;
      }
      out[i * 3] = Math.max(0, Math.min(255, Math.round(r)));
      out[i * 3 + 1] = Math.max(0, Math.min(255, Math.round(g)));
      out[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(b)));
    }
  }
  return { channels: C, data: out };
}
