// Surface materials. Each shader fills MAT (albedo, roughness, specular,
// subsurface wrap tint, shading normal, emission) from the hit record HIT.
// All procedural detail is seeded by object-local surface position, so it
// rotates with the object and never shimmers between animation frames, and
// every high-frequency component is faded out below the pixel footprint.
import { noise3, noised, ND, fbm3, bandWeight, hash2f } from './noise.mjs';
import { evalPaint, PAINT, paintHeight } from './patterns.mjs';

export function srgb(hex) {
  const v = typeof hex === 'string' ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) : hex;
  return v.map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
}

const TAU = Math.PI * 2;

/** Perturb MAT normal by a world-space gradient g (projected to tangent plane). */
function bumpWorld(M, gx, gy, gz, k) {
  const nx = M.nx, ny = M.ny, nz = M.nz;
  const d = gx * nx + gy * ny + gz * nz;
  M.nx = nx - k * (gx - d * nx); M.ny = ny - k * (gy - d * ny); M.nz = nz - k * (gz - d * nz);
}
function bumpTangent(M, H, dhds, dhdu) {
  M.nx -= dhds * H.tx + dhdu * H.bx;
  M.ny -= dhds * H.ty + dhdu * H.by;
  M.nz -= dhds * H.tz + dhdu * H.bz;
}
function normalizeN(M) {
  const l = Math.sqrt(M.nx * M.nx + M.ny * M.ny + M.nz * M.nz) || 1;
  M.nx /= l; M.ny /= l; M.nz /= l;
}
/** local gradient → world (object rotation about y) */
function lw(H, gx, gz) {
  return [gx * H.oc - gz * H.os, gx * H.os + gz * H.oc];
}

/**
 * Unglazed clay (terracotta / black burnished / smoked).
 * P: { base:[r,g,b] linear, tone, speck, light, throwAmp, throwFreq, beaten,
 *      rough, spec, burnish, soot, sootY, wrap, sss:[r,g,b], dark, grain }
 */
export function shadeClay(H, M, P, deco, region) {
  const x = H.lx, y = H.ly, z = H.lz, fp = H.fpg;
  const seed = (P.seed ?? 0) + H.seed * 13.17;
  const r = H.r;
  // ---------------------------------------------------------------- albedo
  let ar = P.base[0], ag = P.base[1], ab = P.base[2];
  const m1 = fbm3(x + seed, y * 1.1, z - seed, 0.085, 3, fp);
  const m2 = noise3(x * 0.42 + seed, y * 0.42, z * 0.42);
  const tone = P.tone ?? 0.1;
  const m3 = noise3(x * 1.6 - seed, y * 1.6 + 2.2, z * 1.6) * bandWeight(0.4, fp);
  const lum = 1 + tone * (0.8 * m1 + 0.3 * m2 + 0.22 * m3);
  const hue = noise3(x * 0.06 - seed, y * 0.06 + 3.1, z * 0.06);
  ar *= lum * (1 + 0.07 * hue); ag *= lum * (1 - 0.02 * hue); ab *= lum * (1 - 0.1 * hue);
  // firing flashes: occasional darker / redder clouds
  if (P.flash) {
    const fl = noise3(x * 0.11 + 7.3 + seed, y * 0.11, z * 0.11 - 2.2);
    const f = Math.max(0, fl - 0.15) * P.flash * 2.2;
    ar *= 1 - 0.18 * f; ag *= 1 - 0.32 * f; ab *= 1 - 0.38 * f;
  }
  // horizontal slip streaks from wiping on the wheel (stretched around the axis)
  const sw = bandWeight(0.25, fp);
  if (sw > 0) {
    const st = noise3(H.cs * r * 0.22 + seed, y * 3.1, H.sn * r * 0.22);
    const k = 1 + 0.045 * st * sw * (P.streak ?? 1);
    ar *= k; ag *= k; ab *= k;
  }
  // grog speckles (dark iron spots + pale sand grains), band-limited
  const spw = bandWeight(0.09, fp);
  const speck = P.speck ?? 0.5;
  if (spw > 0 && speck > 0) {
    const n1 = noise3(x * 4.3 + 11.1, y * 4.3 - seed, z * 4.3);
    const n2 = noise3(x * 6.1 - 3.7, y * 6.1 + seed, z * 6.1 + 5.5);
    const n3 = noise3(x * 2.6 + 5.1, y * 2.6, z * 2.6 - seed);
    const dk = Math.max(smooth(0.52, 0.7, n1), 0.8 * smooth(0.62, 0.78, n3)) * spw * speck;
    const lt = smooth(0.58, 0.76, n2) * spw * speck * (P.light ?? 0.7);
    ar *= 1 - 0.5 * dk; ag *= 1 - 0.55 * dk; ab *= 1 - 0.55 * dk;
    ar += (0.66 - ar) * 0.45 * lt; ag += (0.47 - ag) * 0.45 * lt; ab += (0.32 - ab) * 0.45 * lt;
  } else if (speck > 0) {
    // average darkening of unresolved speckles
    ar *= 1 - 0.012 * speck; ag *= 1 - 0.014 * speck; ab *= 1 - 0.014 * speck;
  }
  // very fine grain
  const gw = bandWeight(0.03, fp);
  if (gw > 0) {
    const g = noise3(x * 19 + seed, y * 19, z * 19) * gw * (P.grain ?? 0.14);
    ar *= 1 + g; ag *= 1 + g; ab *= 1 + g;
  }
  // macro: fine sand grains (pale and dark) and tiny pores, visible only up close
  const mgw = bandWeight(0.022, fp);
  if (mgw > 0 && (P.macro ?? 1) > 0) {
    const g1 = noise3(x * 38 + 3.3, y * 38, z * 38 - seed);
    const g2 = noise3(x * 52 - 7.1, y * 52 + seed, z * 52);
    const pale = smooth(0.5, 0.66, g1) * mgw * (P.macro ?? 1);
    const dark = smooth(0.55, 0.7, g2) * mgw * (P.macro ?? 1);
    ar += (0.72 - ar) * 0.35 * pale; ag += (0.55 - ag) * 0.35 * pale; ab += (0.4 - ab) * 0.35 * pale;
    ar *= 1 - 0.35 * dark; ag *= 1 - 0.4 * dark; ab *= 1 - 0.4 * dark;
  }
  // smoke / soot clouds near the bottom (cooking pots, smoked clay)
  if (P.soot) {
    const sy = P.sootY ?? 6;
    const nb = noise3(x * 0.16 + seed, y * 0.2, z * 0.16) * 0.5 + noise3(x * 0.5, y * 0.5 - seed, z * 0.5) * 0.25;
    const s = clamp01((sy - y) / sy * 1.2 + nb * 1.2) * P.soot;
    ar *= 1 - 0.75 * s; ag *= 1 - 0.78 * s; ab *= 1 - 0.75 * s;
  }
  // efflorescence: faint pale bloom in places (water pots)
  if (P.bloom) {
    const b = smooth(0.25, 0.75, noise3(x * 0.3 - seed, y * 0.45, z * 0.3 + 1.7)) * P.bloom * clamp01((P.bloomY ?? 10) - y) / Math.max(1, (P.bloomY ?? 10));
    ar += (0.62 - ar) * b * 0.35; ag += (0.5 - ag) * b * 0.35; ab += (0.4 - ab) * b * 0.35;
  }
  // ---------------------------------------------------------------- normal
  // throwing lines: ridges running around the pot, slightly spiralled and irregular
  const thr = (P.throwAmp ?? 0.03) * (region ? region.throwMul ?? 1 : 1);
  if (thr > 0 && H.seg >= 0) {
    const s = H.s;
    const th = Math.atan2(H.sn, H.cs);
    let dh = 0;
    const freqs = P.throwFreq ?? [1.25, 2.6, 5.3];
    for (let i = 0; i < freqs.length; i++) {
      const f = freqs[i];
      const w = bandWeight(0.5 / f, fp);
      if (w <= 0) continue;
      const ph = TAU * f * s + i * 2.1 + seed + 0.35 * Math.sin(th + i * 1.3 + seed) * f;
      // irregular amplitude envelope along s (lines come and go)
      const env = 0.35 + 0.65 * clamp01(0.5 + 0.9 * noise3(s * 0.55 + i * 3.3, seed * 0.1 + i, H.cs * 0.6 + H.sn * 0.4));
      dh += w * env * (Math.cos(ph) + 0.45 * Math.cos(2 * ph + 0.6)) / (1 + i * 0.45);
    }
    const envY = P.throwEnv ? P.throwEnv(y, H) : 1;
    bumpTangent(M, H, dh * thr * envY, 0);
  }
  // paddle-beaten lower body: soft dimples
  if (P.beaten) {
    const bw = bandWeight(1.2, fp);
    if (bw > 0) {
      noised(x * 0.75 + seed, y * 0.75, z * 0.75);
      const mask = clamp01(((P.beatenY ?? 12) - y) / 4);
      const k = P.beaten * mask * bw * 0.75;
      const [gx, gz] = lw(H, ND[0], ND[2]);
      bumpWorld(M, gx, ND[1], gz, k);
    }
  }
  // micro surface (clay grain relief)
  const mw = bandWeight(0.12, fp);
  if (mw > 0) {
    noised(x * 4.2 - seed, y * 4.2, z * 4.2 + 7.7);
    const k = (P.micro ?? 0.02) * mw;
    const [gx, gz] = lw(H, ND[0], ND[2]);
    bumpWorld(M, gx, ND[1], gz, k);
  }
  // pores: tiny pits catching shadow (close-ups only)
  const pw = bandWeight(0.03, fp);
  if (pw > 0 && (P.macro ?? 1) > 0) {
    const pv = noised(x * 26 - 1.7, y * 26 + seed, z * 26);
    if (pv > 0.45) {
      const k = -0.12 * pw * smooth(0.45, 0.7, pv);
      const [gx, gz] = lw(H, ND[0], ND[2]);
      bumpWorld(M, gx, ND[1], gz, k * 0.15);
      ar *= 1 - 0.25 * pw * smooth(0.5, 0.75, pv); ag *= 1 - 0.28 * pw * smooth(0.5, 0.75, pv); ab *= 1 - 0.28 * pw * smooth(0.5, 0.75, pv);
    }
  }
  const mw2 = bandWeight(0.035, fp);
  if (mw2 > 0) {
    noised(x * 14 + seed, y * 14 - 3.3, z * 14);
    const k = (P.micro2 ?? 0.035) * mw2;
    const [gx, gz] = lw(H, ND[0], ND[2]);
    bumpWorld(M, gx, ND[1], gz, k);
  }
  // ---------------------------------------------------------------- spec
  let rough = P.rough ?? 0.62;
  let spec = P.spec ?? 0.028;
  if (P.burnish) {
    // burnishing stone leaves glossy, slightly streaky bands
    const bn = noise3(H.cs * r * 0.9 + seed, y * 1.6, H.sn * r * 0.9);
    const bnd = noise3(H.cs * r * 0.12, y * 0.25 + seed, H.sn * r * 0.12);
    rough = rough - P.burnish * (0.12 + 0.08 * bn + 0.1 * bnd);
  }
  rough += (P.roughVar ?? 0.05) * m2;
  // ---------------------------------------------------------------- paint
  let paintCov = 0;
  if (deco && deco.length && H.seg >= 0) {
    const th = Math.atan2(H.sn, H.cs);
    const fw = Math.max(fp, 0.002);
    evalPaint(deco, th, H.cs, H.sn, H.s, fw, false);
    paintCov = PAINT[3];
    if (paintCov > 0 && P.etch) {
      // incised line: matte, unburnished groove
      const ec = P.etchCol ?? [0.075, 0.066, 0.06];
      const c = paintCov;
      ar = ar + (ec[0] - ar) * c; ag = ag + (ec[1] - ag) * c; ab = ab + (ec[2] - ab) * c;
      rough = rough + (0.85 - rough) * c;
      spec = spec + (0.02 - spec) * c;
      if (fp < 0.05 && r > 0.5) {
        const dl = Math.max(fw * 1.2, 0.004);
        const dth = dl / r;
        const hu = paintHeight(deco, th + dth, Math.cos(th + dth), Math.sin(th + dth), H.s, fw) - paintHeight(deco, th - dth, Math.cos(th - dth), Math.sin(th - dth), H.s, fw);
        const hv = paintHeight(deco, th, H.cs, H.sn, H.s + dl, fw) - paintHeight(deco, th, H.cs, H.sn, H.s - dl, fw);
        const k = -(P.etchDepth ?? 0.012) / (2 * dl) * clamp01((0.05 - fp) / 0.025);
        bumpTangent(M, H, hv * k, hu * k);
      }
      paintCov = 0;
    } else if (paintCov > 0) {
      // the clay shows through thin paint; paint picks up a little clay colour
      const pr = PAINT[0], pg = PAINT[1], pb = PAINT[2];
      const pv = 1 + 0.05 * m2;
      ar = ar + (pr * pv - ar) * paintCov;
      ag = ag + (pg * pv - ag) * paintCov;
      ab = ab + (pb * pv - ab) * paintCov;
      rough = rough + ((P.paintRough ?? 0.78) - rough) * paintCov;
      spec = spec + (0.022 - spec) * paintCov;
      // paint relief
      if (fp < 0.06 && r > 0.5) {
        const dl = Math.max(fw * 1.2, 0.006);
        const dth = dl / r;
        const hu = paintHeight(deco, th + dth, Math.cos(th + dth), Math.sin(th + dth), H.s, fw) - paintHeight(deco, th - dth, Math.cos(th - dth), Math.sin(th - dth), H.s, fw);
        const hv = paintHeight(deco, th, H.cs, H.sn, H.s + dl, fw) - paintHeight(deco, th, H.cs, H.sn, H.s - dl, fw);
        const k = (P.paintThick ?? 0.006) / (2 * dl) * clamp01((0.06 - fp) / 0.03);
        bumpTangent(M, H, hv * k, hu * k);
      }
    }
  }
  normalizeN(M);
  M.ar = ar; M.ag = ag; M.ab = ab;
  M.rough = rough < 0.08 ? 0.08 : rough > 0.95 ? 0.95 : rough;
  M.spec = spec;
  M.on = P.on ?? 0.38;
  M.wrap = P.wrap ?? 0.3;
  const sss = P.sss ?? [0.9, 0.42, 0.25];
  const sa = (P.sssAmt ?? 0.32) * (1 - paintCov * 0.5);
  M.sr = ar * sss[0] * sa * 2; M.sg = ag * sss[1] * sa * 2; M.sb = ab * sss[2] * sa * 2;
  M.sheen = P.sheen ?? 0.0;
}

/** Fine etched / incised line bands for burnished black clay: grooves. */
export function etchGrooves(H, M, bands, fp) {
  // bands: [{ s, w, depth }] in surface cm; returns groove mask 0..1
  let mask = 0, slope = 0;
  const s = H.s;
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    const d = s - b.s;
    if (Math.abs(d) > b.w * 2) continue;
    // smooth V/U groove profile: h = -depth * bump(d / w)
    const q = d / (b.w * 0.5);
    const aw = Math.max(fp * 1.5 / (b.w * 0.5), 1e-3);
    const qa = Math.abs(q);
    const m = qa < 1 ? (1 - qa * qa) : 0;
    const mAA = clamp01((1 - qa) / aw + 0.5);
    mask = Math.max(mask, mAA * (b.mask ?? 1));
    if (qa < 1) slope += -b.depth * (-2 * q) / (b.w * 0.5) * (fp < b.w ? 1 : 0.3);
  }
  return [mask, slope];
}

/** Metallic brass with soft patina. */
export function shadeBrass(H, M, P) {
  const x = H.lx, y = H.ly, z = H.lz, fp = H.fpg;
  const n = noise3(x * 1.3 + 3.3, y * 1.3, z * 1.3);
  const n2 = noise3(x * 6.1, y * 6.1 - 2.2, z * 6.1) * bandWeight(0.1, fp);
  const pat = clamp01(0.5 + 0.8 * n) * (P.patina ?? 0.35);
  const base = P.base ?? [0.8, 0.56, 0.27];
  M.metal = 1;
  M.ar = base[0] * (1 - 0.35 * pat); M.ag = base[1] * (1 - 0.42 * pat); M.ab = base[2] * (1 - 0.5 * pat);
  M.rough = (P.rough ?? 0.24) + 0.12 * pat + 0.04 * n2;
  const mw = bandWeight(0.05, fp);
  if (mw > 0) {
    noised(x * 9 + 1.1, y * 9, z * 9);
    const [gx, gz] = lw(H, ND[0], ND[2]);
    bumpWorld(M, gx, ND[1], gz, 0.012 * mw);
    normalizeN(M);
  }
}

/** Glazed stoneware: speckled satin glaze over a pale body. */
export function shadeGlaze(H, M, P) {
  const x = H.lx, y = H.ly, z = H.lz, fp = H.fpg;
  let [ar, ag, ab] = P.base;
  const m = fbm3(x, y, z, 0.12, 3, fp);
  const pool = noise3(x * 0.4, y * 0.9, z * 0.4);
  const k = 1 + 0.08 * m + 0.05 * pool;
  ar *= k; ag *= k; ab *= k;
  // breaking glaze: browner where the glaze runs thin (edges / ridges)
  if (P.breakY !== undefined) {
    const t = clamp01((y - P.breakY) / 0.6);
    ar += ((P.edge ?? [0.3, 0.17, 0.09])[0] - ar) * t * 0.6;
    ag += ((P.edge ?? [0.3, 0.17, 0.09])[1] - ag) * t * 0.6;
    ab += ((P.edge ?? [0.3, 0.17, 0.09])[2] - ab) * t * 0.6;
  }
  const spw = bandWeight(0.06, fp);
  if (spw > 0) {
    const n1 = noise3(x * 7.7 + 1.3, y * 7.7, z * 7.7 - 4.1);
    const dk = smooth(0.52, 0.68, n1) * spw;
    ar *= 1 - 0.7 * dk; ag *= 1 - 0.75 * dk; ab *= 1 - 0.78 * dk;
  }
  M.ar = ar; M.ag = ag; M.ab = ab;
  M.rough = P.rough ?? 0.45;
  M.spec = 0.035;
  M.clearcoat = P.coat ?? 0.55;
  M.ccRough = P.coatRough ?? 0.16;
  M.on = 0.15; M.wrap = 0.05;
  const mw = bandWeight(0.3, fp);
  if (mw > 0) {
    noised(x * 1.4, y * 1.4, z * 1.4);
    const [gx, gz] = lw(H, ND[0], ND[2]);
    bumpWorld(M, gx, ND[1], gz, 0.02 * mw);
    normalizeN(M);
  }
}

export function shadeSimple(H, M, P) {
  const x = H.lx, y = H.ly, z = H.lz, fp = H.fpg;
  const n = P.var ? noise3(x * P.varF + 1.7, y * P.varF, z * P.varF) * P.var : 0;
  M.ar = P.base[0] * (1 + n); M.ag = P.base[1] * (1 + n); M.ab = P.base[2] * (1 + n);
  M.rough = P.rough ?? 0.6; M.spec = P.spec ?? 0.03; M.on = P.on ?? 0.2; M.wrap = P.wrap ?? 0;
  if (P.sss) { M.sr = P.sss[0]; M.sg = P.sss[1]; M.sb = P.sss[2]; }
  if (P.coat) { M.clearcoat = P.coat; M.ccRough = P.coatRough ?? 0.08; }
  if (P.emit) { M.er = P.emit[0]; M.eg = P.emit[1]; M.eb = P.emit[2]; }
  if (P.bump) {
    const mw = bandWeight(1 / P.bumpF, fp);
    if (mw > 0) {
      noised(x * P.bumpF, y * P.bumpF * (P.bumpYS ?? 1), z * P.bumpF);
      const [gx, gz] = lw(H, ND[0], ND[2]);
      bumpWorld(M, gx, ND[1], gz, P.bump * mw);
      normalizeN(M);
    }
  }
}

export function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
export function smooth(a, b, v) { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); }
export { hash2f };
