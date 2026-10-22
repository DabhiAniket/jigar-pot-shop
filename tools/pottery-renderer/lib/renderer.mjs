// Core renderer: SDF scene evaluation, ray marching, soft shadows, ambient
// occlusion, a studio-sweep shadow catcher and the lighting model.
// All state for the current job lives in module-level variables so that the
// hot functions (sdScene etc.) stay monomorphic and allocation-free.
import { hash2f } from './noise.mjs';

export const T_LATHE = 0, T_CUSTOM = 1;
export const MODE_OPAQUE = 0, MODE_CUTOUT = 1, MODE_SHADOW = 2, MODE_CUTSHADOW = 3;

let OBJS = [];
let NOBJ = 0;
let SC = null; // current runtime scene
let MAXY = 0; // highest point of any object (world)

// ---------------------------------------------------------------- hit record
export const HIT = {
  t: 0, wx: 0, wy: 0, wz: 0, lx: 0, ly: 0, lz: 0, r: 0, cs: 1, sn: 0,
  s: 0, pnr: 1, pny: 0, nx: 0, ny: 1, nz: 0, gx: 0, gy: 1, gz: 0,
  tx: 0, ty: 1, tz: 0, bx: 1, by: 0, bz: 0, vx: 0, vy: 0, vz: -1,
  fp: 0.01, obj: 0, part: 0, seed: 0, oc: 1, os: 0, scale: 1, seg: 0,
};
export const MAT = {
  ar: 0.5, ag: 0.5, ab: 0.5, rough: 0.6, spec: 0.03, metal: 0, wrap: 0, sr: 0, sg: 0, sb: 0,
  nx: 0, ny: 1, nz: 0, er: 0, eg: 0, eb: 0, on: 0, ao: 1, sheen: 0, clearcoat: 0, ccRough: 0.2,
};
const INFO = new Float64Array(4);

// ---------------------------------------------------------------- scene setup
export function setScene(scene) {
  SC = scene;
  OBJS = scene.objs;
  NOBJ = OBJS.length;
  MAXY = 0;
  for (const o of OBJS) MAXY = Math.max(MAXY, o.wy1);
}

// ---------------------------------------------------------------- SDF
function wobbleFactor(w, x, z, r, y) {
  if (r < 1e-6) return 1;
  const c = x / r, s = z / r;
  const c2 = c * c - s * s, s2 = 2 * s * c;
  const c3 = c * c2 - s * s2, s3 = s * c2 + c * s2;
  const c4 = c2 * c2 - s2 * s2, s4 = 2 * s2 * c2;
  const yn = y * w[0];
  const v = (w[1] + w[2] * yn) * c + (w[3] + w[4] * yn) * s + (w[5] + w[6] * yn) * c2 + (w[7] + w[8] * yn) * s2
    + w[9] * c3 + w[10] * s3 + w[11] * c4 + w[12] * s4;
  return 1 - v;
}

export function sdModel(parts, x, y, z) {
  const r = Math.sqrt(x * x + z * z);
  const wob = parts.wob;
  const re = wob ? r * wobbleFactor(wob, x, z, r, y) : r;
  let d = 1e9;
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    // cheap lower bound from the part's bounding cylinder
    if (!p.sub) {
      const br = re - p.br, by = y < p.by0 ? p.by0 - y : y > p.by1 ? y - p.by1 : 0;
      const lb = br > 0 ? (by > 0 ? Math.sqrt(br * br + by * by) : br) : by;
      if (lb >= d) continue;
    }
    let dp;
    if (p.type === T_LATHE) dp = p.dist(p.noWob ? r : re, y - p.y0);
    else dp = p.sdf(x, y, z, r);
    if (p.sub) { if (-dp > d) d = -dp; } else if (dp < d) d = dp;
  }
  return d;
}

/** distance to the scene's solid objects (floor excluded) */
export function sdScene(x, y, z) {
  let d = 1e9;
  for (let i = 0; i < NOBJ; i++) {
    const o = OBJS[i];
    if (o.hidden) continue;
    const dx = x - o.x, dz = z - o.z;
    // lower bound: distance to bounding cylinder
    const rr = Math.sqrt(dx * dx + dz * dz) - o.wbr;
    const yy = y < o.wy0 ? o.wy0 - y : y > o.wy1 ? y - o.wy1 : 0;
    const bd = rr > 0 ? (yy > 0 ? Math.sqrt(rr * rr + yy * yy) : rr) : yy;
    if (bd >= d) continue;
    const lx = (dx * o.c + dz * o.s) * o.is, lz = (-dx * o.s + dz * o.c) * o.is, ly = y * o.is;
    const dm = sdModel(o.parts, lx, ly, lz) * o.sc;
    if (dm < d) d = dm;
  }
  return d;
}

// --------------------------------------------------------------- hit analysis
/** Fill HIT for a surface point (world position already in HIT.wx..). */
function analyseHit() {
  // which object?
  let best = 1e9, bo = 0;
  for (let i = 0; i < NOBJ; i++) {
    const o = OBJS[i];
    if (o.hidden) continue;
    const dx = HIT.wx - o.x, dz = HIT.wz - o.z;
    const lx = (dx * o.c + dz * o.s) * o.is, lz = (-dx * o.s + dz * o.c) * o.is, ly = HIT.wy * o.is;
    const d = sdModel(o.parts, lx, ly, lz) * o.sc;
    if (d < best) { best = d; bo = i; }
  }
  const o = OBJS[bo];
  const dx = HIT.wx - o.x, dz = HIT.wz - o.z;
  const lx = (dx * o.c + dz * o.s) * o.is, lz = (-dx * o.s + dz * o.c) * o.is, ly = HIT.wy * o.is;
  HIT.obj = bo; HIT.lx = lx; HIT.ly = ly; HIT.lz = lz; HIT.seed = o.seed; HIT.oc = o.c; HIT.os = o.s; HIT.scale = o.sc;
  const r = Math.sqrt(lx * lx + lz * lz);
  HIT.r = r;
  HIT.cs = r > 1e-6 ? lx / r : 1; HIT.sn = r > 1e-6 ? lz / r : 0;
  // which part?
  const parts = o.parts;
  const wob = parts.wob;
  const wf0 = wob ? wobbleFactor(wob, lx, lz, r, ly) : 1;
  let d = 1e9, bp = 0;
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    let dp;
    if (p.type === T_LATHE) dp = p.dist(p.noWob ? r : r * wf0, ly - p.y0);
    else dp = p.sdf(lx, ly, lz, r);
    if (p.sub) { if (-dp > d) { d = -dp; bp = k; } } else if (dp < d) { d = dp; bp = k; }
  }
  HIT.part = bp;
  const p = parts[bp];
  let nlx, nly, nlz;
  if (p.type === T_LATHE && !p.sub) {
    const pw = p.noWob ? null : wob;
    const wf = pw ? wf0 : 1;
    p.prof.info(r * wf, ly - p.y0, INFO);
    HIT.s = INFO[0]; HIT.pnr = INFO[1]; HIT.pny = INFO[2]; HIT.seg = INFO[3];
    const nr = INFO[1], ny = INFO[2];
    // gradient of d(r*wf(θ,y), y): include wobble derivatives numerically
    let wth = 0, wy = 0;
    if (pw) {
      const e = 0.002;
      const c2 = Math.cos(e), s2 = Math.sin(e);
      const lx2 = lx * c2 - lz * s2, lz2 = lx * s2 + lz * c2;
      wth = (wobbleFactor(pw, lx2, lz2, r, ly) - wf) / e; // d wf / dθ
      wy = (wobbleFactor(pw, lx, lz, r, ly + 0.01) - wf) / 0.01;
    }
    // ∇(r wf) = wf r̂ + wth θ̂ + r wy ŷ
    const cr = HIT.cs, sr = HIT.sn;
    nlx = nr * (wf * cr - wth * sr);
    nlz = nr * (wf * sr + wth * cr);
    nly = ny + nr * r * wy;
    // tangent along profile (increasing s): t2d = (-ny, nr) in (r,y) for CCW paths
    const tr = -ny, ty = nr;
    HIT.tx = tr * cr; HIT.ty = ty; HIT.tz = tr * sr; // local
  } else {
    // finite-difference normal of the part's own SDF (tetrahedron)
    const e = Math.max(0.0005, HIT.fp * 0.5) / o.sc;
    const f = (x, y, z) => {
      const rr = Math.sqrt(x * x + z * z);
      if (p.type === T_LATHE) return p.dist(rr, y - p.y0);
      return p.sdf(x, y, z, rr);
    };
    const sg = p.sub ? -1 : 1;
    const a = f(lx + e, ly - e, lz - e), b = f(lx - e, ly - e, lz + e), c = f(lx - e, ly + e, lz - e), dd = f(lx + e, ly + e, lz + e);
    nlx = sg * (a - b - c + dd); nly = sg * (-a - b + c + dd); nlz = sg * (-a + b - c + dd);
    HIT.s = ly; HIT.pnr = 1; HIT.pny = 0; HIT.seg = -1;
    // tangents: profile tangent ≈ up projected
    HIT.tx = 0; HIT.ty = 1; HIT.tz = 0;
  }
  let l = Math.sqrt(nlx * nlx + nly * nly + nlz * nlz) || 1;
  nlx /= l; nly /= l; nlz /= l;
  // local → world (rotation only)
  HIT.nx = nlx * o.c - nlz * o.s; HIT.ny = nly; HIT.nz = nlx * o.s + nlz * o.c;
  HIT.gx = HIT.nx; HIT.gy = HIT.ny; HIT.gz = HIT.nz;
  // tangent frame in world
  let tx = HIT.tx * o.c - HIT.tz * o.s, ty = HIT.ty, tz = HIT.tx * o.s + HIT.tz * o.c;
  // orthonormalise against the normal
  const dt = tx * HIT.nx + ty * HIT.ny + tz * HIT.nz;
  tx -= dt * HIT.nx; ty -= dt * HIT.ny; tz -= dt * HIT.nz;
  l = Math.sqrt(tx * tx + ty * ty + tz * tz);
  if (l < 1e-6) { tx = 0; ty = 1; tz = 0; l = 1; }
  HIT.tx = tx / l; HIT.ty = ty / l; HIT.tz = tz / l;
  // bitangent = n × t  (points along increasing θ around the axis)
  HIT.bx = HIT.ny * HIT.tz - HIT.nz * HIT.ty;
  HIT.by = HIT.nz * HIT.tx - HIT.nx * HIT.tz;
  HIT.bz = HIT.nx * HIT.ty - HIT.ny * HIT.tx;
}

// ------------------------------------------------------------ ray utilities
const IV = new Float64Array(2);
/** Intersect ray with the union of object bounding cylinders → IV[0], IV[1]. */
function boundsInterval(ox, oy, oz, dx, dy, dz, pad) {
  let t0 = Infinity, t1 = -Infinity;
  for (let i = 0; i < NOBJ; i++) {
    const o = OBJS[i];
    if (o.hidden) continue;
    const R = o.wbr + pad;
    const px = ox - o.x, pz = oz - o.z;
    const a = dx * dx + dz * dz;
    let ta = -Infinity, tb = Infinity;
    if (a > 1e-12) {
      const b = px * dx + pz * dz, c = px * px + pz * pz - R * R;
      const disc = b * b - a * c;
      if (disc < 0) continue;
      const sq = Math.sqrt(disc);
      ta = (-b - sq) / a; tb = (-b + sq) / a;
    } else if (px * px + pz * pz > R * R) continue;
    // slab in y
    const y0 = o.wy0 - pad, y1 = o.wy1 + pad;
    if (Math.abs(dy) > 1e-12) {
      let s0 = (y0 - oy) / dy, s1 = (y1 - oy) / dy;
      if (s0 > s1) { const t = s0; s0 = s1; s1 = t; }
      if (s0 > ta) ta = s0;
      if (s1 < tb) tb = s1;
    } else if (oy < y0 || oy > y1) continue;
    if (tb < Math.max(ta, 0)) continue;
    if (ta < t0) t0 = ta;
    if (tb > t1) t1 = tb;
  }
  IV[0] = Math.max(t0, 0); IV[1] = t1;
  return t1 >= IV[0];
}

/** March a primary ray; returns t or -1. */
function marchObjects(ox, oy, oz, dx, dy, dz, pixAng) {
  if (NOBJ === 0) return -1;
  if (!boundsInterval(ox, oy, oz, dx, dy, dz, 0.05)) return -1;
  let t = IV[0];
  const tmax = IV[1];
  const eps0 = SC.eps0;
  for (let i = 0; i < 400; i++) {
    const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
    const d = sdScene(x, y, z);
    const eps = eps0 + t * pixAng * 0.3;
    if (d < eps) {
      // refine towards the zero crossing
      t += d;
      for (let k = 0; k < 3; k++) {
        const d2 = sdScene(ox + dx * t, oy + dy * t, oz + dz * t);
        t += d2;
        if (Math.abs(d2) < eps0 * 0.1) break;
      }
      return t;
    }
    t += d * 0.97;
    if (t > tmax) return -1;
  }
  return -1;
}

/** Soft shadow toward a directional area light (symmetric penumbra). */
export function softShadow(ox, oy, oz, lx, ly, lz, w, steps) {
  let res = 1, t = 0.03;
  for (let i = 0; i < steps; i++) {
    const x = ox + lx * t, y = oy + ly * t, z = oz + lz * t;
    if (y > MAXY + 1 && ly >= 0) break;
    const h = sdScene(x, y, z);
    const v = h / (w * t);
    if (v < res) res = v;
    if (res < -1) break;
    t += h > 0 ? (h < 0.02 ? 0.02 : h > 6 ? 6 : h) : Math.max(-h, 0.02);
    if (t > 400) break;
  }
  if (res < -1) res = -1;
  return 0.25 * (1 + res) * (1 + res) * (2 - res);
}

/** Ambient occlusion along a normal; scales in cm. floor: include y=0 plane. */
export function ambientOcclusion(px, py, pz, nx, ny, nz, scale, floor) {
  let occ = 0, wsum = 0;
  for (let i = 0; i < 5; i++) {
    const h = scale * (0.12 + 0.5 * i * i * 0.5 + i * 0.35);
    let d = sdScene(px + nx * h, py + ny * h, pz + nz * h);
    if (floor) { const fy = py + ny * h; if (fy < d) d = fy; }
    const w = 1 / (1 + i * 0.6);
    const o = (h - d) / h;
    occ += (o > 0 ? (o > 1 ? 1 : o) : 0) * w;
    wsum += w;
  }
  const a = 1 - occ / wsum * 1.15;
  return a < 0 ? 0 : a;
}

// ------------------------------------------------------------- tone mapping
export function acesChannel(v) {
  return (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);
}
const TM = new Float64Array(3);
export function tonemap(r, g, b, exposure) {
  r *= exposure; g *= exposure; b *= exposure;
  // ACES (Hill) input matrix
  const a0 = 0.59719 * r + 0.35458 * g + 0.04823 * b;
  const a1 = 0.07600 * r + 0.90834 * g + 0.01566 * b;
  const a2 = 0.02840 * r + 0.13383 * g + 0.83777 * b;
  const b0 = acesChannel(a0), b1 = acesChannel(a1), b2 = acesChannel(a2);
  let o0 = 1.60475 * b0 - 0.53108 * b1 - 0.07367 * b2;
  let o1 = -0.10208 * b0 + 1.10813 * b1 - 0.00605 * b2;
  let o2 = -0.00327 * b0 - 0.07276 * b1 + 1.07602 * b2;
  TM[0] = o0 < 0 ? 0 : o0 > 1 ? 1 : o0;
  TM[1] = o1 < 0 ? 0 : o1 > 1 ? 1 : o1;
  TM[2] = o2 < 0 ? 0 : o2 > 1 ? 1 : o2;
}
export function srgbEncode(v) {
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}
export function srgbDecode(v) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

// ------------------------------------------------------------- background
const BG = new Float64Array(8); // r,g,b (linear display), alpha, depth t, ratio, px,pz
/** Studio sweep: floor y=0 that curves up into a wall behind the subject. */
function sweepHit(ox, oy, oz, dx, dy, dz) {
  const sw = SC.sweep;
  const os = ox * sw.hx + oz * sw.hz, ds = dx * sw.hx + dz * sw.hz;
  let best = Infinity, kind = -1;
  if (dy < -1e-9) {
    const t = -oy / dy;
    if (t > 0 && os + ds * t <= sw.zs) { best = t; kind = 0; }
  }
  if (ds > 1e-9) {
    const t = (sw.zs + sw.R - os) / ds;
    if (t > 0 && t < best && oy + dy * t >= sw.R) { best = t; kind = 2; }
  }
  // quarter circle (s - zs)^2 + (y - R)^2 = R^2
  const a = ds * ds + dy * dy;
  if (a > 1e-12) {
    const ps = os - sw.zs, py = oy - sw.R;
    const b = ps * ds + py * dy, c = ps * ps + py * py - sw.R * sw.R;
    const disc = b * b - a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      for (const t of [(-b - sq) / a, (-b + sq) / a]) {
        if (t <= 0 || t >= best) continue;
        const s = os + ds * t - sw.zs, y = oy + dy * t;
        if (s >= 0 && y <= sw.R) { best = t; kind = 1; }
      }
    }
  }
  return best === Infinity ? -1 : (BG[7] = kind, best);
}

/** shadow-catcher ratio (1 = unshadowed) at a floor/sweep point. */
function catcherRatio(px, py, pz, nx, ny, nz) {
  const L = SC.lights;
  let sh = 1, ao = 1;
  if (NOBJ > 0) {
    const k = L.key;
    sh = softShadow(px + nx * 0.02, py + ny * 0.02, pz + nz * 0.02, k.x, k.y, k.z, k.w * SC.floorSoft, SC.shadowSteps);
    ao = ambientOcclusion(px, py, pz, nx, ny, nz, SC.floorAOScale, false);
    if (SC.floorAO2) {
      const a2 = ambientOcclusion(px, py, pz, nx, ny, nz, SC.floorAOScale * SC.floorAO2, false);
      ao = ao * (1 - SC.floorAO2Mix) + Math.min(ao, a2) * SC.floorAO2Mix;
    }
  }
  const rk = 1 - SC.keyShadowDensity * (1 - sh);
  const ra = 1 - SC.aoDensity * (1 - ao);
  return rk * ra;
}

// ------------------------------------------------------------ lighting
const RAD = new Float64Array(3);
function ggxD(ndh, a) {
  const a2 = a * a;
  const d = ndh * ndh * (a2 - 1) + 1;
  return a2 / (Math.PI * d * d);
}
function envSpec(rx, ry, rz, rough) {
  // smooth studio environment for reflections (cream sweep, darker ceiling)
  const E = SC.env;
  const k = rough * rough;
  const up = ry;
  let r, g, b;
  if (up < 0) {
    const t = Math.min(1, -up * 3 + k);
    r = E.hor[0] + (E.floor[0] - E.hor[0]) * t; g = E.hor[1] + (E.floor[1] - E.hor[1]) * t; b = E.hor[2] + (E.floor[2] - E.hor[2]) * t;
  } else {
    const t = Math.min(1, up * 1.6 * (1 - k * 0.5));
    r = E.hor[0] + (E.top[0] - E.hor[0]) * t; g = E.hor[1] + (E.top[1] - E.hor[1]) * t; b = E.hor[2] + (E.top[2] - E.hor[2]) * t;
  }
  // big soft "card" reflections from the key and rim softboxes (rough-blurred)
  const L = SC.lights;
  for (let i = 0; i < E.cards.length; i++) {
    const c = E.cards[i];
    const cd = rx * c.x + ry * c.y + rz * c.z;
    const sharp = c.sharp / (1 + c.sharp * k * 1.5);
    const w = Math.exp(sharp * (cd - 1)) * (sharp / c.sharp);
    r += c.r * w; g += c.g * w; b += c.b * w;
  }
  RAD[0] = r; RAD[1] = g; RAD[2] = b;
  return L;
}

const LT = new Float64Array(3);
/** Diffuse+specular response for one directional light. Adds into acc. */
function addLight(N_x, N_y, N_z, V_x, V_y, V_z, Lx, Ly, Lz, cr, cg, cb, vis, w, M, acc) {
  const ndl = N_x * Lx + N_y * Ly + N_z * Lz;
  const wrap = M.wrap;
  if (ndl <= -wrap) return;
  const ndv = Math.max(1e-4, N_x * V_x + N_y * V_y + N_z * V_z);
  const ndlc = ndl > 0 ? ndl : 0;
  // Oren-Nayar factor (fast form)
  let on = 1;
  if (M.on > 0) {
    const s2 = M.on * M.on;
    const A = 1 - 0.5 * s2 / (s2 + 0.33), B = 0.45 * s2 / (s2 + 0.09);
    const ldv = Lx * V_x + Ly * V_y + Lz * V_z;
    const s = ldv - ndlc * ndv;
    const t = s > 0 ? Math.max(ndlc, ndv) : 1;
    on = A + B * s / t;
  }
  const wrapped = (ndl + wrap) / (1 + wrap);
  const diff = ndlc * on * vis;
  const sss = (wrapped - ndlc) * vis;
  if (M.metal < 1) {
    acc[0] += cr * (M.ar * diff + M.sr * sss) * (1 - M.metal);
    acc[1] += cg * (M.ag * diff + M.sg * sss) * (1 - M.metal);
    acc[2] += cb * (M.ab * diff + M.sb * sss) * (1 - M.metal);
  }
  if (ndl <= 0) return;
  // GGX specular with area-light widening
  let hx = Lx + V_x, hy = Ly + V_y, hz = Lz + V_z;
  const hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
  hx /= hl; hy /= hl; hz /= hl;
  const ndh = Math.max(0, N_x * hx + N_y * hy + N_z * hz);
  const vdh = Math.max(0, V_x * hx + V_y * hy + V_z * hz);
  const a = M.rough * M.rough;
  const aw = Math.min(1, a + w * 0.5);
  const D = ggxD(ndh, aw) * (a * a) / (aw * aw);
  const k = (M.rough + 1) * (M.rough + 1) / 8;
  const G = (ndl / (ndl * (1 - k) + k)) * (ndv / (ndv * (1 - k) + k));
  const fw = Math.pow(1 - vdh, 5);
  const spec = D * G / (4 * ndl * ndv + 1e-4) * ndl * vis;
  if (M.metal > 0) {
    const fr = M.ar + (1 - M.ar) * fw, fg = M.ag + (1 - M.ag) * fw, fb = M.ab + (1 - M.ab) * fw;
    acc[0] += cr * spec * fr; acc[1] += cg * spec * fg; acc[2] += cb * spec * fb;
  } else {
    const F = M.spec + (1 - M.spec) * fw;
    acc[0] += cr * spec * F; acc[1] += cg * spec * F; acc[2] += cb * spec * F;
  }
  if (M.clearcoat > 0) {
    const ac = M.ccRough * M.ccRough, acw = Math.min(1, ac + w * 0.5);
    const Dc = ggxD(ndh, acw) * (ac * ac) / (acw * acw);
    const Fc = (0.04 + 0.96 * fw) * M.clearcoat;
    const sc = Dc / (4 * ndv + 1e-4) * vis * Fc;
    acc[0] += cr * sc; acc[1] += cg * sc; acc[2] += cb * sc;
  }
}

const ACC = new Float64Array(3);
// per-pixel cache of smooth, expensive terms (AO, shadows) keyed by object/part id
const CID = new Float64Array(8), CAO = new Float64Array(8), CVK = new Float64Array(8), CVR = new Float64Array(8);
let CN = 0, CUSE = false;
/** Shade HIT with MAT. Writes HDR radiance into RAD. */
function shadeLit() {
  const L = SC.lights, M = MAT;
  const px = HIT.wx, py = HIT.wy, pz = HIT.wz;
  const nx = M.nx, ny = M.ny, nz = M.nz;
  const gx = HIT.gx, gy = HIT.gy, gz = HIT.gz;
  const vx = HIT.vx, vy = HIT.vy, vz = HIT.vz;
  ACC[0] = 0; ACC[1] = 0; ACC[2] = 0;
  const off = 0.02 + HIT.fp * 2;
  const ox = px + gx * off, oy = py + gy * off, oz = pz + gz * off;
  const id = HIT.obj * 64 + HIT.part;
  let ao0 = -1, vis = 0, rvis0 = -1;
  if (CUSE) for (let i = 0; i < CN; i++) if (CID[i] === id) { ao0 = CAO[i]; vis = CVK[i]; rvis0 = CVR[i]; break; }
  const k = L.key, rm = L.rim;
  if (ao0 < 0) {
    ao0 = ambientOcclusion(px, py, pz, gx, gy, gz, SC.aoScale, true);
    const ndlk = gx * k.x + gy * k.y + gz * k.z;
    vis = ndlk > -0.35 ? softShadow(ox, oy, oz, k.x, k.y, k.z, k.w, SC.shadowSteps) : 0;
    rvis0 = ao0;
    if (SC.rimShadow) {
      const ndlr = gx * rm.x + gy * rm.y + gz * rm.z;
      rvis0 = ndlr > -0.2 ? softShadow(ox, oy, oz, rm.x, rm.y, rm.z, rm.w, SC.shadowSteps >> 1) * (0.5 + 0.5 * ao0) : 0;
    }
    if (!CUSE && CN < 8) { CID[CN] = id; CAO[CN] = ao0; CVK[CN] = vis; CVR[CN] = rvis0; CN++; }
  }
  const ao = ao0 * M.ao;
  // key light with soft shadow
  addLight(nx, ny, nz, vx, vy, vz, k.x, k.y, k.z, k.r, k.g, k.b, vis, k.w, M, ACC);
  // fill (soft, occlusion via AO)
  const f = L.fill;
  addLight(nx, ny, nz, vx, vy, vz, f.x, f.y, f.z, f.r, f.g, f.b, ao, f.w, M, ACC);
  // rim / kicker
  const rvis = rvis0 * M.ao;
  addLight(nx, ny, nz, vx, vy, vz, rm.x, rm.y, rm.z, rm.r, rm.g, rm.b, rvis, rm.w, M, ACC);
  // extra point lights (diya flames)
  const pls = SC.pointLights;
  for (let i = 0; i < pls.length; i++) {
    const pl = pls[i];
    let lx = pl.x - px, ly = pl.y - py, lz = pl.z - pz;
    const d2 = lx * lx + ly * ly + lz * lz, dl = Math.sqrt(d2);
    lx /= dl; ly /= dl; lz /= dl;
    const fall = pl.I / (d2 + pl.soft);
    let pv = 1;
    if (pl.shadow) {
      const ndp = gx * lx + gy * ly + gz * lz;
      pv = ndp > -0.2 ? Math.max(0, Math.min(1, shadowSeg(ox, oy, oz, lx, ly, lz, dl - pl.rad, 0.25))) : 0;
    }
    addLight(nx, ny, nz, vx, vy, vz, lx, ly, lz, pl.r * fall, pl.g * fall, pl.b * fall, pv * (0.4 + 0.6 * ao), 0.3, M, ACC);
  }
  // hemispherical ambient (sky + warm floor bounce)
  const up = 0.5 + 0.5 * ny;
  const sky = L.sky, bo = L.bounce;
  const bounceOcc = Math.min(1, ao * (0.55 + 0.45 * Math.min(1, py / SC.bounceH)));
  const ar = (sky.r * up + bo.r * (1 - up) * bounceOcc) * ao, ag = (sky.g * up + bo.g * (1 - up) * bounceOcc) * ao, ab = (sky.b * up + bo.b * (1 - up) * bounceOcc) * ao;
  if (M.metal < 1) {
    const dm = 1 - M.metal;
    ACC[0] += M.ar * ar * dm; ACC[1] += M.ag * ag * dm; ACC[2] += M.ab * ab * dm;
  }
  // environment specular
  const ndv = Math.max(1e-4, nx * vx + ny * vy + nz * vz);
  const rx = 2 * ndv * nx - vx, ry = 2 * ndv * ny - vy, rz = 2 * ndv * nz - vz;
  envSpec(rx, ry, rz, M.rough);
  const so = Math.min(1, ao * 1.2) * (ry < 0 ? (0.6 + 0.4 * ao) : 1);
  const fw = Math.pow(1 - ndv, 5);
  const env = SC.env.gain * so;
  if (M.metal > 0) {
    const g = 1 - M.rough * 0.5;
    ACC[0] += RAD[0] * env * (M.ar + (1 - M.ar) * fw) * g;
    ACC[1] += RAD[1] * env * (M.ag + (1 - M.ag) * fw) * g;
    ACC[2] += RAD[2] * env * (M.ab + (1 - M.ab) * fw) * g;
  } else {
    const F = (M.spec + (Math.max(1 - M.rough, M.spec) - M.spec) * fw) * (1 - M.rough * 0.5) + M.sheen * fw;
    ACC[0] += RAD[0] * env * F; ACC[1] += RAD[1] * env * F; ACC[2] += RAD[2] * env * F;
    if (M.clearcoat > 0) {
      envSpec(rx, ry, rz, M.ccRough);
      const Fc = (0.04 + 0.96 * fw) * M.clearcoat;
      ACC[0] += RAD[0] * env * Fc; ACC[1] += RAD[1] * env * Fc; ACC[2] += RAD[2] * env * Fc;
    }
  }
  RAD[0] = ACC[0] + M.er; RAD[1] = ACC[1] + M.eg; RAD[2] = ACC[2] + M.eb;
}

/** shadow along a finite segment (for point lights) */
function shadowSeg(ox, oy, oz, lx, ly, lz, tmax, w) {
  let res = 1, t = 0.03;
  for (let i = 0; i < 40 && t < tmax; i++) {
    const h = sdScene(ox + lx * t, oy + ly * t, oz + lz * t);
    res = Math.min(res, h / (w * t));
    if (res < -1) break;
    t += Math.max(0.02, Math.abs(h));
  }
  res = Math.max(res, -1);
  return 0.25 * (1 + res) * (1 + res) * (2 - res);
}

// --------------------------------------------------------------- flames
const FL = new Float64Array(3);
/** Integrate emissive flame volumes along a ray up to tmax; writes FL (HDR). */
function flameEmission(ox, oy, oz, dx, dy, dz, tmax) {
  FL[0] = 0; FL[1] = 0; FL[2] = 0;
  const fls = SC.flames;
  for (let i = 0; i < fls.length; i++) {
    const f = fls[i];
    // bounding sphere
    const cx = f.x - ox, cy = f.y + f.h * 0.5 - oy, cz = f.z - oz;
    const tc = cx * dx + cy * dy + cz * dz;
    const R = f.h * 0.75;
    const d2 = cx * cx + cy * cy + cz * cz - tc * tc;
    if (d2 > R * R) continue;
    const half = Math.sqrt(R * R - d2);
    let t0 = Math.max(0, tc - half), t1 = Math.min(tmax, tc + half);
    if (t1 <= t0) continue;
    const N = 40, dt = (t1 - t0) / N;
    for (let k = 0; k < N; k++) {
      const t = t0 + (k + 0.5) * dt;
      const x = ox + dx * t - f.x, y = oy + dy * t - f.y, z = oz + dz * t - f.z;
      const hn = y / f.h;
      if (hn < -0.05 || hn > 1.05) continue;
      // teardrop radius profile, flickerless, slightly leaning
      const lean = f.lean * hn * hn;
      const xx = x - lean;
      const rp = f.rad * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (hn + 0.04) / 1.04)) ** 0.75)), 1.1) * (1 - 0.35 * hn);
      if (rp <= 1e-4) continue;
      const q = (xx * xx + z * z) / (rp * rp);
      if (q > 2.2) continue;
      const dens = Math.exp(-q * 2.2);
      // colour: hot white-yellow core, orange edge, faint blue at the base
      const core = Math.exp(-q * 5.0) * Math.max(0, 1 - Math.abs(hn - 0.38) * 1.7);
      const base = Math.max(0, 1 - hn * 6) * 0.35;
      FL[0] += dt * dens * (f.I * (1.0 + 2.2 * core) - base * 0.6);
      FL[1] += dt * dens * (f.I * (0.42 + 2.0 * core) - base * 0.2);
      FL[2] += dt * dens * (f.I * (0.08 + 1.3 * core) + base * 0.7);
    }
  }
  if (FL[0] < 0) FL[0] = 0;
  if (FL[2] < 0) FL[2] = 0;
}

// -------------------------------------------------------------- sampling
const SMP = new Float64Array(10); // r,g,b,a (premultiplied), depth, id, glow r,g,b, lum
/** Trace one camera sample. sx, sy in pixels (float). */
function traceSample(sx, sy) {
  const cam = SC.cam;
  const u = (sx / SC.W * 2 - 1) * cam.tanH * cam.aspect + cam.sx;
  const v = (1 - sy / SC.H * 2) * cam.tanH + cam.sy;
  let dx = cam.fx + cam.rx * u + cam.ux * v;
  let dy = cam.fy + cam.ry * u + cam.uy * v;
  let dz = cam.fz + cam.rz * u + cam.uz * v;
  const l = Math.sqrt(dx * dx + dy * dy + dz * dz);
  dx /= l; dy /= l; dz /= l;
  const ox = cam.ox, oy = cam.oy, oz = cam.oz;
  const pixAng = cam.pixAng;
  const mode = SC.mode;
  let t = -1;
  if (mode !== MODE_SHADOW) t = marchObjects(ox, oy, oz, dx, dy, dz, pixAng);
  SMP[6] = 0; SMP[7] = 0; SMP[8] = 0;
  if (t > 0) {
    HIT.t = t;
    HIT.wx = ox + dx * t; HIT.wy = oy + dy * t; HIT.wz = oz + dz * t;
    HIT.vx = -dx; HIT.vy = -dy; HIT.vz = -dz;
    HIT.fp = t * pixAng;
    analyseHit();
    // footprint grows at grazing angles
    const ndv = Math.abs(HIT.nx * dx + HIT.ny * dy + HIT.nz * dz);
    HIT.fpg = HIT.fp / Math.max(0.25, ndv);
    resetMat();
    const o = OBJS[HIT.obj];
    o.surface(HIT, MAT, o.parts[HIT.part], o);
    shadeLit();
    let r = RAD[0], g = RAD[1], b = RAD[2];
    if (SC.flames.length) {
      flameEmission(ox, oy, oz, dx, dy, dz, t);
      r += FL[0]; g += FL[1]; b += FL[2];
      SMP[6] = FL[0]; SMP[7] = FL[1]; SMP[8] = FL[2];
    }
    tonemap(r, g, b, SC.exposure);
    SMP[0] = TM[0]; SMP[1] = TM[1]; SMP[2] = TM[2]; SMP[3] = 1;
    SMP[4] = t * (dx * cam.fx + dy * cam.fy + dz * cam.fz);
    SMP[5] = HIT.obj * 64 + HIT.part;
    if (mode === MODE_CUTOUT || mode === MODE_CUTSHADOW) {
      SMP[0] = srgbEncode(SMP[0]); SMP[1] = srgbEncode(SMP[1]); SMP[2] = srgbEncode(SMP[2]);
    }
    return;
  }
  // background
  SMP[5] = -1;
  if (mode === MODE_CUTOUT) { SMP[0] = 0; SMP[1] = 0; SMP[2] = 0; SMP[3] = 0; SMP[4] = 1e5; return; }
  const tb = sweepHit(ox, oy, oz, dx, dy, dz);
  let ratio = 1, depth = 1e5;
  if (tb > 0) {
    const px = ox + dx * tb, py = oy + dy * tb, pz = oz + dz * tb;
    let nx = 0, ny = 1, nz = 0;
    const sw = SC.sweep;
    if (BG[7] === 2) { nx = -sw.hx; ny = 0; nz = -sw.hz; }
    else if (BG[7] === 1) {
      const s = px * sw.hx + pz * sw.hz - sw.zs;
      const yy = sw.R - py;
      nx = -s / sw.R * sw.hx; ny = yy / sw.R; nz = -s / sw.R * sw.hz;
    }
    let cached = -1;
    if (CUSE) for (let i = 0; i < CN; i++) if (CID[i] === -1) { cached = CAO[i]; break; }
    if (cached >= 0) ratio = cached;
    else {
      ratio = catcherRatio(px, py, pz, nx, ny, nz);
      if (!CUSE && CN < 8) { CID[CN] = -1; CAO[CN] = ratio; CN++; }
    }
    depth = tb * (dx * cam.fx + dy * cam.fy + dz * cam.fz);
    // warm light pool from flames on the floor
    if (SC.pointLights.length && mode === MODE_OPAQUE) {
      let wr = 0, wg = 0, wb = 0;
      for (const pl of SC.pointLights) {
        const lx = pl.x - px, ly = pl.y - py, lz = pl.z - pz;
        const d2 = lx * lx + ly * ly + lz * lz;
        const dl = Math.sqrt(d2);
        const cosf = Math.max(0, (lx * nx + ly * ny + lz * nz) / dl);
        let vis = 1;
        if (pl.shadow) vis = shadowSeg(px + nx * 0.02, py + ny * 0.02, pz + nz * 0.02, lx / dl, ly / dl, lz / dl, dl - pl.rad, 0.3);
        const e = pl.I * cosf / (d2 + pl.soft) * vis * SC.floorGlow;
        wr += pl.r * e; wg += pl.g * e; wb += pl.b * e;
      }
      BG[0] = wr; BG[1] = wg; BG[2] = wb;
    } else { BG[0] = 0; BG[1] = 0; BG[2] = 0; }
  } else { BG[0] = 0; BG[1] = 0; BG[2] = 0; }
  SMP[4] = depth;
  if (mode === MODE_OPAQUE) {
    const c = SC.cream, tint = SC.shadowTint;
    let r = c[0] * Math.pow(ratio, tint[0]), g = c[1] * Math.pow(ratio, tint[1]), b = c[2] * Math.pow(ratio, tint[2]);
    r += BG[0]; g += BG[1]; b += BG[2];
    if (SC.flames.length) {
      flameEmission(ox, oy, oz, dx, dy, dz, tb > 0 ? tb : 1e5);
      tonemap(FL[0], FL[1], FL[2], SC.exposure);
      r = 1 - (1 - r) * (1 - TM[0]); g = 1 - (1 - g) * (1 - TM[1]); b = 1 - (1 - b) * (1 - TM[2]);
      SMP[6] = FL[0]; SMP[7] = FL[1]; SMP[8] = FL[2];
    }
    SMP[0] = r; SMP[1] = g; SMP[2] = b; SMP[3] = 1;
  } else {
    // shadow layer: alpha such that compositing brown over cream in sRGB space
    // reproduces cream * ratio
    const cS = SC.creamSrgb, sh = SC.shadowSrgb;
    const target = srgbEncode(SC.cream[1] * Math.pow(ratio, SC.shadowTint[1]));
    let a = (cS[1] - target) / (cS[1] - sh[1]);
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    SMP[0] = sh[0] * a; SMP[1] = sh[1] * a; SMP[2] = sh[2] * a; SMP[3] = a;
  }
}

function resetMat() {
  const M = MAT;
  M.ar = 0.5; M.ag = 0.5; M.ab = 0.5; M.rough = 0.6; M.spec = 0.03; M.metal = 0; M.wrap = 0;
  M.sr = 0; M.sg = 0; M.sb = 0; M.nx = HIT.nx; M.ny = HIT.ny; M.nz = HIT.nz; M.er = 0; M.eg = 0; M.eb = 0;
  M.on = 0; M.ao = 1; M.sheen = 0; M.clearcoat = 0; M.ccRough = 0.2;
}

// 4-sample rotated grid + 4x4 stratified refinement
const RG4 = [[-0.125, -0.375], [0.375, -0.125], [0.125, 0.375], [-0.375, 0.125]];

/** Is the pixel centre ray anywhere near an object or flame? */
function pixelNearObjects(px, py) {
  const cam = SC.cam;
  const u = ((px + 0.5) / SC.W * 2 - 1) * cam.tanH * cam.aspect + cam.sx;
  const v = (1 - (py + 0.5) / SC.H * 2) * cam.tanH + cam.sy;
  let dx = cam.fx + cam.rx * u + cam.ux * v, dy = cam.fy + cam.ry * u + cam.uy * v, dz = cam.fz + cam.rz * u + cam.uz * v;
  const l = Math.sqrt(dx * dx + dy * dy + dz * dz); dx /= l; dy /= l; dz /= l;
  if (SC.mode === MODE_SHADOW) return false;
  // pad by ~3 pixel footprints at the object distance
  const pad = 3 * cam.pixAng * cam.dist;
  return boundsInterval(cam.ox, cam.oy, cam.oz, dx, dy, dz, pad);
}

/**
 * Render rows [y0, y1) into out (Float32Array, 8 floats per pixel):
 * r,g,b,a (premultiplied; linear for opaque, sRGB-encoded for alpha modes),
 * depth, glow r,g,b (HDR emission for bloom).
 * Pixels whose centre ray is not near any object (pure studio sweep) are
 * smooth, so they are traced every BG_STRIDE pixels and interpolated.
 */
const BG_STRIDE = 4;
const NEAR = new Uint8Array(16384);
export function renderRows(y0, y1, out) {
  const W = SC.W;
  const q = SC.quality;
  const hasFlames = SC.flames.length > 0;
  for (let py = y0; py < y1; py++) {
    for (let px = 0; px < W; px++) NEAR[px] = pixelNearObjects(px, py) ? 1 : 0;
    // background-only pixels: sparse trace + linear interpolation along the row
    let last = -1;
    for (let px = 0; px < W; px++) {
      if (NEAR[px]) { last = -1; continue; }
      const isKey = hasFlames || px % BG_STRIDE === 0 || px === W - 1 || NEAR[px + 1] || last < 0;
      if (!isKey) continue;
      CN = 0; CUSE = false;
      traceSample(px + 0.5, py + 0.5);
      const o = (py * W + px) * 8;
      out[o] = SMP[0]; out[o + 1] = SMP[1]; out[o + 2] = SMP[2]; out[o + 3] = SMP[3];
      out[o + 4] = SMP[4]; out[o + 5] = SMP[6]; out[o + 6] = SMP[7]; out[o + 7] = SMP[8];
      if (last >= 0 && px - last > 1) {
        const ol = (py * W + last) * 8;
        for (let x = last + 1; x < px; x++) {
          const t = (x - last) / (px - last), oi = (py * W + x) * 8;
          for (let c = 0; c < 8; c++) out[oi + c] = out[ol + c] + (out[o + c] - out[ol + c]) * t;
        }
      }
      last = px;
    }
    for (let px = 0; px < W; px++) {
      if (!NEAR[px]) continue;
      const o = (py * W + px) * 8;
      let r = 0, g = 0, b = 0, a = 0, gr = 0, gg = 0, gb = 0, n = 0, depth = 0;
      const first = Math.min(4, q.minSpp);
      let lmin = 1e9, lmax = -1e9, id0 = -2, idDiff = false;
      CN = 0; CUSE = false;
      for (let s = 0; s < first; s++) {
        const jx = first === 1 ? 0.5 : 0.5 + RG4[s][0], jy = first === 1 ? 0.5 : 0.5 + RG4[s][1];
        traceSample(px + jx, py + jy);
        r += SMP[0]; g += SMP[1]; b += SMP[2]; a += SMP[3];
        gr += SMP[6]; gg += SMP[7]; gb += SMP[8];
        if (s === 0) depth = SMP[4];
        const lum = SMP[0] * 0.3 + SMP[1] * 0.55 + SMP[2] * 0.15 + SMP[3] * 0.1;
        if (lum < lmin) lmin = lum;
        if (lum > lmax) lmax = lum;
        if (id0 === -2) id0 = SMP[5]; else if (SMP[5] !== id0) idDiff = true;
        n++;
      }
      if (q.maxSpp > first && (idDiff || lmax - lmin > q.varThresh)) {
        CUSE = true;
        const k = q.maxSpp >= 16 ? 4 : q.maxSpp >= 9 ? 3 : 2;
        for (let sy = 0; sy < k; sy++) for (let sx = 0; sx < k; sx++) {
          const jx = (sx + hash2f(px * 7 + sx, py * 13 + sy * 5 + SC.seed)) / k;
          const jy = (sy + hash2f(px * 11 + sy * 3 + SC.seed, py * 17 + sx)) / k;
          traceSample(px + jx, py + jy);
          r += SMP[0]; g += SMP[1]; b += SMP[2]; a += SMP[3];
          gr += SMP[6]; gg += SMP[7]; gb += SMP[8];
          n++;
        }
        CUSE = false;
      }
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n;
      out[o + 4] = depth; out[o + 5] = gr / n; out[o + 6] = gg / n; out[o + 7] = gb / n;
    }
  }
}

/** Debug helper: trace one sample and return a copy of the sample record. */
export function debugSample(px, py) { CN = 0; CUSE = false; traceSample(px, py); return Array.from(SMP); }
