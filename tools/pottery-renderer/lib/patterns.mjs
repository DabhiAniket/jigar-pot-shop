// Hand-painted decoration layers mapped in (angle around axis, arc length
// along the profile). Every motif is a 2D signed distance in surface
// centimetres, so edges are anti-aliased analytically from the pixel footprint
// and stay crisp at any zoom. Irregularities (band tilt, stroke width drift,
// ragged edges, per-motif jitter, thin/thick paint) make it read as brushwork.
import { noise3, hash2f, noise1 } from './noise.mjs';

const TAU = Math.PI * 2;

/** noise that is periodic around the pot: sampled on a circle of radius freq/τ */
function pnoise(c, s, freq, seed) {
  const k = freq / TAU;
  return noise3(c * k + seed * 0.731, s * k - seed * 0.419, seed * 1.37);
}
function wrap(i, n) { i %= n; return i < 0 ? i + n : i; }

/**
 * Prepare a decoration program for a lathe profile.
 * Each layer: { type, y | y0,y1 (heights on the outer wall), color:[r,g,b] linear, ... }
 * Heights are converted to arc length s on the profile (outer wall range sFrom..sTo).
 */
export function prepareDeco(prof, layers, { sFrom = 0, sTo = Infinity, seed = 1 } = {}) {
  const out = [];
  layers.forEach((L0, i) => {
    const L = { ...L0, seed: (L0.seed ?? 0) + seed * 101 + i * 7 };
    const sOf = (y) => {
      const s = prof.sAtY(y, sFrom, sTo);
      if (Number.isNaN(s)) throw new Error(`deco layer ${L.type}: y=${y} not on outer wall`);
      return s;
    };
    if (L.y !== undefined) { L.s = sOf(L.y); L.r = prof.radiusAtY(L.y); }
    if (L.y0 !== undefined) {
      L.s0 = sOf(L.y0); L.s1 = sOf(L.y1);
      L.s = (L.s0 + L.s1) / 2; L.hs = (L.s1 - L.s0); // band height in surface cm
      L.r = prof.radiusAtY((L.y0 + L.y1) / 2);
    }
    // extent for quick rejection (surface cm)
    const ext = (L.hs ? L.hs / 2 : 0) + (L.w ?? 0) + (L.ry ?? 0) + (L.h ?? 0) + (L.len ?? 0) + (L.amp ?? 0) + 0.6;
    L.ext = ext;
    L.opacity = L.opacity ?? 0.94;
    L.thick = L.thick ?? 1;
    L.tilt = L.tilt ?? 0.12;
    if (L.type === 'crosshatch' && L.r) {
      const per = TAU * L.r / Math.SQRT2;
      L.pitch = per / Math.max(1, Math.round(per / L.pitch));
    }
    out.push(L);
  });
  return out;
}

// ---- small 2D SDF helpers
function sdSeg(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  let h = (pax * bax + pay * bay) / (bax * bax + bay * bay);
  h = h < 0 ? 0 : h > 1 ? 1 : h;
  const dx = pax - bax * h, dy = pay - bay * h;
  return Math.sqrt(dx * dx + dy * dy);
}
function sdEllipseApprox(px, py, rx, ry) {
  // cheap, good near the boundary
  const kx = px / rx, ky = py / ry;
  const k0 = Math.sqrt(kx * kx + ky * ky);
  const k1 = Math.sqrt(kx * kx / (rx * rx) + ky * ky / (ry * ry));
  return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry);
}
/** leaf / petal: vesica along +y of length len and half-width wid, base at origin */
function sdLeaf(px, py, len, wid) {
  // map to a vesica centred at len/2
  const y = py - len / 2;
  const x = Math.abs(px);
  const b = len / 2;
  const d = (b * b - wid * wid) / (2 * wid); // circle centre offset
  const r = d + wid;
  if ((Math.abs(y) - b) * d > x * b) return Math.hypot(x, Math.abs(y) - b);
  return Math.hypot(x + d, y) - r;
}

/** band tilt / waviness of a hand-painted ring */
function bandOffset(theta, c, sn, L) {
  const s = L.seed;
  return L.tilt * (Math.sin(theta + s * 1.7) * 0.8 + Math.sin(2 * theta + s * 0.37) * 0.35) + 0.04 * pnoise(c, sn, 3.2 * TAU, s);
}

/**
 * Signed distance (cm) of one layer at angle theta, arc length v (surface).
 * Also writes the local opacity modulation into LO[0].
 */
export const LO = new Float64Array(2);
export function layerDist(L, theta, c, sn, v, fw) {
  const dv = v - L.s - bandOffset(theta, c, sn, L);
  LO[0] = 1;
  let d = 1e9;
  switch (L.type) {
    case 'line': {
      const wv = L.w * (1 + 0.12 * pnoise(c, sn, 5 * TAU, L.seed + 3) + 0.06 * pnoise(c, sn, 23 * TAU, L.seed + 5));
      d = Math.abs(dv) - wv / 2;
      break;
    }
    case 'fill': { // solid painted band between s0..s1 (with wavy edges)
      const half = L.hs / 2;
      const e = (L.wave ?? 0.05) * pnoise(c, sn, 9 * TAU, L.seed);
      d = Math.abs(dv) - half - e;
      break;
    }
    case 'dots': case 'dashes': {
      const n = L.n;
      const f = (theta / TAU) * n + (L.phase ?? 0);
      const ci = Math.floor(f), cm = wrap(ci, n);
      const cw = TAU * L.r / n;
      const j1 = hash2f(cm, L.seed), j2 = hash2f(cm + 977, L.seed), j3 = hash2f(cm + 331, L.seed);
      const x = (f - ci - 0.5 + (j1 - 0.5) * (L.jitter ?? 0.12)) * cw;
      const y = dv - (j2 - 0.5) * (L.vjit ?? 0.06);
      const sz = 1 + (j3 - 0.5) * (L.sizeJit ?? 0.35);
      if (L.type === 'dots') d = sdEllipseApprox(x, y, L.rx * sz, (L.ry ?? L.rx) * sz);
      else {
        // rounded dash, slightly tapered (brush lift)
        const hl = L.len * 0.5 * sz, hh = (L.h ?? 0.18) * 0.5 * (0.85 + 0.3 * j2);
        const xx = Math.max(Math.abs(x) - hl + hh, 0);
        const taper = 1 - 0.35 * Math.max(0, x / (hl + 1e-6));
        d = Math.hypot(xx, y) - hh * taper;
      }
      LO[0] = 0.85 + 0.3 * j3;
      break;
    }
    case 'zigzag': {
      // triangles pointing up between v=-h/2..h/2; outline stroke + fill motifs
      const n = L.n;
      const f = (theta / TAU) * n + (L.phase ?? 0);
      const ci = Math.floor(f);
      const cw = TAU * L.r / n;
      const x = (f - ci - 0.5) * cw;
      const h = L.hs, hh = h / 2;
      const cm = wrap(ci, n);
      const jA = (hash2f(cm, L.seed) - 0.5) * 0.08 * cw;
      const jH = (hash2f(cm + 71, L.seed) - 0.5) * 0.06 * h;
      const jL = (hash2f(cm, L.seed + 5) - 0.5) * 0.05 * h; // base vertices shared with neighbours
      const jR = (hash2f(wrap(ci + 1, n), L.seed + 5) - 0.5) * 0.05 * h;
      const ax = jA, ay = hh * 0.92 + jH;
      const ww = L.w * (1 + 0.15 * pnoise(c, sn, n * 2.3 * TAU / n, L.seed + 9));
      d = Math.min(sdSeg(x, dv, -cw / 2, -hh + jL, ax, ay), sdSeg(x, dv, ax, ay, cw / 2, -hh + jR)) - ww / 2;
      if (L.motifs !== false) {
        // dot inside the triangle, a mound on the base, and a dot in the gap above
        const r1 = (L.dot1 ?? 0.085) * cw * (0.9 + 0.2 * hash2f(cm + 13, L.seed));
        const d1 = Math.hypot(x - jA * 0.5, dv + hh * 0.12) - r1;
        const r2 = (L.mound ?? 0.2) * cw * (0.9 + 0.2 * hash2f(cm + 41, L.seed));
        const d2 = sdEllipseApprox(x - jA * 0.3 + (hash2f(cm + 57, L.seed) - 0.5) * 0.08 * cw, dv + hh * 1.02, r2 * 1.15 * (1 + 0.2 * (hash2f(cm + 3, L.seed) - 0.5)), r2 * 0.95);
        const xg = x > 0 ? x - cw / 2 : x + cw / 2;
        const r3 = (L.dot2 ?? 0.1) * cw * (0.9 + 0.2 * hash2f(wrap(ci + (x > 0 ? 1 : 0), n) + 29, L.seed));
        const d3 = Math.hypot(xg, dv - hh * 0.38) - r3;
        d = Math.min(d, d1, d2, d3);
      }
      break;
    }
    case 'triangles': { // solid triangles (up or down) along the band
      const n = L.n;
      const f = (theta / TAU) * n + (L.phase ?? 0);
      const ci = Math.floor(f);
      const cw = TAU * L.r / n;
      const x = (f - ci - 0.5) * cw;
      const h = L.hs;
      const yy = (L.down ? -dv : dv) + h / 2; // 0 at base, h at apex
      const halfW = cw * (L.fillW ?? 0.42);
      // triangle sdf (isosceles): approximate by max of edge distances
      const k = h / halfW;
      const e1 = (Math.abs(x) * k + yy - h) / Math.sqrt(1 + k * k);
      d = Math.max(e1, -yy);
      LO[0] = 0.9 + 0.2 * hash2f(wrap(ci, n), L.seed);
      break;
    }
    case 'wave': {
      const n = L.n; // waves around
      const k = n / L.r; // radians per cm along u
      const u = theta * L.r;
      const ph = k * u + L.seed;
      const yv = L.amp * Math.sin(ph);
      const slope = L.amp * k * Math.cos(ph);
      d = Math.abs(dv - yv) / Math.sqrt(1 + slope * slope) - L.w / 2;
      break;
    }
    case 'petals': { // rosette / leaf motif repeated around: n motifs
      const n = L.n;
      const f = (theta / TAU) * n + (L.phase ?? 0);
      const ci = Math.floor(f);
      const cw = TAU * L.r / n;
      const x = (f - ci - 0.5) * cw;
      const y = dv;
      const np = L.np ?? 6, len = L.len, wid = L.wid;
      const rot = (hash2f(wrap(ci, n), L.seed) - 0.5) * (L.rotJit ?? 0.4);
      const ang = Math.atan2(x, y) - rot;
      const sector = TAU / np;
      const a = ang - sector * Math.round(ang / sector);
      const rr = Math.hypot(x, y);
      const lx = rr * Math.sin(a), ly = rr * Math.cos(a);
      d = sdLeaf(lx, ly - (L.inner ?? 0.12), len, wid);
      if (L.center) d = Math.min(d, Math.hypot(x, y) - L.center);
      break;
    }
    case 'vine': { // wavy stem with alternating leaves
      const n = L.n;
      const u = theta * L.r;
      const k = n / L.r;
      const ph = k * u + L.seed;
      const yv = L.amp * Math.sin(ph);
      const slope = L.amp * k * Math.cos(ph);
      const dStem = Math.abs(dv - yv) / Math.sqrt(1 + slope * slope) - L.w / 2;
      // leaves at each half wave
      const f = ph / Math.PI;
      const ci = Math.floor(f);
      const lp = (ci + 0.5) * Math.PI; // phase of leaf base (stem crest/trough)
      const lu = (lp - L.seed) / k;
      const ly0 = L.amp * Math.sin(lp);
      const side = (ci & 1) ? -1 : 1;
      const lx = (u - lu), lyy = (dv - ly0) * side;
      // leaf pointing outward from the stem, tilted
      const ca = Math.cos(0.5), sa = Math.sin(0.5 * side);
      const qx = lx * ca - lyy * sa, qy = lx * sa + lyy * ca;
      const dLeaf = sdLeaf(qx, qy, L.len, L.wid);
      d = Math.min(dStem, dLeaf);
      break;
    }
    case 'chevrons': { // stacked V strokes
      const n = L.n;
      const f = (theta / TAU) * n + (L.phase ?? 0);
      const ci = Math.floor(f);
      const cw = TAU * L.r / n;
      const x = (f - ci - 0.5) * cw;
      const y = dv + Math.abs(x) * (L.slope ?? 0.8);
      const per = L.pitch ?? 0.6;
      const yy = y - per * Math.round(y / per);
      d = Math.max(Math.abs(yy) - L.w / 2, Math.abs(dv) - L.hs / 2);
      break;
    }
    case 'crosshatch': {
      const u = theta * L.r;
      const p = L.pitch;
      const a = (u + dv) / Math.SQRT2, b = (u - dv) / Math.SQRT2;
      const da = Math.abs(a - p * Math.round(a / p)), db = Math.abs(b - p * Math.round(b / p));
      d = Math.max(Math.min(da, db) - L.w / 2, Math.abs(dv) - L.hs / 2);
      break;
    }
    case 'scallops': { // half circles hanging from a line
      const n = L.n;
      const f = (theta / TAU) * n + (L.phase ?? 0);
      const ci = Math.floor(f);
      const cw = TAU * L.r / n;
      const x = (f - ci - 0.5) * cw;
      const rr = cw * 0.45;
      const dc = Math.hypot(x, dv - (L.up ? -rr * 0.15 : rr * 0.15)) - rr;
      d = (L.solid ? Math.max(dc, L.up ? -dv : dv) : Math.max(Math.abs(dc) - L.w / 2, L.up ? -dv - L.w : dv - L.w));
      break;
    }
  }
  // ragged brush edge
  if (d < 0.25) {
    const rag = L.rag ?? 0.03;
    if (rag > 0 && fw < 0.08) {
      d += rag * noise3(c * L.r * 9.0 + L.seed, v * 9.0, sn * L.r * 9.0) * Math.min(1, (0.08 - fw) / 0.05);
    }
  }
  return d;
}

/** Composite all paint layers; writes PAINT = [r,g,b,coverage,height]. */
export const PAINT = new Float64Array(5);
export function evalPaint(layers, theta, c, sn, v, fw, wantHeight) {
  let r = 0, g = 0, b = 0, cov = 0, h = 0;
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    if (Math.abs(v - L.s) > L.ext + 0.5) continue;
    const d = layerDist(L, theta, c, sn, v, fw);
    const aa = Math.max(fw, 0.004);
    let k = 0.5 - d / (aa * 1.6);
    if (k <= 0) continue;
    k = k >= 1 ? 1 : k * k * (3 - 2 * k);
    // paint thickness: thinner at edges, brush streak variation inside
    const inner = Math.min(1, -d / 0.06 + 0.35);
    const streak = 0.86 + 0.14 * noise3(c * L.r * 1.3 + L.seed, v * 7.5, sn * L.r * 1.3);
    const op = L.opacity * LO[0] * Math.max(0.35, inner) * (L.solidOp ? 1 : streak);
    const a = Math.min(1, k * op);
    // over-composite
    r = r * (1 - a) + L.color[0] * a;
    g = g * (1 - a) + L.color[1] * a;
    b = b * (1 - a) + L.color[2] * a;
    cov = cov + a * (1 - cov);
    if (wantHeight) h = Math.max(h, k * L.thick * (0.6 + 0.4 * Math.min(1, inner)));
  }
  // un-premultiply colour relative to accumulated coverage
  if (cov > 1e-6) { r /= cov; g /= cov; b /= cov; }
  // r,g,b above are already "over" results relative to black; normalise:
  PAINT[0] = r; PAINT[1] = g; PAINT[2] = b; PAINT[3] = cov; PAINT[4] = h;
}

/** Height only (for bump finite differences). */
export function paintHeight(layers, theta, c, sn, v, fw) {
  let h = 0;
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    if (Math.abs(v - L.s) > L.ext + 0.5) continue;
    const d = layerDist(L, theta, c, sn, v, fw);
    const aa = Math.max(fw, 0.004);
    let k = 0.5 - d / (aa * 1.6);
    if (k <= 0) continue;
    k = k >= 1 ? 1 : k * k * (3 - 2 * k);
    const inner = Math.min(1, -d / 0.06 + 0.35);
    h = Math.max(h, k * L.thick * (0.6 + 0.4 * Math.min(1, inner)));
  }
  return h;
}
