// Turns a JSON scene spec into the runtime scene used by renderer.mjs:
// instantiates models, auto-frames the camera and sets up the light rig.
import { getModel } from './models.mjs';
import { srgb } from './materials.mjs';
import { srgbEncode, MODE_OPAQUE, MODE_CUTOUT, MODE_SHADOW, MODE_CUTSHADOW } from './renderer.mjs';

const DEG = Math.PI / 180;
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

/** camera-relative direction: x = screen right, y = up, z = toward camera */
function camRel(az, v) {
  const [x, y, z] = norm(v);
  const right = [Math.cos(az), 0, -Math.sin(az)];
  const back = [-Math.sin(az), 0, -Math.cos(az)];
  return norm([x * right[0] + z * back[0], y, x * right[2] + z * back[2]]);
}

export const RIGS = {
  // soft studio: big softbox key upper-left-front, fill right, kicker behind right
  studio: {
    key: { dir: [-0.62, 0.74, 0.42], col: [1.0, 0.955, 0.9], E: 2.6, w: 0.3 },
    fill: { dir: [0.85, 0.22, 0.6], col: [0.97, 0.97, 1.0], E: 0.48, w: 0.6 },
    rim: { dir: [0.62, 0.42, -0.72], col: [1.0, 0.96, 0.92], E: 1.3, w: 0.25 },
    sky: [0.97, 0.94, 0.9], skyE: 0.55,
    bounce: [1.0, 0.9, 0.78], bounceE: 0.5,
    env: { hor: [0.95, 0.9, 0.82], floor: [0.85, 0.79, 0.7], top: [0.42, 0.4, 0.38], gain: 0.9,
      cards: [{ key: 'key', sharp: 9, I: 4.2 }, { key: 'rim', sharp: 16, I: 2.4 }, { key: 'fill', sharp: 6, I: 0.9 }] },
    keyShadowDensity: 0.42, aoDensity: 0.62, floorSoft: 1.0,
  },
  // late-afternoon: low warm key from the left, long soft shadows
  afternoon: {
    key: { dir: [-0.88, 0.42, 0.2], col: [1.0, 0.84, 0.66], E: 3.0, w: 0.16 },
    fill: { dir: [0.8, 0.35, 0.55], col: [0.92, 0.93, 1.0], E: 0.45, w: 0.6 },
    rim: { dir: [0.5, 0.35, -0.8], col: [1.0, 0.88, 0.74], E: 1.0, w: 0.25 },
    sky: [0.95, 0.92, 0.9], skyE: 0.5,
    bounce: [1.0, 0.86, 0.7], bounceE: 0.42,
    env: { hor: [0.95, 0.86, 0.74], floor: [0.85, 0.76, 0.64], top: [0.4, 0.38, 0.36], gain: 0.9,
      cards: [{ key: 'key', sharp: 14, I: 4.5 }, { key: 'rim', sharp: 16, I: 2.0 }, { key: 'fill', sharp: 6, I: 0.8 }] },
    keyShadowDensity: 0.5, aoDensity: 0.62, floorSoft: 1.0,
  },
};

export const QUALITY = {
  draft: { scale: 0.3, minSpp: 1, maxSpp: 1, varThresh: 1, shadowSteps: 40 },
  preview: { scale: 0.5, minSpp: 4, maxSpp: 4, varThresh: 1, shadowSteps: 48 },
  final: { scale: 1, minSpp: 4, maxSpp: 9, varThresh: 0.012, shadowSteps: 56 },
};

function instance(o, i) {
  const model = getModel(o.model, o.opts || {});
  const rot = (o.rot ?? 0) * DEG, sc = o.scale ?? 1;
  return {
    x: o.x ?? 0, z: o.z ?? 0, c: Math.cos(rot), s: Math.sin(rot), sc, is: 1 / sc,
    wbr: model.bound.r * sc, wy0: model.bound.y0 * sc, wy1: model.bound.y1 * sc,
    parts: model.parts, surface: model.surface, seed: o.seed ?? (i + 1), model, hidden: false,
    avgAlbedo: model.avgAlbedo || [0.4, 0.15, 0.08], name: o.model,
  };
}
function worldHull(inst) {
  const out = [];
  for (const [x, y, z] of inst.model.hull) {
    const lx = x * inst.sc, ly = y * inst.sc, lz = z * inst.sc;
    out.push([inst.x + lx * inst.c - lz * inst.s, ly, inst.z + lx * inst.s + lz * inst.c]);
  }
  return out;
}

export const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));

function makeCamera(spec, W, H, objs) {
  const c = spec.camera || {};
  if (c.path) {
    // scroll sequence: interpolate from a close-up to the auto-framed end shot
    const p = c.path;
    const end = makeCamera({ ...spec, camera: { ...c, path: null, elev: p.elev1, fill: p.fill, centerY: p.centerY ?? 0 } }, W, H, objs);
    const e = easeInOut(p.t);
    const elev = p.elev0 + (p.elev1 - p.elev0) * e;
    const target = p.target0.map((v, i) => v + (end.target[i] - v) * e);
    const dist = Math.exp(Math.log(p.dist0) + (Math.log(end.dist) - Math.log(p.dist0)) * e);
    return makeCamera({ ...spec, camera: { ...c, path: null, elev, target, dist } }, W, H, objs);
  }
  const el = (c.elev ?? 12) * DEG, az = (c.azim ?? 0) * DEG;
  const fovY = (c.fov ?? 20) * DEG;
  const tanH = Math.tan(fovY / 2), aspect = W / H;
  const f = [Math.sin(az) * Math.cos(el), -Math.sin(el), Math.cos(az) * Math.cos(el)];
  const right = norm([f[2], 0, -f[0]]);
  const up = [f[1] * right[2] - f[2] * right[1], f[2] * right[0] - f[0] * right[2], f[0] * right[1] - f[1] * right[0]];
  let T, D;
  if (c.target && c.dist) { T = c.target.slice(); D = c.dist; }
  else {
    const idx = c.frame ?? objs.map((_, i) => i);
    const pts = idx.flatMap((i) => worldHull(objs[i]));
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const p of pts) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); }
    T = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    const size = Math.max(mx[1] - mn[1], (mx[0] - mn[0]) / aspect, 1);
    D = size / (2 * tanH * (c.fill ?? 0.7));
    const fill = c.fill ?? 0.7, fillW = c.fillW ?? 0.9;
    const cy = c.centerY ?? 0, cx = c.centerX ?? 0; // NDC offsets of the bbox centre
    for (let it = 0; it < 40; it++) {
      const pos = [T[0] - f[0] * D, T[1] - f[1] * D, T[2] - f[2] * D];
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of pts) {
        const q = [p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]];
        const zc = q[0] * f[0] + q[1] * f[1] + q[2] * f[2];
        const xn = (q[0] * right[0] + q[1] * right[1] + q[2] * right[2]) / (zc * tanH * aspect);
        const yn = (q[0] * up[0] + q[1] * up[1] + q[2] * up[2]) / (zc * tanH);
        x0 = Math.min(x0, xn); x1 = Math.max(x1, xn); y0 = Math.min(y0, yn); y1 = Math.max(y1, yn);
      }
      const h = (y1 - y0) / 2, w = (x1 - x0) / 2;
      const ratio = Math.max(h / fill, w / fillW);
      D *= 1 + (ratio - 1) * 0.7;
      // recentre
      const ycen = (y0 + y1) / 2 - cy, xcen = (x0 + x1) / 2 - cx;
      const k = D * tanH * 0.7;
      for (let j = 0; j < 3; j++) T[j] += up[j] * ycen * k + right[j] * xcen * k * aspect;
    }
  }
  const pos = [T[0] - f[0] * D, T[1] - f[1] * D, T[2] - f[2] * D];
  return {
    ox: pos[0], oy: pos[1], oz: pos[2], fx: f[0], fy: f[1], fz: f[2],
    rx: right[0], ry: right[1], rz: right[2], ux: up[0], uy: up[1], uz: up[2],
    tanH, aspect, pixAng: 2 * tanH / H, dist: D, sx: c.shiftX ?? 0, sy: c.shiftY ?? 0,
    az, el, target: T,
  };
}

function lightOf(az, L) {
  const d = camRel(az, L.dir);
  return { x: d[0], y: d[1], z: d[2], r: L.col[0] * L.E, g: L.col[1] * L.E, b: L.col[2] * L.E, w: L.w };
}

/** Build the runtime scene for a job spec. */
export function buildScene(spec, quality) {
  const Q = QUALITY[quality] || QUALITY.final;
  const scale = spec.resScale ?? Q.scale;
  const W = Math.max(8, Math.round(spec.width * scale));
  const H = Math.max(8, Math.round(spec.height * scale));
  const objs = (spec.objects || []).map(instance);
  const cam = makeCamera(spec, W, H, objs);
  const rigBase = RIGS[spec.rig || 'studio'];
  const rig = { ...rigBase, ...(spec.rigOverride || {}) };
  // lights rotate with the camera unless the spec pins them to world space
  const laz = spec.lightAzim !== undefined ? spec.lightAzim * DEG : cam.az;
  const key = lightOf(laz, rig.key), fill = lightOf(laz, rig.fill), rim = lightOf(laz, rig.rim);
  const lights = {
    key, fill, rim,
    sky: { r: rig.sky[0] * rig.skyE, g: rig.sky[1] * rig.skyE, b: rig.sky[2] * rig.skyE },
    bounce: { r: rig.bounce[0] * rig.bounceE, g: rig.bounce[1] * rig.bounceE, b: rig.bounce[2] * rig.bounceE },
  };
  const byKey = { key, rim, fill };
  const env = {
    hor: rig.env.hor, floor: rig.env.floor, top: rig.env.top, gain: rig.env.gain,
    cards: rig.env.cards.map((c) => ({ x: byKey[c.key].x, y: byKey[c.key].y, z: byKey[c.key].z, sharp: c.sharp, r: c.I * byKey[c.key].r / (rig[c.key].E || 1), g: c.I * byKey[c.key].g / (rig[c.key].E || 1), b: c.I * byKey[c.key].b / (rig[c.key].E || 1) })),
  };
  const cream = srgb(spec.background || '#F6F0E5');
  const shadowCol = srgb('#45352C');
  const modes = { opaque: MODE_OPAQUE, cutout: MODE_CUTOUT, shadow: MODE_SHADOW, cutshadow: MODE_CUTSHADOW };
  // size-aware shadow catcher scale
  let maxH = 10;
  for (const o of objs) maxH = Math.max(maxH, o.wy1);
  const flames = (spec.flames || []).map((f) => ({ lean: 0, I: 9, ...f }));
  const pointLights = (spec.pointLights || []).map((p) => ({ soft: 4, shadow: true, rad: 0.5, ...p }));
  for (const o of objs) {
    const fl = o.model.flame;
    if (!fl) continue;
    const [lx, ly, lz] = fl.pos.map((v) => v * o.sc);
    const wx = o.x + lx * o.c - lz * o.s, wz = o.z + lx * o.s + lz * o.c;
    const lean = (spec.flameLean ?? 0.06) * o.sc;
    flames.push({ x: wx, y: ly, z: wz, h: fl.h * o.sc, rad: fl.rad * o.sc, I: spec.flameI ?? 10, lean });
    const pl = spec.flameLight ?? { I: 55, col: [1.0, 0.58, 0.24] };
    pointLights.push({ x: wx, y: ly + fl.h * 0.32 * o.sc, z: wz, r: pl.col[0], g: pl.col[1], b: pl.col[2], I: pl.I, soft: 1.5, shadow: true, rad: 0.6 });
  }
  const haz = cam.az;
  return {
    W, H, seed: spec.seed ?? 7, mode: modes[spec.mode || 'opaque'],
    exposure: spec.exposure ?? 0.72, cam, objs, lights, env,
    sweep: { hx: Math.sin(haz), hz: Math.cos(haz), zs: spec.sweepStart ?? 70, R: spec.sweepR ?? 60 },
    cream, creamSrgb: cream.map(srgbEncode), shadowSrgb: shadowCol.map(srgbEncode),
    shadowTint: spec.shadowTint ?? [0.88, 1.0, 1.16],
    keyShadowDensity: spec.keyShadowDensity ?? rig.keyShadowDensity,
    aoDensity: spec.aoDensity ?? rig.aoDensity,
    floorSoft: spec.floorSoft ?? rig.floorSoft,
    floorAOScale: spec.floorAOScale ?? Math.max(1.2, maxH / 14),
    floorAO2: spec.floorAO2 ?? 2.6, floorAO2Mix: spec.floorAO2Mix ?? 0.5,
    aoScale: spec.aoScale ?? Math.max(0.6, maxH / 30),
    bounceH: spec.bounceH ?? Math.max(3, maxH * 0.25),
    eps0: spec.eps0 ?? 0.0015,
    shadowSteps: Q.shadowSteps, rimShadow: spec.rimShadow ?? false,
    quality: { minSpp: Q.minSpp, maxSpp: Q.maxSpp, varThresh: Q.varThresh },
    flames, pointLights, floorGlow: spec.floorGlow ?? 0.35,
    post: spec.post || {},
  };
}
