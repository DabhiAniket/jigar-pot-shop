// Pottery models. Each builder returns
//   { parts, surface(H, M, part, obj), bound: {r, y0, y1}, hull: [[x,y,z]...], avgAlbedo }
// Parts are lathe profiles (surfaces of revolution) or custom SDFs.
// Units: centimetres, y up, pot standing on y = 0.
import { PathBuilder, Profile, offsetPolyline } from './profile.mjs';
import { T_LATHE, T_CUSTOM } from './renderer.mjs';
import { shadeClay, shadeBrass, shadeGlaze, shadeSimple, srgb, clamp01, smooth, etchGrooves } from './materials.mjs';
import { prepareDeco } from './patterns.mjs';
import { noise3, hash2f } from './noise.mjs';

// ------------------------------------------------------------------ palette
export const C = {
  cream: srgb('#EADBC0'),
  creamPaint: srgb('#E8D3AE'),
  white: srgb('#F2ECE0'),
  black: srgb('#1E1A17'),
  mustard: srgb('#D49A2C'),
  gold: srgb('#D6A653'),
  red: srgb('#A4241C'),
  sindoor: srgb('#B8281E'),
  terracottaPaint: srgb('#A84A2A'),
  brown: srgb('#45352C'),
  sage: srgb('#687D59'),
};

// terracotta bodies (linear albedo)
const CLAY = {
  classic: { base: srgb('#C0603F'), tone: 0.17, speck: 0.9, flash: 0.45, throwAmp: 0.04, rough: 0.4, spec: 0.045, burnish: 0.45, sss: [0.95, 0.4, 0.22], micro: 0.016 },
  light: { base: srgb('#C46A44'), tone: 0.2, speck: 1.0, flash: 0.45, throwAmp: 0.05, rough: 0.66, spec: 0.026, bloom: 0.45, bloomY: 12, sss: [0.95, 0.45, 0.26] },
  red: { base: srgb('#A9472C'), tone: 0.1, speck: 0.6, flash: 0.4, throwAmp: 0.035, rough: 0.62, spec: 0.028, sss: [0.95, 0.4, 0.22] },
  brown: { base: srgb('#7A3D24'), tone: 0.14, speck: 0.5, flash: 0.5, throwAmp: 0.03, rough: 0.58, spec: 0.03, soot: 0.55, sootY: 7, sss: [0.9, 0.4, 0.25] },
  black: { base: srgb('#1F1C1A'), tone: 0.12, speck: 0.25, light: 0.25, flash: 0, throwAmp: 0.02, rough: 0.34, spec: 0.045, burnish: 0.9, sss: [0.2, 0.15, 0.12], sssAmt: 0.05, on: 0.12, wrap: 0.05, sheen: 0.15, grain: 0.04 },
  kulhad: { base: srgb('#B45F3F'), tone: 0.14, speck: 0.8, flash: 0.3, throwAmp: 0.06, rough: 0.75, spec: 0.02, micro: 0.06, sss: [0.95, 0.45, 0.25] },
  planter: { base: srgb('#BC6542'), tone: 0.12, speck: 0.7, flash: 0.3, throwAmp: 0.04, rough: 0.7, spec: 0.022, bloom: 0.6, bloomY: 8, sss: [0.95, 0.45, 0.25] },
};

// ------------------------------------------------------------------ helpers
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
/** handmade non-circularity: low harmonics of the radius, varying with height */
export function makeWobble(seed, H, amp = 0.006) {
  const R = rng(seed + 17);
  const g = () => (R() * 2 - 1);
  return Float64Array.of(1 / H,
    amp * 0.5 * g(), amp * 0.9 * g(), amp * 0.5 * g(), amp * 0.9 * g(),
    amp * 0.6 * g(), amp * 0.5 * g(), amp * 0.6 * g(), amp * 0.5 * g(),
    amp * 0.3 * g(), amp * 0.3 * g(), amp * 0.2 * g(), amp * 0.2 * g());
}
function lathe(pts, opts = {}) {
  const prof = new Profile(pts, opts.profile || {});
  return { type: T_LATHE, prof, dist: prof.dist, sdf: null, noWob: !!opts.noWob, y0: opts.y0 ?? 0, mat: opts.mat ?? 'clay', name: opts.name ?? 'body', sub: false,
    deco: null, region: null, clayP: null, glazeP: null, hull: null, br: 0, by0: 0, by1: 0, extra: opts.extra ?? null };
}
/** custom SDF part; bound: {r, y0, y1} in model space (required for the early-out) */
function custom(sdf, opts = {}) {
  return { type: T_CUSTOM, prof: null, dist: null, sdf, noWob: true, y0: 0, mat: opts.mat ?? 'clay', name: opts.name ?? 'custom', sub: !!opts.sub,
    deco: null, region: null, clayP: null, glazeP: null, hull: opts.hull ?? [], br: 0, by0: 0, by1: 0, extra: opts.extra ?? null, bound: opts.bound };
}
function hullFromParts(parts, extra = []) {
  const pts = [];
  for (const p of parts) {
    if (p.type !== T_LATHE || p.sub) continue;
    const pr = p.prof;
    const step = Math.max(1, Math.floor(pr.n / 120));
    for (let i = 0; i < pr.n; i += step) {
      const r = pr.px[i], y = pr.py[i] + p.y0;
      if (r < 0.01) { pts.push([0, y, 0]); continue; }
      for (let a = 0; a < 32; a++) {
        const t = a / 32 * Math.PI * 2;
        pts.push([Math.cos(t) * r * 1.01, y, Math.sin(t) * r * 1.01]);
      }
    }
  }
  for (const p of parts) if (p.hull) pts.push(...p.hull);
  pts.push(...extra);
  return pts;
}
function boundsOf(hull) {
  let r = 0, y0 = Infinity, y1 = -Infinity;
  for (const [x, y, z] of hull) { r = Math.max(r, Math.hypot(x, z)); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { r: r + 0.15, y0: Math.max(0, y0 - 0.15) === 0 && y0 >= -0.01 ? Math.min(0, y0) - 0.05 : y0 - 0.15, y1: y1 + 0.15 };
}
function finish(model) {
  model.hull = hullFromParts(model.parts, model.extraHull || []);
  model.bound = boundsOf(model.hull);
  for (const p of model.parts) {
    if (p.type === T_LATHE) {
      const w = model.wob ? 1.05 : 1.0; // allow for the wobble
      p.br = p.prof.rmax * w + 0.01; p.by0 = p.prof.ymin + p.y0 - 0.01; p.by1 = p.prof.ymax + p.y0 + 0.01;
    } else {
      const b = p.bound || model.bound;
      p.br = b.r; p.by0 = b.y0; p.by1 = b.y1;
    }
  }
  model.parts.wob = model.wob || null;
  return model;
}
/** arc length range of the outer wall: from the point after the base to the max-y point */
function outerRange(prof) {
  let iTop = 0;
  for (let i = 0; i < prof.n; i++) if (prof.py[i] > prof.py[iTop] + 1e-9) iTop = i;
  return [0, prof.S[iTop]];
}

// ------------------------------------------------------------- SDF helpers
export function sdTorusY(x, y, z, R, r) { // torus around y axis at origin
  const q = Math.sqrt(x * x + z * z) - R;
  return Math.sqrt(q * q + y * y) - r;
}
export function sdCapsule(px, py, pz, ax, ay, az, bx, by, bz, r) {
  const pax = px - ax, pay = py - ay, paz = pz - az, bax = bx - ax, bay = by - ay, baz = bz - az;
  let h = (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz);
  h = h < 0 ? 0 : h > 1 ? 1 : h;
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}
export function sdRoundBox(px, py, pz, bx, by, bz, r) {
  const qx = Math.abs(px) - bx + r, qy = Math.abs(py) - by + r, qz = Math.abs(pz) - bz + r;
  const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0);
  return Math.sqrt(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
}
export function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// ------------------------------------------------------------- surface glue
/** Standard surface dispatcher for clay pots with optional per-part decoration. */
function claySurface(clayP, extra = {}) {
  return (H, M, part, obj) => {
    const mat = part.mat;
    if (mat === 'clay') shadeClay(H, M, part.clayP || clayP, part.deco, part.region);
    else if (mat === 'brass') shadeBrass(H, M, extra.brass || {});
    else if (mat === 'glaze') shadeGlaze(H, M, part.glazeP || extra.glaze);
    else if (extra[mat]) extra[mat](H, M, part, obj);
    else shadeClay(H, M, clayP, null, null);
  };
}

// ================================================================ MODELS
// ---------------------------------------------------------- classic matka
function classicBodyPath(o = {}) {
  const b = new PathBuilder(0, 0);
  b.line(7.3, 0).round(0.35)
    .spline([[7.55, 0.5], [7.75, 0.95]], { startDir: [0.3, 1] }).round(0.25)
    .spline([[8.8, 1.7], [10.6, 3.15], [12.55, 5.4], [14.1, 8.3], [14.92, 11.4], [15.0, 12.6], [14.72, 14.9], [13.95, 17.05], [12.7, 19.0], [11.55, 20.45], [10.85, 21.35]], { startDir: [1, 0.55] })
    .spline([[10.62, 21.75], [10.66, 22.05]])
    // rolled collar
    .spline([[10.95, 22.35], [11.3, 22.85], [11.38, 23.35], [11.18, 23.78], [10.75, 24.0]])
    .spline([[10.3, 24.05], [9.95, 23.98]])
    .spline([[9.72, 23.7], [9.62, 23.2], [9.6, 22.4], [9.66, 21.6]])
    .line(9.0, 21.0).round(0.3)
    .line(0, 21.0);
  return b.build();
}
function classicLidPath() {
  const b = new PathBuilder(0, 22.7);
  b.line(9.25, 22.7).round(0.3)
    .line(9.42, 23.86).round(0.15)
    .line(10.05, 23.9).round(0.2)
    .spline([[10.32, 24.12], [10.36, 24.42], [10.2, 24.66]]).round(0.12)
    .spline([[9.85, 24.74], [9.55, 24.82]])
    // ring 1
    .spline([[9.3, 25.06], [8.95, 25.26], [8.55, 25.33], [8.3, 25.35]])
    // ring 2
    .spline([[8.0, 25.62], [7.5, 25.88], [7.0, 25.96], [6.72, 25.98]])
    // ring 3
    .spline([[6.45, 26.24], [5.9, 26.48], [5.3, 26.58], [4.9, 26.6]])
    // plateau
    .spline([[4.3, 26.78], [3.2, 26.98], [2.35, 27.1]]).round(0.35)
    // stem
    .spline([[1.85, 27.42], [1.72, 27.85]])
    // knob
    .spline([[2.15, 28.2], [2.6, 28.68], [2.78, 29.25], [2.62, 29.88], [2.08, 30.38], [1.2, 30.68], [0, 30.78]], { endDir: [-1, 0] });
  return b.build();
}

export function classicMatka(opts = {}) {
  const seed = opts.seed ?? 1;
  const body = lathe(classicBodyPath(), { name: 'body' });
  const lid = lathe(classicLidPath(), { name: 'lid', y0: 0.08 });
  const [s0, s1] = outerRange(body.prof);
  const cream = opts.paint ?? C.creamPaint;
  body.deco = prepareDeco(body.prof, opts.decoLayers ?? [
    { type: 'dots', y: 17.3, n: 70, rx: 0.27, ry: 0.17, color: cream, jitter: 0.14, sizeJit: 0.45 },
    { type: 'line', y: 16.45, w: 0.5, color: cream },
    { type: 'zigzag', y0: 12.0, y1: 15.9, n: 22, w: 0.5, color: cream, mound: 0.15, dot1: 0.075, dot2: 0.085 },
    { type: 'line', y: 11.4, w: 0.5, color: cream },
    { type: 'dashes', y: 10.45, n: 58, len: 0.82, h: 0.24, color: cream, jitter: 0.12 },
  ], { sFrom: s0, sTo: s1, seed });
  body.region = { throwMul: 1 };
  const clayP = { ...(opts.clay ?? CLAY.classic), seed: seed * 3.1,
    throwEnv: (y) => 0.35 + 0.65 * smooth(14, 19, y) + 0.4 * smooth(21.5, 23, y) };
  const lidP = { ...clayP, seed: seed * 5.7, throwAmp: (clayP.throwAmp ?? 0.03) * 1.3, throwEnv: null };
  lid.clayP = lidP;
  const m = { parts: [body, lid], wob: makeWobble(seed, 24, 0.006), surface: claySurface(clayP), avgAlbedo: clayP.base };
  return finish(m);
}

// ---------------------------------------------------------- vessel helper
/**
 * Open vessel profile: flat foot, outer wall spline, rounded rim, offset inner wall, inner floor.
 * o.foot: foot radius at y=0; o.outer: control points from the foot top to the rim's outer top;
 * o.thick: wall thickness (number or fn(y)); o.floor: inner floor height.
 */
function vesselPath(o) {
  const b = new PathBuilder(0, o.baseY ?? 0);
  if (o.footRing) {
    // recessed base with a foot ring
    const [ri, ro, h] = o.footRing;
    b.line(ri, o.baseY ?? 0).line(ri + 0.15, -0.0001 + 0.0).round(0.1);
  }
  b.line(o.foot, 0).round(o.footRound ?? 0.3);
  const i0 = b.pts.length - 1;
  b.spline(o.outer, { startDir: o.startDir ?? [0.25, 1], endDir: o.endDir });
  const outer = b.pts.slice(i0);
  const top = b.last;
  const tf = typeof o.thick === 'function' ? o.thick : () => o.thick;
  const inner = offsetPolyline(outer, (p) => tf(p[1]));
  const ti = inner[inner.length - 1];
  const cx = (top[0] + ti[0]) / 2, cy = (top[1] + ti[1]) / 2;
  const a0 = Math.atan2(top[1] - cy, top[0] - cx) * 180 / Math.PI;
  b.arc(cx, cy, a0 + 180);
  // follow the inner wall down to the floor height, then run along the floor to the axis
  const down = [];
  let floorY = o.floor, cut = null;
  for (let i = inner.length - 1; i >= 0; i--) {
    const p = inner[i];
    if (p[1] <= floorY) {
      const q = inner[i + 1] || p;
      const t = (q[1] - floorY) / Math.max(1e-9, q[1] - p[1]);
      cut = [q[0] + (p[0] - q[0]) * t, floorY];
      break;
    }
    down.push(p);
  }
  if (!cut) { const lo = down[down.length - 1]; floorY = lo[1]; cut = lo; down.pop(); }
  b.append(down);
  b.line(cut[0], cut[1]);
  // corner rounding limited by the available wall / floor length
  const wallLen = down.length ? Math.hypot(down[0][0] - cut[0], down[0][1] - cut[1]) : 0;
  const fr = Math.min(o.floorRound ?? 0.5, cut[0] * 0.8, wallLen * 0.8);
  if (fr > 0.02) b.round(fr);
  b.line(0, floorY);
  return b.build();
}
/** closed-top dome profile (lids): pts from the axis at the bottom, around, to the axis at the top */
function rot2(x, z, a) { const c = Math.cos(a), s = Math.sin(a); return [x * c - z * s, x * s + z * c]; }

// ---------------------------------------------------------- black clay matka
function blackMatka(opts = {}) {
  const seed = opts.seed ?? 2;
  const body = lathe(classicBodyPath(), { name: 'body' });
  const lid = lathe(classicLidPath(), { name: 'lid', y0: 0.08 });
  const [s0, s1] = outerRange(body.prof);
  const etch = C.black;
  body.deco = prepareDeco(body.prof, [
    { type: 'line', y: 19.6, w: 0.09, color: etch, tilt: 0.04, rag: 0.008 },
    { type: 'line', y: 19.2, w: 0.09, color: etch, tilt: 0.04, rag: 0.008 },
    { type: 'line', y: 16.9, w: 0.1, color: etch, tilt: 0.05, rag: 0.008 },
    { type: 'line', y: 16.55, w: 0.1, color: etch, tilt: 0.05, rag: 0.008 },
    { type: 'zigzag', y0: 13.2, y1: 16.1, n: 30, w: 0.1, color: etch, motifs: false, tilt: 0.05, rag: 0.008 },
    { type: 'line', y: 12.75, w: 0.1, color: etch, tilt: 0.05, rag: 0.008 },
    { type: 'line', y: 12.4, w: 0.1, color: etch, tilt: 0.05, rag: 0.008 },
    { type: 'dots', y: 11.7, n: 90, rx: 0.07, ry: 0.07, color: etch, tilt: 0.05, rag: 0.0 },
    { type: 'line', y: 9.4, w: 0.09, color: etch, tilt: 0.05, rag: 0.008 },
  ], { sFrom: s0, sTo: s1, seed });
  const clayP = { ...CLAY.black, seed: seed * 3.3, etch: true,
    throwEnv: (y) => 0.5 + 0.5 * smooth(15, 20, y) };
  lid.clayP = { ...clayP, seed: seed * 7.1, throwEnv: null };
  lid.deco = null;
  return finish({ parts: [body, lid], wob: makeWobble(seed, 24, 0.005), surface: claySurface(clayP), avgAlbedo: clayP.base });
}

// ---------------------------------------------------------- plain matka (open, no lid)
function plainMatkaPath() {
  return vesselPath({
    foot: 7.8, footRound: 0.5,
    outer: [[8.3, 0.55], [10.4, 2.1], [12.9, 4.9], [14.9, 8.9], [15.9, 13.4], [15.75, 17.4], [14.6, 21.2], [12.5, 24.5], [9.9, 26.9], [7.7, 28.5], [6.75, 29.5], [6.6, 30.3], [6.95, 31.0], [7.75, 31.55], [8.25, 31.9]],
    thick: (y) => 0.75 + 0.6 * smooth(30.6, 31.9, y), floor: 1.2, floorRound: 1.5,
  });
}
function plainMatka(opts = {}) {
  const seed = opts.seed ?? 3;
  const body = lathe(plainMatkaPath(), { name: 'body' });
  const clayP = { ...CLAY.light, seed: seed * 2.2, throwAmp: 0.1, throwEnv: (y) => 0.45 + 0.55 * smooth(18, 26, y) + 0.4 * smooth(28, 30, y), beaten: 0.05, beatenY: 14 };
  return finish({ parts: [body], wob: makeWobble(seed, 32, 0.007), surface: claySurface(clayP), avgAlbedo: clayP.base });
}

// ---------------------------------------------------------- matka with brass tap
function tapBodyPath() {
  return vesselPath({
    foot: 8.6, footRound: 0.5,
    outer: [[9.1, 0.6], [11.2, 2.4], [13.4, 5.6], [14.8, 10.0], [15.2, 15.0], [14.9, 19.4], [13.8, 23.4], [12.0, 26.6], [10.4, 28.6], [9.7, 29.6], [9.65, 30.4], [10.2, 31.0], [10.65, 31.6], [10.7, 32.1]],
    thick: (y) => 0.75 + 0.5 * smooth(30.5, 32.1, y), floor: 1.2, floorRound: 1.4,
  });
}
function tapLidPath() {
  const b = new PathBuilder(0, 30.9);
  b.line(8.85, 30.9).round(0.3).line(8.95, 31.85).round(0.12).line(10.5, 31.95).round(0.2)
    .spline([[10.8, 32.2], [10.75, 32.55]]).round(0.15)
    .spline([[10.2, 32.75], [8.8, 33.25], [7.0, 33.8], [5.0, 34.25], [3.2, 34.55], [2.0, 34.7]]).round(0.4)
    .spline([[1.4, 35.1], [1.3, 35.5]])
    .spline([[1.9, 35.9], [2.1, 36.5], [1.7, 37.15], [0.9, 37.45], [0, 37.5]], { endDir: [-1, 0] });
  return b.build();
}
/** brass tap pointing toward -z (camera side) from the pot wall; ty = height */
function makeTap(prof, ty) {
  const rWall = prof.radiusAtY(ty);
  const z0 = -rWall + 0.35; // root slightly inside the wall
  const sdf = (x, y, z) => {
    const py = y - ty;
    // threaded root nut (hexagonal prism along z)
    const zz = z - (z0 - 0.9);
    const ax = Math.abs(x), ay = Math.abs(py);
    const hex = Math.max(ax * 0.866 + ay * 0.5, ay) - 1.25;
    const dNut = Math.max(hex, Math.abs(zz) - 0.55) - 0.06;
    // flange disc against the wall
    const dFl = Math.max(Math.hypot(x, py) - 1.75, Math.abs(z - (z0 - 0.2)) - 0.22) - 0.05;
    // barrel
    const dBar = sdCapsule(x, py, z, 0, 0, z0 - 1.2, 0, -0.1, z0 - 4.3, 0.72);
    // body bulge around the valve
    const dVal = Math.hypot(x, py * 1.05, (z - (z0 - 3.3)) * 0.85) - 1.08;
    // downward spout
    const dSp = sdCapsule(x, py, z, 0, -0.1, z0 - 4.3, 0, -2.0, z0 - 4.75, 0.55);
    const dSpIn = sdCapsule(x, py, z, 0, -0.6, z0 - 4.5, 0, -2.5, z0 - 4.85, 0.32);
    // lever handle on top
    const dStem = sdCapsule(x, py, z, 0, 0.6, z0 - 3.3, 0, 1.6, z0 - 3.3, 0.3);
    const dLever = sdRoundBox(x, py - 1.85, z - (z0 - 3.3), 1.9, 0.32, 0.42, 0.28);
    let d = smin(dBar, dVal, 0.5);
    d = smin(d, dSp, 0.35);
    d = Math.max(d, -dSpIn);
    d = Math.min(d, smin(dStem, dLever, 0.3));
    d = smin(d, dNut, 0.15);
    d = Math.min(d, dFl);
    return d;
  };
  const hull = [];
  for (const [x, y, z] of [[2.2, 2.8, z0], [-2.2, 2.8, z0 - 5.3], [2.2, -2.8, z0 - 5.3], [-2.2, -2.8, z0]]) hull.push([x, y + ty, z]);
  return custom(sdf, { mat: 'brass', name: 'tap', bound: { r: rWall + 6.5, y0: ty - 3, y1: ty + 2.6 }, hull });
}
function tapMatka(opts = {}) {
  const seed = opts.seed ?? 4;
  const body = lathe(tapBodyPath(), { name: 'body' });
  const lid = lathe(tapLidPath(), { name: 'lid' });
  const [s0, s1] = outerRange(body.prof);
  const cream = C.creamPaint;
  body.deco = prepareDeco(body.prof, [
    { type: 'line', y: 22.1, w: 0.45, color: cream },
    { type: 'dots', y: 21.1, n: 48, rx: 0.3, ry: 0.3, color: cream },
    { type: 'line', y: 20.1, w: 0.45, color: cream },
    { type: 'wave', y: 18.7, n: 14, amp: 0.55, w: 0.32, color: cream },
    { type: 'line', y: 17.3, w: 0.45, color: cream },
  ], { sFrom: s0, sTo: s1, seed });
  const tap = makeTap(body.prof, 7.4);
  const clayP = { ...CLAY.red, seed: seed * 1.7, throwEnv: (y) => 0.4 + 0.6 * smooth(22, 28, y) };
  lid.clayP = { ...clayP, seed: seed * 9.1 };
  return finish({ parts: [body, lid, tap], wob: makeWobble(seed, 32, 0.005), surface: claySurface(clayP, { brass: { base: [0.82, 0.58, 0.28], rough: 0.2, patina: 0.3 } }), avgAlbedo: clayP.base });
}

// ---------------------------------------------------------- surahi
function surahiPath() {
  return vesselPath({
    foot: 5.4, footRound: 0.4,
    outer: [[5.8, 0.55], [7.7, 1.7], [9.9, 3.9], [11.15, 7.0], [11.3, 10.4], [10.65, 13.9], [8.9, 17.1], [6.4, 19.5], [3.9, 21.0], [3.2, 21.6], [3.25, 22.15], [2.65, 22.8], [2.3, 24.5], [2.15, 27.5], [2.25, 30.0], [2.6, 31.3], [3.15, 32.2], [3.45, 32.75]],
    thick: (y) => 0.45 + 0.15 * smooth(31.5, 32.7, y), floor: 1.0, floorRound: 1.0,
  });
}
function surahi(opts = {}) {
  const seed = opts.seed ?? 5;
  const body = lathe(surahiPath(), { name: 'body' });
  const [s0, s1] = outerRange(body.prof);
  const cream = C.creamPaint;
  body.deco = prepareDeco(body.prof, [
    { type: 'line', y: 26.0, w: 0.22, color: cream, tilt: 0.05 },
    { type: 'dots', y: 25.2, n: 16, rx: 0.17, color: cream, tilt: 0.05 },
    { type: 'line', y: 24.4, w: 0.22, color: cream, tilt: 0.05 },
    { type: 'dots', y: 17.2, n: 30, rx: 0.24, color: cream },
    { type: 'line', y: 16.1, w: 0.36, color: cream },
    { type: 'dots', y: 14.7, n: 40, rx: 0.3, color: cream, phase: 0.5 },
    { type: 'dots', y: 13.2, n: 40, rx: 0.3, color: cream },
    { type: 'dots', y: 11.7, n: 40, rx: 0.3, color: cream, phase: 0.5 },
    { type: 'line', y: 10.4, w: 0.36, color: cream },
    { type: 'dots', y: 9.3, n: 34, rx: 0.24, color: cream },
  ], { sFrom: s0, sTo: s1, seed });
  const clayP = { ...CLAY.red, seed: seed * 2.9, throwEnv: (y) => 0.5 + 0.5 * smooth(18, 22, y) };
  return finish({ parts: [body], wob: makeWobble(seed, 33, 0.006), surface: claySurface(clayP), avgAlbedo: clayP.base });
}

// ---------------------------------------------------------- clay water bottle with cap
function bottlePath() {
  return vesselPath({
    foot: 4.25, footRound: 0.35,
    outer: [[4.6, 0.5], [4.8, 2.5], [4.85, 8], [4.8, 13.5], [4.55, 15.8], [3.85, 17.9], [2.75, 19.4], [1.95, 20.3], [1.75, 21.0], [1.75, 22.1], [2.0, 22.5], [2.05, 22.9]],
    thick: 0.42, floor: 0.9, floorRound: 0.8,
  });
}
function bottleCapPath() {
  const b = new PathBuilder(0, 21.2);
  b.line(1.28, 21.2).round(0.12).line(1.33, 22.95).round(0.08).line(2.05, 23.0).round(0.12)
    .spline([[2.25, 23.25], [2.25, 23.6]]).round(0.12)
    .spline([[1.9, 23.9], [1.25, 24.15], [0.85, 24.3]]).round(0.15)
    .spline([[0.7, 24.6], [0.75, 24.85]])
    .spline([[1.05, 25.15], [1.05, 25.55], [0.7, 25.9], [0, 26.0]], { endDir: [-1, 0] });
  return b.build();
}
function waterBottle(opts = {}) {
  const seed = opts.seed ?? 6;
  const body = lathe(bottlePath(), { name: 'body' });
  const cap = lathe(bottleCapPath(), { name: 'cap' });
  const [s0, s1] = outerRange(body.prof);
  const groove = C.black;
  body.deco = prepareDeco(body.prof, [
    { type: 'line', y: 14.2, w: 0.12, color: groove, tilt: 0.03, rag: 0.005 },
    { type: 'line', y: 13.7, w: 0.12, color: groove, tilt: 0.03, rag: 0.005 },
    { type: 'line', y: 3.4, w: 0.12, color: groove, tilt: 0.03, rag: 0.005 },
    { type: 'line', y: 2.9, w: 0.12, color: groove, tilt: 0.03, rag: 0.005 },
  ], { sFrom: s0, sTo: s1, seed });
  const clayP = { ...CLAY.red, seed: seed * 3.7, etch: true, etchCol: srgb('#6E2E1B'), throwAmp: 0.05, burnish: 0.3, rough: 0.5 };
  cap.clayP = { ...clayP, seed: seed * 8.8 };
  return finish({ parts: [body, cap], wob: makeWobble(seed, 26, 0.005), surface: claySurface(clayP), avgAlbedo: clayP.base });
}

// ---------------------------------------------------------- handi with lid
function handiPath() {
  return vesselPath({
    foot: 6.4, footRound: 0.6,
    outer: [[7.0, 0.5], [9.6, 1.6], [12.4, 3.6], [13.9, 6.4], [13.95, 8.6], [13.3, 10.6], [11.9, 12.4], [11.0, 13.3], [10.85, 13.9], [11.35, 14.4], [11.55, 14.95], [11.3, 15.4]],
    thick: (y) => 0.7 + 0.45 * smooth(13.8, 15.4, y), floor: 1.1, floorRound: 1.8,
  });
}
function handiLidPath() {
  const b = new PathBuilder(0, 14.4);
  b.line(9.5, 14.4).round(0.3).line(9.6, 15.3).round(0.12).line(10.9, 15.38).round(0.2)
    .spline([[11.6, 15.6], [11.7, 15.95]]).round(0.15)
    .spline([[11.2, 16.2], [9.2, 16.9], [6.6, 17.6], [4.0, 18.1], [2.2, 18.3]]).round(0.35)
    .spline([[1.5, 18.6], [1.4, 18.95]])
    .spline([[1.85, 19.2], [1.95, 19.6], [1.55, 20.05], [0.8, 20.25], [0, 20.3]], { endDir: [-1, 0] });
  return b.build();
}
function handi(opts = {}) {
  const seed = opts.seed ?? 7;
  const body = lathe(handiPath(), { name: 'body' });
  const lid = lathe(handiLidPath(), { name: 'lid' });
  const clayP = { ...CLAY.brown, seed: seed * 1.9, throwEnv: (y) => 0.4 + 0.6 * smooth(10, 14, y), beaten: 0.06, beatenY: 9 };
  lid.clayP = { ...clayP, seed: seed * 4.4, soot: 0.15, sootY: 17 };
  return finish({ parts: [body, lid], wob: makeWobble(seed, 16, 0.006), surface: claySurface(clayP), avgAlbedo: clayP.base });
}

// ---------------------------------------------------------- kadai (two loop handles)
function kadaiPath() {
  return vesselPath({
    foot: 4.6, footRound: 0.5,
    outer: [[5.4, 0.35], [8.6, 1.4], [11.8, 3.2], [14.3, 5.6], [15.7, 7.6], [16.15, 8.6], [16.3, 9.05]],
    thick: (y) => 0.72 + 0.35 * smooth(8.0, 9.0, y), floor: 0.9, floorRound: 3.0, startDir: [1, 0.2],
  });
}
function kadai(opts = {}) {
  const seed = opts.seed ?? 8;
  const body = lathe(kadaiPath(), { name: 'body' });
  const rimR = 16.0, rimY = 8.2;
  const handles = [];
  for (const side of [1, -1]) {
    const cx = side * (rimR + 1.25), cy = rimY - 0.15;
    const tilt = 0.5; // plane tilt from horizontal
    const ca = Math.cos(tilt), sa = Math.sin(tilt);
    const sdf = (x, y, z, r) => {
      // local frame: torus centred at (cx, cy, 0), lying in a plane tilted about z
      let px = (x - cx) * side, py = y - cy;
      const qx = px * ca + py * sa, qy = -px * sa + py * ca; // rotate so ring plane is local xz
      const q = Math.hypot(qx, z) - 1.95;
      const d = Math.hypot(q, qy * 1.15) - 0.5;
      // keep only the outer half (outside the body wall)
      return Math.max(d, (rimR - 0.35) - r);
    };
    handles.push(custom(sdf, { name: 'handle', bound: { r: rimR + 4.0, y0: rimY - 2.5, y1: rimY + 2.5 }, hull: [[side * (rimR + 3.7), rimY, 0], [side * (rimR + 3.0), rimY + 1.6, 1.9], [side * (rimR + 3.0), rimY - 1.6, -1.9]] }));
  }
  const clayP = { ...CLAY.red, base: srgb('#9A4128'), seed: seed * 2.3, soot: 0.35, sootY: 4.5, throwEnv: (y) => 0.6 + 0.4 * smooth(5, 9, y) };
  return finish({ parts: [body, ...handles], wob: makeWobble(seed, 9, 0.005), surface: claySurface(clayP), avgAlbedo: clayP.base });
}

// ---------------------------------------------------------- curd pot
function curdPath() {
  return vesselPath({
    foot: 4.1, footRound: 0.4,
    outer: [[4.6, 0.45], [6.1, 1.6], [7.0, 3.4], [7.1, 4.8], [6.6, 6.5], [5.75, 7.75], [5.5, 8.35], [5.85, 8.75], [6.0, 9.1]],
    thick: (y) => 0.45 + 0.3 * smooth(8.2, 9.1, y), floor: 0.8, floorRound: 1.0,
  });
}
function curdPot(opts = {}) {
  const seed = opts.seed ?? 9;
  const body = lathe(curdPath(), { name: 'body' });
  const clayP = { ...CLAY.red, base: srgb('#A84C2E'), seed: seed * 1.3, throwAmp: 0.06, rough: 0.7, spec: 0.022, burnish: 0 };
  return finish({ parts: [body], wob: makeWobble(seed, 9, 0.008), surface: claySurface(clayP), avgAlbedo: clayP.base });
}

// ---------------------------------------------------------- painted decorative vase
function vasePath() {
  return vesselPath({
    foot: 4.4, footRound: 0.3,
    outer: [[4.45, 0.5], [4.15, 0.95], [4.6, 1.5], [6.0, 4.0], [7.15, 8.2], [7.35, 11.5], [6.85, 15.8], [5.6, 20.6], [4.2, 25.2], [3.35, 28.8], [3.25, 31.0], [3.65, 33.4], [4.45, 35.2], [5.0, 36.3], [5.15, 36.8]],
    thick: (y) => 0.5 + 0.12 * smooth(35.5, 36.8, y), floor: 1.2, floorRound: 1.0,
  });
}
function vase(opts = {}) {
  const seed = opts.seed ?? 10;
  const body = lathe(vasePath(), { name: 'body' });
  const [s0, s1] = outerRange(body.prof);
  const cream = C.creamPaint, black = C.black, mustard = C.mustard;
  body.deco = prepareDeco(body.prof, [
    { type: 'fill', y0: 9.4, y1: 17.2, color: black, opacity: 0.97, wave: 0.03, solidOp: true },
    { type: 'vine', y: 13.3, n: 7, amp: 1.25, w: 0.16, len: 1.6, wid: 0.42, color: cream },
    { type: 'dots', y: 16.3, n: 46, rx: 0.13, color: mustard },
    { type: 'dots', y: 10.3, n: 50, rx: 0.13, color: mustard },
    { type: 'line', y: 17.75, w: 0.3, color: cream },
    { type: 'line', y: 8.85, w: 0.3, color: cream },
    { type: 'triangles', y0: 18.2, y1: 20.6, n: 18, color: black, fillW: 0.36 },
    { type: 'triangles', y0: 6.0, y1: 8.4, n: 22, color: black, fillW: 0.36, down: true },
    { type: 'line', y: 28.4, w: 0.22, color: cream, tilt: 0.05 },
    { type: 'petals', y: 30.9, n: 8, np: 5, len: 0.55, wid: 0.2, inner: 0.06, center: 0.12, color: cream, tilt: 0.05 },
    { type: 'line', y: 33.0, w: 0.22, color: cream, tilt: 0.05 },
  ], { sFrom: s0, sTo: s1, seed });
  const clayP = { ...CLAY.classic, seed: seed * 1.1, throwAmp: 0.03, burnish: 0.5, rough: 0.45 };
  return finish({ parts: [body], wob: makeWobble(seed, 37, 0.005), surface: claySurface(clayP), avgAlbedo: clayP.base });
}

// ---------------------------------------------------------- folk-art round pot
function folkPath() {
  return vesselPath({
    foot: 6.4, footRound: 0.5,
    outer: [[6.9, 0.55], [8.9, 1.9], [11.2, 4.4], [12.75, 8.0], [13.1, 11.6], [12.6, 15.2], [11.1, 18.4], [9.0, 20.7], [7.4, 21.9], [6.9, 22.6], [7.1, 23.2], [7.85, 23.75], [8.2, 24.2]],
    thick: (y) => 0.6 + 0.4 * smooth(23.0, 24.2, y), floor: 1.1, floorRound: 1.4,
  });
}
function folkPot(opts = {}) {
  const seed = opts.seed ?? 11;
  const body = lathe(folkPath(), { name: 'body' });
  const [s0, s1] = outerRange(body.prof);
  const cream = C.creamPaint, black = C.black, mustard = C.mustard, terra = C.terracottaPaint;
  body.deco = prepareDeco(body.prof, [
    { type: 'fill', y0: 8.6, y1: 14.4, color: black, opacity: 0.96, wave: 0.04, solidOp: true },
    { type: 'petals', y: 11.5, n: 10, np: 8, len: 1.15, wid: 0.36, inner: 0.25, center: 0.32, color: cream },
    { type: 'dots', y: 11.5, n: 10, rx: 0.28, color: mustard, phase: 0.5 },
    { type: 'dots', y: 13.6, n: 70, rx: 0.1, color: cream },
    { type: 'dots', y: 9.4, n: 70, rx: 0.1, color: cream },
    { type: 'line', y: 14.85, w: 0.32, color: mustard },
    { type: 'triangles', y0: 15.3, y1: 17.3, n: 20, color: mustard, fillW: 0.42 },
    { type: 'dots', y: 17.0, n: 20, rx: 0.14, color: black, phase: 0.5 },
    { type: 'wave', y: 18.6, n: 13, amp: 0.4, w: 0.22, color: cream },
    { type: 'line', y: 19.7, w: 0.25, color: black },
    { type: 'line', y: 8.15, w: 0.32, color: mustard },
    { type: 'scallops', y: 7.35, n: 24, w: 0.2, color: cream },
    { type: 'dots', y: 6.2, n: 24, rx: 0.16, color: terra, phase: 0.0 },
    { type: 'line', y: 5.3, w: 0.25, color: black },
  ], { sFrom: s0, sTo: s1, seed });
  const clayP = { ...CLAY.classic, seed: seed * 1.6, burnish: 0.35 };
  return finish({ parts: [body], wob: makeWobble(seed, 24, 0.006), surface: claySurface(clayP), avgAlbedo: clayP.base });
}

// ---------------------------------------------------------- cylinder planter with saucer
function cylPlanterPath() {
  return vesselPath({
    baseY: 0, foot: 7.7, footRound: 0.35,
    outer: [[7.95, 0.5], [8.15, 6.0], [8.35, 12.6], [8.45, 13.6], [9.05, 13.95], [9.15, 15.0], [9.15, 16.3], [9.05, 16.75]],
    thick: (y) => 0.75 + 0.5 * smooth(13.2, 14.2, y), floor: 1.3, floorRound: 0.6,
  });
}
function saucerPath() {
  return vesselPath({
    foot: 8.6, footRound: 0.4,
    outer: [[9.4, 0.4], [10.4, 1.0], [10.9, 1.9], [11.0, 2.55]],
    thick: 0.55, floor: 0.6, floorRound: 0.6, startDir: [1, 0.3],
  });
}
function cylinderPlanter(opts = {}) {
  const seed = opts.seed ?? 12;
  const pot = lathe(cylPlanterPath(), { name: 'pot', y0: 0.62 });
  const saucer = lathe(saucerPath(), { name: 'saucer', noWob: true });
  const [s0, s1] = outerRange(pot.prof);
  const groove = C.black;
  pot.deco = prepareDeco(pot.prof, [
    { type: 'line', y: 11.0, w: 0.11, color: groove, tilt: 0.02, rag: 0.004 },
    { type: 'line', y: 10.45, w: 0.11, color: groove, tilt: 0.02, rag: 0.004 },
  ], { sFrom: s0, sTo: s1, seed });
  const clayP = { ...CLAY.planter, seed: seed * 1.5, etch: true, etchCol: srgb('#7E3A22'), throwAmp: 0.045 };
  saucer.clayP = { ...clayP, seed: seed * 5.5 };
  return finish({ parts: [pot, saucer], wob: makeWobble(seed, 17, 0.004), surface: claySurface(clayP), avgAlbedo: clayP.base });
}

// ---------------------------------------------------------- tapered planter (classic flower pot)
function taperPath() {
  return vesselPath({
    foot: 6.3, footRound: 0.35,
    outer: [[6.45, 0.4], [7.5, 6.5], [8.45, 12.6], [8.6, 13.05], [9.55, 13.3], [9.7, 14.6], [9.75, 16.0], [9.6, 16.5]],
    thick: (y) => 0.7 + 0.5 * smooth(12.8, 13.6, y), floor: 1.1, floorRound: 0.6,
  });
}
function taperedPlanter(opts = {}) {
  const seed = opts.seed ?? 13;
  const body = lathe(taperPath(), { name: 'body' });
  const clayP = { ...CLAY.planter, seed: seed * 1.8, throwAmp: 0.05, bloom: 0.8, bloomY: 7 };
  return finish({ parts: [body], wob: makeWobble(seed, 16, 0.004), surface: claySurface(clayP), avgAlbedo: clayP.base });
}

// ---------------------------------------------------------- bowl planter
function bowlPlanterPath() {
  return vesselPath({
    foot: 6.2, footRound: 0.3,
    outer: [[6.3, 0.7], [6.1, 1.05], [7.6, 1.6], [10.6, 3.6], [12.9, 6.2], [14.1, 8.6], [14.45, 9.9], [14.4, 10.5]],
    thick: (y) => 0.8 + 0.45 * smooth(9.0, 10.5, y), floor: 1.6, floorRound: 2.0,
  });
}
function bowlPlanter(opts = {}) {
  const seed = opts.seed ?? 14;
  const body = lathe(bowlPlanterPath(), { name: 'body' });
  const clayP = { ...CLAY.planter, base: srgb('#B35E3D'), seed: seed * 2.7, throwAmp: 0.05 };
  return finish({ parts: [body], wob: makeWobble(seed, 10, 0.005), surface: claySurface(clayP), avgAlbedo: clayP.base });
}

// ---------------------------------------------------------- kulhad
function kulhadPath(h = 8.2, rt = 3.7, rb = 2.35) {
  return vesselPath({
    foot: rb, footRound: 0.25,
    outer: [[rb + 0.12, 0.35], [rb + (rt - rb) * 0.35, h * 0.32], [rb + (rt - rb) * 0.72, h * 0.68], [rt - 0.02, h * 0.95], [rt, h]],
    thick: 0.3, floor: 0.75, floorRound: 0.5,
  });
}
function kulhad(opts = {}) {
  const seed = opts.seed ?? 15;
  const body = lathe(kulhadPath(opts.h, opts.rt, opts.rb), { name: 'body' });
  const clayP = { ...CLAY.kulhad, seed: seed * 3.9, throwFreq: [1.6, 3.1, 6.0] };
  return finish({ parts: [body], wob: makeWobble(seed, 8, 0.014), surface: claySurface(clayP), avgAlbedo: clayP.base });
}

// ---------------------------------------------------------- gullak (money bank)
function gullakPath() {
  const b = new PathBuilder(0, 0);
  b.line(3.9, 0).round(0.35)
    .spline([[4.25, 0.5], [5.9, 1.6], [7.15, 3.7], [7.6, 6.3], [7.3, 8.9], [6.2, 11.0], [4.5, 12.45], [2.6, 13.25], [1.55, 13.5]], { startDir: [0.4, 1] }).round(0.3)
    .spline([[1.15, 13.9], [1.1, 14.35]])
    .spline([[1.6, 14.7], [1.75, 15.3], [1.4, 15.95], [0.75, 16.25], [0, 16.32]], { endDir: [-1, 0] });
  return b.build();
}
function gullak(opts = {}) {
  const seed = opts.seed ?? 16;
  const body = lathe(gullakPath(), { name: 'body' });
  // coin slot cut into the shoulder, facing the camera (-z), oriented by the profile normal
  const [g0, g1] = outerRange(body.prof);
  const sy = 11.9, ss = body.prof.sAtY(sy, g0, g1);
  const [sr, , snr, sny] = body.prof.atS(ss);
  const cy = sy - sny * 0.5, cz = -sr + snr * 0.5;
  const slot = custom((x, y, z) => {
    const qy = y - cy, qz = z - cz;
    const qn = qy * sny - qz * snr; // along the outward normal (0, ny, -nr)
    const qt = qy * snr + qz * sny; // along the meridian
    return sdRoundBox(x, qn, qt, 1.65, 1.6, 0.21, 0.16);
  }, { sub: true, name: 'slot', bound: { r: 8, y0: 9, y1: 16 } });
  const [s0, s1] = outerRange(body.prof);
  const cream = C.creamPaint;
  body.deco = prepareDeco(body.prof, [
    { type: 'line', y: 8.9, w: 0.3, color: cream },
    { type: 'scallops', y: 8.15, n: 16, w: 0.2, color: cream },
    { type: 'dots', y: 6.6, n: 16, rx: 0.2, color: cream, phase: 0.5 },
    { type: 'line', y: 5.2, w: 0.3, color: cream },
    { type: 'line', y: 14.75, w: 0.14, color: cream, tilt: 0.02 },
  ], { sFrom: s0, sTo: s1, seed });
  const clayP = { ...CLAY.classic, seed: seed * 2.1, throwEnv: (y) => 0.6 + 0.4 * smooth(10, 13, y) };
  return finish({ parts: [body, slot], wob: makeWobble(seed, 16, 0.006), surface: claySurface(clayP), avgAlbedo: clayP.base });
}

// ---------------------------------------------------------- diya
function diyaPath() {
  return vesselPath({
    foot: 1.55, footRound: 0.25,
    outer: [[1.75, 0.3], [2.6, 0.75], [3.35, 1.35], [3.7, 1.9], [3.8, 2.25]],
    thick: 0.32, floor: 0.55, floorRound: 0.9, startDir: [1, 0.4],
  });
}
const DIYA_SPOUT = { a: 0.55, sigma: 0.42 };
function spoutScale(x, z, r) {
  // diya rim is pinched into a pouring lip at θ = -90° (toward -z)
  if (r < 1e-6) return 1;
  const c = -z / r; // cos of angle to the -z direction
  const ang = Math.acos(Math.max(-1, Math.min(1, c)));
  return 1 + DIYA_SPOUT.a * Math.exp(-(ang * ang) / (DIYA_SPOUT.sigma * DIYA_SPOUT.sigma));
}
function diya(opts = {}) {
  const seed = opts.seed ?? 17;
  const prof = new Profile(diyaPath(), {});
  // custom part: scale radius so the rim stretches into a spout
  const bowl = custom((x, y, z, r) => {
    const k = spoutScale(x, z, r);
    // pinch: the spout narrows sideways and lifts slightly
    const lift = (k - 1) * 0.35 * Math.max(0, y - 1.0);
    return prof.dist(r / k, y - lift) * 0.82;
  }, { name: 'bowl', bound: { r: 3.9 * (1 + DIYA_SPOUT.a) + 0.2, y0: 0, y1: 3.2 } });
  bowl.prof = prof;
  bowl.hull = [];
  for (let i = 0; i < prof.n; i += 3) {
    for (let a = 0; a < 48; a++) {
      const t = a / 48 * Math.PI * 2, x = Math.cos(t), z = Math.sin(t);
      const k = spoutScale(x, z, 1);
      bowl.hull.push([x * prof.px[i] * k, prof.py[i] + (k - 1) * 0.35 * Math.max(0, prof.py[i] - 1.0), z * prof.px[i] * k]);
    }
  }
  const parts = [bowl];
  const extra = {};
  if (opts.oil !== false) {
    // oil pool (a slightly domed disc inside the bowl)
    const oil = custom((x, y, z, r) => {
      const k = spoutScale(x, z, r);
      const d1 = y - 1.15;
      const d2 = r / k - 2.75;
      return Math.max(d1, d2, 0.6 - y);
    }, { name: 'oil', mat: 'oil', bound: { r: 4.5, y0: 0.5, y1: 1.3 } });
    parts.push(oil);
    extra.oil = (H, M) => {
      const n = noise3(H.lx * 1.3, 0.5, H.lz * 1.3);
      const k = 1 + 0.12 * n;
      shadeSimple(H, M, { base: [0.36 * k, 0.19 * k, 0.035 * k], rough: 0.3, spec: 0.03, coat: 1.0, coatRough: 0.035, on: 0, wrap: 0.4, sss: [0.18, 0.07, 0.0] });
    };
  }
  let wickTip = null;
  if (opts.wick !== false) {
    // cotton wick lying in the spout, tip raised
    const a = [0, 0.85, -2.2], bpt = [0, 2.42, -5.45];
    const wick = custom((x, y, z) => {
      // twisted cotton: capsule with a helical ripple
      const d = sdCapsule(x, y, z, a[0], a[1], a[2], bpt[0], bpt[1], bpt[2], 0.13);
      return d - 0.018 * Math.sin(Math.atan2(y - 1.6, x) * 2 + z * 18);
    }, { name: 'wick', mat: 'wick', bound: { r: 6.2, y0: 0.6, y1: 2.8 } });
    parts.push(wick);
    wickTip = [bpt[0], bpt[1] + 0.08, bpt[2] - 0.08];
    extra.wick = (H, M) => {
      const t = Math.max(0, Math.min(1, (-H.lz - 4.85) / 0.55));
      const lit = opts.lit ? 1 : 0.35;
      const c = [0.78 - 0.7 * t * lit, 0.74 - 0.68 * t * lit, 0.66 - 0.62 * t * lit];
      shadeSimple(H, M, { base: c, rough: 0.9, on: 0.6, wrap: 0.3, sss: [0.2, 0.15, 0.1], bump: 0.15, bumpF: 9, bumpYS: 3 });
    };
  }
  const clayP = { ...CLAY.red, base: srgb('#A9472C'), seed: seed * 4.1, throwAmp: 0.05, rough: 0.68, burnish: 0 };
  const model = finish({ parts, wob: null, surface: claySurface(clayP, extra), avgAlbedo: clayP.base });
  if (opts.lit && wickTip) model.flame = { pos: [wickTip[0], wickTip[1] - 0.06, wickTip[2]], h: 2.9, rad: 0.45 };
  model.wickTip = wickTip;
  return model;
}

// ---------------------------------------------------------- festive kalash
function kalashPath() {
  return vesselPath({
    foot: 5.2, footRound: 0.4,
    outer: [[5.6, 0.5], [7.6, 1.6], [9.8, 3.9], [10.95, 7.0], [11.05, 10.0], [10.3, 13.2], [8.6, 16.0], [6.4, 18.0], [5.0, 19.0], [4.55, 19.8], [4.6, 20.6], [5.3, 21.3], [6.6, 21.85], [7.55, 22.2], [7.8, 22.5]],
    thick: (y) => 0.5 + 0.25 * smooth(21.6, 22.5, y), floor: 1.0, floorRound: 1.2,
  });
}
function kalash(opts = {}) {
  const seed = opts.seed ?? 18;
  const body = lathe(kalashPath(), { name: 'body' });
  const [s0, s1] = outerRange(body.prof);
  const red = C.sindoor, gold = C.mustard, white = C.white;
  body.deco = prepareDeco(body.prof, [
    { type: 'fill', y0: 2.4, y1: 18.3, color: red, opacity: 0.97, wave: 0.03, solidOp: true },
    { type: 'line', y: 17.6, w: 0.42, color: gold },
    { type: 'scallops', y: 16.85, n: 14, w: 0.22, color: white, up: false },
    { type: 'dots', y: 15.5, n: 14, rx: 0.2, color: gold, phase: 0.5 },
    { type: 'line', y: 14.4, w: 0.3, color: gold },
    { type: 'petals', y: 11.1, n: 7, np: 8, len: 1.35, wid: 0.45, inner: 0.35, center: 0.45, color: gold },
    { type: 'dots', y: 11.1, n: 7, rx: 0.26, color: white },
    { type: 'dots', y: 11.1, n: 14, rx: 0.16, color: white, phase: 0.5 },
    { type: 'line', y: 7.9, w: 0.3, color: gold },
    { type: 'triangles', y0: 5.6, y1: 7.5, n: 22, color: gold, fillW: 0.4, down: true },
    { type: 'dots', y: 6.9, n: 22, rx: 0.1, color: white, phase: 0.5 },
    { type: 'line', y: 3.1, w: 0.4, color: gold },
    { type: 'line', y: 21.45, w: 0.3, color: gold, tilt: 0.04 },
    { type: 'dots', y: 20.65, n: 26, rx: 0.12, color: white, tilt: 0.04 },
  ], { sFrom: s0, sTo: s1, seed });
  const parts = [body];
  const extra = {};
  // sacred thread (mauli) tied round the neck
  const thread = custom((x, y, z, r) => {
    const t = Math.atan2(z, x);
    const yy = y - 19.75 - 0.05 * Math.sin(t * 2);
    return Math.hypot(r - 4.62, yy) - 0.17;
  }, { name: 'thread', mat: 'thread', bound: { r: 5.0, y0: 19.3, y1: 20.3 } });
  parts.push(thread);
  extra.thread = (H, M) => {
    const t = Math.atan2(H.lz, H.lx);
    const ph = t * 60 + H.ly * 28;
    const s = Math.sin(ph);
    const yellow = s > 0.55 ? 1 : 0;
    const c = yellow ? srgb('#E0A61E') : srgb('#B5141A');
    shadeSimple(H, M, { base: c, rough: 0.75, on: 0.5, wrap: 0.2, sss: [0.2, 0.02, 0.02], bump: 0.25, bumpF: 12 });
  };
  if (opts.coconut !== false) {
    // coconut resting in the mouth, wrapped by mango leaves
    const cocY = 25.0;
    const coco = custom((x, y, z, r) => {
      const py = y - cocY;
      const d = Math.hypot(x / 4.3, py / 5.2, z / 4.3) - 1;
      return d * 4.1 - 0.0;
    }, { name: 'coconut', mat: 'coconut', bound: { r: 4.6, y0: 19.5, y1: 30.6 }, hull: [[0, 30.3, 0], [4.4, 25, 0], [-4.4, 25, 0], [0, 25, 4.4], [0, 25, -4.4]] });
    parts.push(coco);
    extra.coconut = (H, M) => {
      const fib = noise3(H.lx * 5.0, H.ly * 0.8, H.lz * 5.0);
      const fib2 = noise3(H.lx * 13.0, H.ly * 2.0, H.lz * 13.0);
      const top = clamp01((H.ly - 27.5) / 2.5);
      const k = 1 + 0.25 * fib + 0.12 * fib2;
      shadeSimple(H, M, { base: [0.21 * k * (1 - 0.3 * top), 0.115 * k * (1 - 0.35 * top), 0.055 * k], rough: 0.8, on: 0.5, bump: 0.35, bumpF: 6, bumpYS: 0.2 });
    };
    // mango leaves: thin curved blades radiating from under the coconut
    const NL = 7;
    const leafSdf = (x, y, z, r) => {
      if (r < 3.2 || r > 12.6 || y < 18.6 || y > 25.8) {
        const dr = Math.max(3.2 - r, r - 12.6, 0), dy = Math.max(18.6 - y, y - 25.8, 0);
        return Math.max(0.05, Math.hypot(dr, dy));
      }
      const t = Math.atan2(z, x);
      const k = Math.round((t / (Math.PI * 2)) * NL - 0.25);
      const a0 = (k + 0.25) / NL * Math.PI * 2;
      // local leaf frame: u along the leaf (outward), v sideways, w normal
      const c = Math.cos(a0), s = Math.sin(a0);
      const u = x * c + z * s, v = -x * s + z * c;
      const u0 = u - 3.4; // start at the mouth
      // leaf droops: centre line height
      const L = 8.2;
      const tt = Math.max(0, Math.min(1, u0 / L));
      const yc = 22.6 + 1.6 * tt - 3.4 * tt * tt;
      const slope = (1.6 - 6.8 * tt) / L;
      const width = 1.55 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, tt * 0.98 + 0.02))), 0.85);
      const curl = 0.18 * (v * v) / (1.6 * 1.6);
      const wdist = (y - yc - curl) / Math.sqrt(1 + slope * slope);
      const dEdge = Math.abs(v) - width;
      const dLen = Math.max(-u0, u0 - L);
      const thick = 0.045;
      const dPlane = Math.abs(wdist) - thick;
      const d = Math.max(dPlane, dEdge * 0.9, dLen);
      return d;
    };
    const leaves = custom(leafSdf, { name: 'leaves', mat: 'leaf', bound: { r: 12.5, y0: 18.0, y1: 26.0 },
      hull: Array.from({ length: NL }, (_, k) => { const a = (k + 0.25) / NL * Math.PI * 2; return [Math.cos(a) * 11.6, 19.5, Math.sin(a) * 11.6]; }) });
    parts.push(leaves);
    extra.leaf = (H, M) => {
      const t = Math.atan2(H.lz, H.lx);
      const k = Math.round((t / (Math.PI * 2)) * NL - 0.25);
      const a0 = (k + 0.25) / NL * Math.PI * 2;
      const v = -H.lx * Math.sin(a0) + H.lz * Math.cos(a0);
      const vein = Math.exp(-Math.pow(v / 0.07, 2));
      const n = noise3(H.lx * 0.8, H.ly * 0.8, H.lz * 0.8);
      const g = 1 + 0.18 * n;
      shadeSimple(H, M, { base: [0.035 * g + 0.05 * vein, 0.14 * g + 0.08 * vein, 0.025 * g + 0.02 * vein], rough: 0.38, spec: 0.04, on: 0.1, wrap: 0.35, sss: [0.04, 0.12, 0.0] });
    };
  }
  const clayP = { ...CLAY.classic, seed: seed * 1.4, burnish: 0.4, paintRough: 0.55 };
  return finish({ parts, wob: makeWobble(seed, 22, 0.005), surface: claySurface(clayP, extra), avgAlbedo: srgb('#B8281E') });
}

// ---------------------------------------------------------- stoneware jar + small bowl
function jarPath() {
  return vesselPath({
    foot: 5.3, footRound: 0.45,
    outer: [[5.75, 0.45], [6.05, 2.0], [6.15, 9.5], [6.0, 12.6], [5.4, 13.6], [4.9, 14.0], [4.85, 14.9], [4.95, 15.2]],
    thick: 0.5, floor: 0.9, floorRound: 0.8,
  });
}
function jarLidPath() {
  const b = new PathBuilder(0, 14.4);
  b.line(4.1, 14.4).round(0.2).line(4.2, 15.15).round(0.1).line(5.35, 15.2).round(0.2)
    .spline([[5.5, 15.45], [5.4, 15.75]]).round(0.15)
    .spline([[4.6, 16.0], [3.0, 16.25], [1.6, 16.35]]).round(0.3)
    .spline([[1.15, 16.7], [1.1, 17.0]])
    .spline([[1.5, 17.25], [1.55, 17.6], [1.2, 17.9], [0, 18.0]], { endDir: [-1, 0] });
  return b.build();
}
function stonewareJar(opts = {}) {
  const seed = opts.seed ?? 19;
  const body = lathe(jarPath(), { name: 'body', mat: 'glaze' });
  const lid = lathe(jarLidPath(), { name: 'lid', mat: 'glaze' });
  const glaze = { base: srgb('#B9AE9A'), rough: 0.5, coat: 0.5, coatRough: 0.2, breakY: 14.5, edge: srgb('#6B4A30') };
  body.glazeP = glaze;
  lid.glazeP = { ...glaze, breakY: 17.6 };
  return finish({ parts: [body, lid], wob: makeWobble(seed, 18, 0.003), surface: claySurface(CLAY.red, { glaze }), avgAlbedo: glaze.base });
}
function smallBowlPath() {
  return vesselPath({
    foot: 3.0, footRound: 0.3,
    outer: [[3.3, 0.4], [4.8, 1.3], [5.9, 2.8], [6.35, 4.1], [6.4, 4.6]],
    thick: 0.45, floor: 0.6, floorRound: 1.3, startDir: [1, 0.4],
  });
}
function smallBowl(opts = {}) {
  const seed = opts.seed ?? 20;
  const body = lathe(smallBowlPath(), { name: 'body' });
  const clayP = { ...CLAY.red, base: srgb('#A65236'), seed: seed * 2.4, rough: 0.7, throwAmp: 0.05, burnish: 0 };
  return finish({ parts: [body], wob: makeWobble(seed, 5, 0.007), surface: claySurface(clayP), avgAlbedo: clayP.base });
}

// ------------------------------------------------------------- registry
export const MODELS = {
  classicMatka, blackMatka, plainMatka, tapMatka, surahi, waterBottle, handi, kadai, curdPot, vase, folkPot,
  cylinderPlanter, taperedPlanter, bowlPlanter, kulhad, gullak, diya, kalash, stonewareJar, smallBowl,
};

const cache = new Map();
export function getModel(name, opts = {}) {
  const key = name + JSON.stringify(opts);
  if (!cache.has(key)) {
    const f = MODELS[name];
    if (!f) throw new Error('unknown model ' + name);
    cache.set(key, f(opts));
  }
  return cache.get(key);
}
