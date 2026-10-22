// Deterministic hashing and gradient noise (with analytic derivatives).
// Everything is seeded from fixed constants so renders are reproducible.

const PERM = new Uint8Array(512);
const GX = new Float64Array(256), GY = new Float64Array(256), GZ = new Float64Array(256);

(function init() {
  let s = 0x9e3779b9 >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
  for (let i = 0; i < 256; i++) {
    let x, y, z, l;
    do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; l = x * x + y * y + z * z; } while (l > 1 || l < 0.05);
    l = Math.sqrt(l);
    GX[i] = x / l; GY[i] = y / l; GZ[i] = z / l;
  }
})();

/** 32-bit integer hash → uint32 */
export function hash32(n) {
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}
/** hash of 2 ints → [0,1) */
export function hash2f(a, b) {
  return hash32(Math.imul(a | 0, 0x8da6b343) ^ hash32((b | 0) + 0x632be5ab)) / 4294967296;
}
/** hash of 3 ints → [0,1) */
export function hash3f(a, b, c) {
  return hash32(Math.imul(a | 0, 0x8da6b343) ^ Math.imul(b | 0, 0xd8163841) ^ hash32((c | 0) + 0x9e3779b9)) / 4294967296;
}

/** Derivative output of noised(): ND[0..2] = d/dx, d/dy, d/dz */
export const ND = new Float64Array(3);

/** Gradient noise in roughly [-1,1], value only. */
export function noise3(x, y, z) {
  const fx0 = Math.floor(x), fy0 = Math.floor(y), fz0 = Math.floor(z);
  const ix = fx0 & 255, iy = fy0 & 255, iz = fz0 & 255;
  const fx = x - fx0, fy = y - fy0, fz = z - fz0;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = PERM[ix] + iy, aa = PERM[a] + iz, ab = PERM[a + 1] + iz;
  const b = PERM[ix + 1] + iy, ba = PERM[b] + iz, bb = PERM[b + 1] + iz;
  let g = PERM[aa];
  const va = GX[g] * fx + GY[g] * fy + GZ[g] * fz;
  g = PERM[ba];
  const vb = GX[g] * (fx - 1) + GY[g] * fy + GZ[g] * fz;
  g = PERM[ab];
  const vc = GX[g] * fx + GY[g] * (fy - 1) + GZ[g] * fz;
  g = PERM[bb];
  const vd = GX[g] * (fx - 1) + GY[g] * (fy - 1) + GZ[g] * fz;
  g = PERM[aa + 1];
  const ve = GX[g] * fx + GY[g] * fy + GZ[g] * (fz - 1);
  g = PERM[ba + 1];
  const vf = GX[g] * (fx - 1) + GY[g] * fy + GZ[g] * (fz - 1);
  g = PERM[ab + 1];
  const vg = GX[g] * fx + GY[g] * (fy - 1) + GZ[g] * (fz - 1);
  g = PERM[bb + 1];
  const vh = GX[g] * (fx - 1) + GY[g] * (fy - 1) + GZ[g] * (fz - 1);
  const x1 = va + ux * (vb - va), x2 = vc + ux * (vd - vc);
  const x3 = ve + ux * (vf - ve), x4 = vg + ux * (vh - vg);
  const y1 = x1 + uy * (x2 - x1), y2 = x3 + uy * (x4 - x3);
  return (y1 + uz * (y2 - y1)) * 1.15;
}

/** Gradient noise with analytic derivative (written to ND). */
export function noised(x, y, z) {
  const fx0 = Math.floor(x), fy0 = Math.floor(y), fz0 = Math.floor(z);
  const ix = fx0 & 255, iy = fy0 & 255, iz = fz0 & 255;
  const fx = x - fx0, fy = y - fy0, fz = z - fz0;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const dux = 30 * fx * fx * (fx * (fx - 2) + 1);
  const duy = 30 * fy * fy * (fy * (fy - 2) + 1);
  const duz = 30 * fz * fz * (fz * (fz - 2) + 1);
  const a = PERM[ix] + iy, aa = PERM[a] + iz, ab = PERM[a + 1] + iz;
  const b = PERM[ix + 1] + iy, ba = PERM[b] + iz, bb = PERM[b + 1] + iz;
  const g0 = PERM[aa], g1 = PERM[ba], g2 = PERM[ab], g3 = PERM[bb];
  const g4 = PERM[aa + 1], g5 = PERM[ba + 1], g6 = PERM[ab + 1], g7 = PERM[bb + 1];
  const va = GX[g0] * fx + GY[g0] * fy + GZ[g0] * fz;
  const vb = GX[g1] * (fx - 1) + GY[g1] * fy + GZ[g1] * fz;
  const vc = GX[g2] * fx + GY[g2] * (fy - 1) + GZ[g2] * fz;
  const vd = GX[g3] * (fx - 1) + GY[g3] * (fy - 1) + GZ[g3] * fz;
  const ve = GX[g4] * fx + GY[g4] * fy + GZ[g4] * (fz - 1);
  const vf = GX[g5] * (fx - 1) + GY[g5] * fy + GZ[g5] * (fz - 1);
  const vg = GX[g6] * fx + GY[g6] * (fy - 1) + GZ[g6] * (fz - 1);
  const vh = GX[g7] * (fx - 1) + GY[g7] * (fy - 1) + GZ[g7] * (fz - 1);
  const k1 = vb - va, k2 = vc - va, k3 = ve - va;
  const k4 = va - vb - vc + vd, k5 = va - vc - ve + vg, k6 = va - vb - ve + vf;
  const k7 = -va + vb + vc - vd + ve - vf - vg + vh;
  // interpolated gradients
  const ix1 = GX[g0] + ux * (GX[g1] - GX[g0]) + uy * (GX[g2] - GX[g0]) + uz * (GX[g4] - GX[g0])
    + ux * uy * (GX[g0] - GX[g1] - GX[g2] + GX[g3]) + uy * uz * (GX[g0] - GX[g2] - GX[g4] + GX[g6])
    + uz * ux * (GX[g0] - GX[g1] - GX[g4] + GX[g5])
    + ux * uy * uz * (-GX[g0] + GX[g1] + GX[g2] - GX[g3] + GX[g4] - GX[g5] - GX[g6] + GX[g7]);
  const iy1 = GY[g0] + ux * (GY[g1] - GY[g0]) + uy * (GY[g2] - GY[g0]) + uz * (GY[g4] - GY[g0])
    + ux * uy * (GY[g0] - GY[g1] - GY[g2] + GY[g3]) + uy * uz * (GY[g0] - GY[g2] - GY[g4] + GY[g6])
    + uz * ux * (GY[g0] - GY[g1] - GY[g4] + GY[g5])
    + ux * uy * uz * (-GY[g0] + GY[g1] + GY[g2] - GY[g3] + GY[g4] - GY[g5] - GY[g6] + GY[g7]);
  const iz1 = GZ[g0] + ux * (GZ[g1] - GZ[g0]) + uy * (GZ[g2] - GZ[g0]) + uz * (GZ[g4] - GZ[g0])
    + ux * uy * (GZ[g0] - GZ[g1] - GZ[g2] + GZ[g3]) + uy * uz * (GZ[g0] - GZ[g2] - GZ[g4] + GZ[g6])
    + uz * ux * (GZ[g0] - GZ[g1] - GZ[g4] + GZ[g5])
    + ux * uy * uz * (-GZ[g0] + GZ[g1] + GZ[g2] - GZ[g3] + GZ[g4] - GZ[g5] - GZ[g6] + GZ[g7]);
  ND[0] = (ix1 + dux * (k1 + k4 * uy + k6 * uz + k7 * uy * uz)) * 1.15;
  ND[1] = (iy1 + duy * (k2 + k5 * uz + k4 * ux + k7 * uz * ux)) * 1.15;
  ND[2] = (iz1 + duz * (k3 + k6 * ux + k5 * uy + k7 * ux * uy)) * 1.15;
  return (va + k1 * ux + k2 * uy + k3 * uz + k4 * ux * uy + k5 * uy * uz + k6 * uz * ux + k7 * ux * uy * uz) * 1.15;
}

/** Octave weight for band-limiting: 1 when the feature size is well above the
 * pixel footprint, fading to 0 as it approaches it. featureSize and fp in cm. */
export function bandWeight(featureSize, fp) {
  const q = featureSize / (fp * 1.4 + 1e-9);
  return q >= 1.5 ? 1 : q <= 0.5 ? 0 : q - 0.5;
}

/** fBm of noise3 with footprint-based octave fading. freq in 1/cm. */
export function fbm3(x, y, z, freq, octaves, fp, gain = 0.5, lac = 2.03) {
  let sum = 0, amp = 1, f = freq, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const w = bandWeight(1 / f, fp);
    if (w <= 0) break;
    sum += amp * w * noise3(x * f + i * 17.13, y * f - i * 9.71, z * f + i * 4.37);
    norm += amp;
    amp *= gain; f *= lac;
  }
  return norm > 0 ? sum / norm * 1.4 : 0;
}

/** 1D smooth noise (value noise with quintic fade) in [-1,1]. */
export function noise1(x, seed) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  const a = hash2f(i, seed) * 2 - 1, b = hash2f(i + 1, seed) * 2 - 1;
  return a + (b - a) * u;
}
