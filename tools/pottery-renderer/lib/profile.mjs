// 2D cross-section profiles in the (r, y) half-plane, revolved about the y axis.
//
// PathBuilder authors a profile from straight lines, centripetal Catmull-Rom
// splines and circular arcs, with optional rounded corners. The path must start
// and end on the axis (r = 0) and run counter-clockwise (outward along the
// bottom, up the outside, back toward the axis on top / inside), so that the
// solid lies to the left of travel.
//
// Profile turns the polyline into an exact signed distance function: a uniform
// grid stores, per cell near the curve, the short list of segments that can be
// nearest; far cells use bilinear interpolation of exact corner distances.
// Shading normals are interpolated per vertex (Phong-style) so the polyline
// never shows facets.

const DENSE = 0.008; // cm, dense sampling step before adaptive resampling

export class PathBuilder {
  constructor(r = 0, y = 0) {
    this.pts = [[r, y]];
    this.rounds = [];
  }
  get last() { return this.pts[this.pts.length - 1]; }
  _push(r, y) {
    const [r0, y0] = this.last;
    if (Math.abs(r - r0) + Math.abs(y - y0) > 1e-9) this.pts.push([r, y]);
  }
  line(r, y) {
    const [r0, y0] = this.last;
    const L = Math.hypot(r - r0, y - y0);
    const k = Math.max(1, Math.ceil(L / DENSE));
    for (let i = 1; i <= k; i++) this._push(r0 + (r - r0) * i / k, y0 + (y - y0) * i / k);
    return this;
  }
  /** Centripetal Catmull-Rom from the current point through `points`.
   *  startDir/endDir: optional tangent directions [dr, dy] at the ends. */
  spline(points, { startDir, endDir } = {}) {
    const P = [this.last, ...points];
    const n = P.length;
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
    const len = (v) => Math.hypot(v[0], v[1]);
    let first, lastP;
    if (startDir) {
      const l = len(sub(P[1], P[0])), d = len(startDir);
      first = [P[0][0] - startDir[0] / d * l, P[0][1] - startDir[1] / d * l];
    } else first = [2 * P[0][0] - P[1][0], 2 * P[0][1] - P[1][1]];
    if (endDir) {
      const l = len(sub(P[n - 1], P[n - 2])), d = len(endDir);
      lastP = [P[n - 1][0] + endDir[0] / d * l, P[n - 1][1] + endDir[1] / d * l];
    } else lastP = [2 * P[n - 1][0] - P[n - 2][0], 2 * P[n - 1][1] - P[n - 2][1]];
    const Q = [first, ...P, lastP];
    for (let i = 1; i < Q.length - 2; i++) {
      const p0 = Q[i - 1], p1 = Q[i], p2 = Q[i + 1], p3 = Q[i + 2];
      const t0 = 0;
      const t1 = t0 + Math.pow(Math.max(len(sub(p1, p0)), 1e-6), 0.5);
      const t2 = t1 + Math.pow(Math.max(len(sub(p2, p1)), 1e-6), 0.5);
      const t3 = t2 + Math.pow(Math.max(len(sub(p3, p2)), 1e-6), 0.5);
      const L = len(sub(p2, p1));
      const k = Math.max(2, Math.ceil(L / DENSE * 1.3));
      for (let j = 1; j <= k; j++) {
        const t = t1 + (t2 - t1) * j / k;
        const lerp = (a, b, ta, tb) => {
          const w = (t - ta) / (tb - ta);
          return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
        };
        const A1 = lerp(p0, p1, t0, t1), A2 = lerp(p1, p2, t1, t2), A3 = lerp(p2, p3, t2, t3);
        const B1 = lerp(A1, A2, t0, t2), B2 = lerp(A2, A3, t1, t3);
        const C = lerp(B1, B2, t1, t2);
        this._push(C[0], C[1]);
      }
    }
    return this;
  }
  /** Circular arc around (cr, cy) from the current point's angle to angle a1 (degrees). ccw if a1 > a0. */
  arc(cr, cy, a1deg) {
    const [r0, y0] = this.last;
    const rad = Math.hypot(r0 - cr, y0 - cy);
    const a0 = Math.atan2(y0 - cy, r0 - cr);
    let a1 = a1deg * Math.PI / 180;
    const k = Math.max(2, Math.ceil(Math.abs(a1 - a0) * rad / DENSE));
    for (let i = 1; i <= k; i++) {
      const a = a0 + (a1 - a0) * i / k;
      this._push(cr + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    return this;
  }
  /** Cubic Bezier from current point. */
  cubic(c1r, c1y, c2r, c2y, r, y) {
    const [r0, y0] = this.last;
    const L = Math.hypot(c1r - r0, c1y - y0) + Math.hypot(c2r - c1r, c2y - c1y) + Math.hypot(r - c2r, y - c2y);
    const k = Math.max(4, Math.ceil(L / DENSE));
    for (let i = 1; i <= k; i++) {
      const t = i / k, u = 1 - t;
      this._push(u * u * u * r0 + 3 * u * u * t * c1r + 3 * u * t * t * c2r + t * t * t * r,
        u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y);
    }
    return this;
  }
  /** Round the corner at the current last point (trim distance ~ radius). */
  round(rad) {
    this.rounds.push({ idx: this.pts.length - 1, rad });
    return this;
  }
  /** Append a list of dense points (already sampled). */
  append(points) {
    for (const p of points) this._push(p[0], p[1]);
    return this;
  }
  build() {
    let pts = this.pts.map((p) => [p[0], p[1]]);
    const rounds = [...this.rounds].sort((a, b) => b.idx - a.idx);
    for (const { idx, rad } of rounds) pts = roundCorner(pts, idx, rad);
    return pts;
  }
}

function roundCorner(pts, idx, rad) {
  // walk back/forward by `rad` arc length and replace with a quadratic Bezier
  const C = pts[idx];
  let acc = 0, i = idx, A = null, ia = 0;
  while (i > 0) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + l >= rad) {
      const w = (rad - acc) / l;
      A = [pts[i][0] + (pts[i - 1][0] - pts[i][0]) * w, pts[i][1] + (pts[i - 1][1] - pts[i][1]) * w];
      ia = i - 1; break;
    }
    acc += l; i--;
  }
  acc = 0; i = idx; let B = null, ib = 0;
  while (i < pts.length - 1) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    if (acc + l >= rad) {
      const w = (rad - acc) / l;
      B = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * w, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * w];
      ib = i + 1; break;
    }
    acc += l; i++;
  }
  if (!A || !B) return pts;
  const curve = [];
  const k = Math.max(8, Math.ceil(rad * 2 / DENSE));
  for (let j = 0; j <= k; j++) {
    const t = j / k, u = 1 - t;
    curve.push([u * u * A[0] + 2 * u * t * C[0] + t * t * B[0], u * u * A[1] + 2 * u * t * C[1] + t * t * B[1]]);
  }
  return [...pts.slice(0, ia + 1), ...curve, ...pts.slice(ib)];
}

/** Offset a dense open polyline by distance d to its left (+) or right (-), per-point thickness fn. */
export function offsetPolyline(pts, thick) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    // left normal of travel direction = (-ty, tx)
    const t = typeof thick === 'function' ? thick(pts[i], i / (n - 1)) : thick;
    out.push([pts[i][0] - ty * t, pts[i][1] + tx * t]);
  }
  // drop near-duplicate points
  const clean = [out[0]];
  for (let i = 1; i < out.length; i++) {
    const p = out[i], q = clean[clean.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) > DENSE * 0.25) clean.push(p);
  }
  return removeLoops(clean);
}

function segIntersect(p, p2, q, q2) {
  const rx = p2[0] - p[0], ry = p2[1] - p[1], sx = q2[0] - q[0], sy = q2[1] - q[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-14) return null;
  const qpx = q[0] - p[0], qpy = q[1] - p[1];
  const t = (qpx * sy - qpy * sx) / den, u = (qpx * ry - qpy * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [p[0] + rx * t, p[1] + ry * t];
}
/** Remove small self-intersection loops from a dense polyline (offset curves at concave corners). */
export function removeLoops(pts, window = 600) {
  const out = [];
  let i = 0;
  while (i < pts.length - 1) {
    out.push(pts[i]);
    let jumped = false;
    for (let j = Math.min(pts.length - 2, i + window); j > i + 1; j--) {
      const x = segIntersect(pts[i], pts[i + 1], pts[j], pts[j + 1]);
      if (x) { out.push(x); i = j + 1; jumped = true; break; }
    }
    if (!jumped) i++;
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Sample a closed-form spline helper: returns dense points of a Catmull-Rom through pts. */
export function denseSpline(points, opts) {
  const b = new PathBuilder(points[0][0], points[0][1]);
  b.spline(points.slice(1), opts);
  return b.pts;
}

/** Adaptive resampling: keep a vertex when accumulated turning exceeds maxTurn
 *  (radians) or segment length would exceed maxLen. */
function resample(pts, maxTurn, maxLen, minLen) {
  const out = [pts[0]];
  let acc = 0, len = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], p = pts[i], q = pts[i + 1];
    const d1x = p[0] - pts[i - 1][0], d1y = p[1] - pts[i - 1][1];
    const d2x = q[0] - p[0], d2y = q[1] - p[1];
    const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
    if (l1 > 1e-12 && l2 > 1e-12) {
      const cr = (d1x * d2y - d1y * d2x) / (l1 * l2), dt = (d1x * d2x + d1y * d2y) / (l1 * l2);
      acc += Math.abs(Math.atan2(cr, dt));
    }
    len = Math.hypot(p[0] - a[0], p[1] - a[1]);
    if ((acc >= maxTurn && len >= minLen) || len >= maxLen) {
      out.push(p); acc = 0;
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export class Profile {
  /**
   * @param {number[][]} densePts dense polyline from axis to axis (CCW)
   * @param {{cell?:number, margin?:number, maxTurnDeg?:number, maxLen?:number}} opts
   */
  constructor(densePts, opts = {}) {
    let ymin = Infinity, ymax = -Infinity, rmax = 0;
    for (const [r, y] of densePts) { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); rmax = Math.max(rmax, r); }
    const size = Math.max(ymax - ymin, rmax);
    const cell = opts.cell ?? Math.min(0.16, Math.max(0.03, size / 260));
    const maxLen = opts.maxLen ?? cell * 1.2;
    const pts = resample(densePts, (opts.maxTurnDeg ?? 3.0) * Math.PI / 180, maxLen, cell * 0.04);
    pts[0] = [0, pts[0][1]];
    pts[pts.length - 1] = [0, pts[pts.length - 1][1]];
    const n = pts.length, m = n - 1;
    this.n = n;
    this.ymin = ymin; this.ymax = ymax; this.rmax = rmax;
    const px = this.px = new Float64Array(n), py = this.py = new Float64Array(n);
    for (let i = 0; i < n; i++) { px[i] = pts[i][0]; py[i] = pts[i][1]; }
    const dx = this.dx = new Float64Array(m), dy = this.dy = new Float64Array(m);
    const il2 = this.il2 = new Float64Array(m), len = this.len = new Float64Array(m);
    const snx = this.snx = new Float64Array(m), sny = this.sny = new Float64Array(m);
    const S = this.S = new Float64Array(n);
    for (let i = 0; i < m; i++) {
      dx[i] = px[i + 1] - px[i]; dy[i] = py[i + 1] - py[i];
      const l2 = dx[i] * dx[i] + dy[i] * dy[i];
      len[i] = Math.sqrt(l2);
      il2[i] = l2 > 0 ? 1 / l2 : 0;
      const l = len[i] || 1;
      snx[i] = dy[i] / l; sny[i] = -dx[i] / l; // outward normal (solid on the left)
      S[i + 1] = S[i] + len[i];
    }
    this.totalS = S[n - 1];
    const vnx = this.vnx = new Float64Array(n), vny = this.vny = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let x = 0, y = 0;
      if (i > 0) { x += snx[i - 1]; y += sny[i - 1]; }
      if (i < m) { x += snx[i]; y += sny[i]; }
      const l = Math.hypot(x, y) || 1;
      vnx[i] = x / l; vny[i] = y / l;
    }
    // ---------------- two-level grid
    const F = 8;
    const M = opts.margin ?? Math.max(6, size * 0.55);
    this.margin = M;
    const CS = cell * F, icsC = 1 / CS;
    const y0 = ymin - M;
    const cgw = Math.ceil((rmax + M) / CS), cgh = Math.ceil((ymax - ymin + 2 * M) / CS);
    const r1 = cgw * CS, y1 = y0 + cgh * CS;
    this.cell = cell; this.y0 = y0; this.r1 = r1; this.y1 = y1;
    const all = new Int32Array(m); for (let i = 0; i < m; i++) all[i] = i;
    const ccw = cgw + 1;
    const ccorner = new Float32Array((cgw + 1) * (cgh + 1));
    for (let j = 0; j <= cgh; j++) for (let i = 0; i <= cgw; i++) ccorner[j * ccw + i] = this._exact(i * CS, y0 + j * CS, all);
    const blockIndex = new Int32Array(cgw * cgh).fill(-1);
    const fcorner = [], fstarts = [], cand = [];
    const chd = CS * Math.SQRT1_2, hd = cell * Math.SQRT1_2;
    let nb = 0;
    for (let cj = 0; cj < cgh; cj++) for (let ci = 0; ci < cgw; ci++) {
      const o = cj * ccw + ci;
      const mn = Math.min(Math.abs(ccorner[o]), Math.abs(ccorner[o + 1]), Math.abs(ccorner[o + ccw]), Math.abs(ccorner[o + ccw + 1]));
      if (mn > 3.2 * chd) continue; // far: coarse bilinear
      const clist = this._candidates((ci + 0.5) * CS, y0 + (cj + 0.5) * CS, chd * 1.0001, all);
      blockIndex[cj * cgw + ci] = nb++;
      const fc = new Float32Array((F + 1) * (F + 1));
      for (let j = 0; j <= F; j++) for (let i = 0; i <= F; i++) fc[j * (F + 1) + i] = this._exact(ci * CS + i * cell, y0 + cj * CS + j * cell, clist);
      for (let j = 0; j < F; j++) for (let i = 0; i < F; i++) {
        fstarts.push(cand.length);
        const q = j * (F + 1) + i;
        const fmn = Math.min(Math.abs(fc[q]), Math.abs(fc[q + 1]), Math.abs(fc[q + F + 1]), Math.abs(fc[q + F + 2]));
        if (fmn > 4 * hd) continue; // fine bilinear
        const list = this._candidates(ci * CS + (i + 0.5) * cell, y0 + cj * CS + (j + 0.5) * cell, hd * 1.0001, clist);
        for (const sgi of list) cand.push(sgi);
      }
      fcorner.push(fc);
    }
    fstarts.push(cand.length);
    const FC = new Float32Array(nb * (F + 1) * (F + 1));
    fcorner.forEach((fc, b) => FC.set(fc, b * (F + 1) * (F + 1)));
    const FS = Int32Array.from(fstarts), CA = Int32Array.from(cand);
    this.blockIndex = blockIndex; this.FC = FC; this.FS = FS; this.cand = CA; this.cgw = cgw; this.cgh = cgh; this.CS = CS;
    const vnxA = vnx, vnyA = vny, snxA = snx, snyA = sny;
    const bx1 = rmax, by0 = ymin, by1 = ymax, blendIn = 0.55 * M, blendW = 1 / (0.45 * M);
    const F1 = F + 1, F2 = F * F;
    /** signed distance — closure over typed arrays for speed */
    this.dist = function dist(r, y) {
      // conservative far field: distance to the profile's bounding box
      const ox = r > bx1 ? r - bx1 : 0;
      const oy = y < by0 ? by0 - y : y > by1 ? y - by1 : 0;
      let lb = 0, w = 0;
      if (ox > blendIn || oy > blendIn) {
        lb = Math.sqrt(ox * ox + oy * oy);
        w = (Math.max(ox, oy) - blendIn) * blendW;
        if (w >= 1) return lb;
      }
      const gx = r * icsC, gy = (y - y0) * icsC;
      const ci = gx | 0, cj = gy | 0;
      const b = blockIndex[cj * cgw + ci];
      let d;
      if (b < 0) {
        const fx = gx - ci, fy = gy - cj, o = cj * ccw + ci;
        const a0 = ccorner[o] + (ccorner[o + 1] - ccorner[o]) * fx;
        const a1 = ccorner[o + ccw] + (ccorner[o + ccw + 1] - ccorner[o + ccw]) * fx;
        d = a0 + (a1 - a0) * fy;
      } else {
        const fx = (gx - ci) * F, fy = (gy - cj) * F;
        const fi = fx | 0, fj = fy | 0;
        const k = b * F2 + fj * F + fi;
        const s0 = FS[k], s1 = FS[k + 1];
        if (s0 === s1) {
          const ux = fx - fi, uy = fy - fj, o = b * F1 * F1 + fj * F1 + fi;
          const a0 = FC[o] + (FC[o + 1] - FC[o]) * ux;
          const a1 = FC[o + F1] + (FC[o + F1 + 1] - FC[o + F1]) * ux;
          d = a0 + (a1 - a0) * uy;
        } else {
          let best = Infinity, bi = 0, bt = 0;
          for (let q = s0; q < s1; q++) {
            const i = CA[q];
            const ax = r - px[i], ay = y - py[i];
            let t = (ax * dx[i] + ay * dy[i]) * il2[i];
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const qx = ax - dx[i] * t, qy = ay - dy[i] * t;
            const d2 = qx * qx + qy * qy;
            if (d2 < best) { best = d2; bi = i; bt = t; }
          }
          let nx, ny;
          if (bt <= 0) { nx = vnxA[bi]; ny = vnyA[bi]; } else if (bt >= 1) { nx = vnxA[bi + 1]; ny = vnyA[bi + 1]; } else { nx = snxA[bi]; ny = snyA[bi]; }
          const qx = r - px[bi] - dx[bi] * bt, qy = y - py[bi] - dy[bi] * bt;
          d = Math.sqrt(best);
          if (qx * nx + qy * ny < 0) d = -d;
        }
      }
      return w > 0 ? d + (lb - d) * w : d;
    };
  }

  _segD2(r, y, i) {
    let t = ((r - this.px[i]) * this.dx[i] + (y - this.py[i]) * this.dy[i]) * this.il2[i];
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = r - this.px[i] - this.dx[i] * t, qy = y - this.py[i] - this.dy[i] * t;
    return qx * qx + qy * qy;
  }
  _candidates(r, y, hd, from) {
    let dmin = Infinity;
    const d2s = new Float64Array(from.length);
    for (let k = 0; k < from.length; k++) { const d2 = this._segD2(r, y, from[k]); d2s[k] = d2; if (d2 < dmin) dmin = d2; }
    const lim = Math.sqrt(dmin) + 2 * hd, lim2 = lim * lim;
    const out = [];
    for (let k = 0; k < from.length; k++) if (d2s[k] <= lim2) out.push(from[k]);
    return out;
  }
  _exact(r, y, list) {
    let best = Infinity, bi = 0, bt = 0;
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      let t = ((r - this.px[i]) * this.dx[i] + (y - this.py[i]) * this.dy[i]) * this.il2[i];
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = r - this.px[i] - this.dx[i] * t, qy = y - this.py[i] - this.dy[i] * t;
      const d2 = qx * qx + qy * qy;
      if (d2 < best) { best = d2; bi = i; bt = t; }
    }
    return this._sign(r, y, bi, bt) * Math.sqrt(best);
  }
  _sign(r, y, i, t) {
    let nx, ny;
    if (t <= 0) { nx = this.vnx[i]; ny = this.vny[i]; }
    else if (t >= 1) { nx = this.vnx[i + 1]; ny = this.vny[i + 1]; }
    else { nx = this.snx[i]; ny = this.sny[i]; }
    const qx = r - this.px[i] - this.dx[i] * t, qy = y - this.py[i] - this.dy[i] * t;
    return qx * nx + qy * ny >= 0 ? 1 : -1;
  }

  /** Full info at a (near-surface) point: returns distance, writes out[0]=s, [1]=nr, [2]=ny, [3]=seg */
  info(r, y, out) {
    let s0 = 0, s1 = 0;
    const gx = r / this.CS, gy = (y - this.y0) / this.CS;
    if (gx >= 0 && gy >= 0 && gx < this.cgw && gy < this.cgh) {
      const ci = gx | 0, cj = gy | 0;
      const b = this.blockIndex[cj * this.cgw + ci];
      if (b >= 0) {
        const fi = ((gx - ci) * 8) | 0, fj = ((gy - cj) * 8) | 0;
        const k = b * 64 + fj * 8 + fi;
        s0 = this.FS[k]; s1 = this.FS[k + 1];
      }
    }
    let best = Infinity, bi = 0, bt = 0;
    const scan = (i) => {
      let t = ((r - this.px[i]) * this.dx[i] + (y - this.py[i]) * this.dy[i]) * this.il2[i];
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = r - this.px[i] - this.dx[i] * t, qy = y - this.py[i] - this.dy[i] * t;
      const d2 = qx * qx + qy * qy;
      if (d2 < best) { best = d2; bi = i; bt = t; }
    };
    if (s1 > s0) for (let q = s0; q < s1; q++) scan(this.cand[q]);
    else for (let i = 0; i < this.n - 1; i++) scan(i);
    const sg = this._sign(r, y, bi, bt);
    let nx = this.vnx[bi] + (this.vnx[bi + 1] - this.vnx[bi]) * bt;
    let ny = this.vny[bi] + (this.vny[bi + 1] - this.vny[bi]) * bt;
    const l = Math.hypot(nx, ny) || 1;
    out[0] = this.S[bi] + this.len[bi] * bt;
    out[1] = nx / l; out[2] = ny / l; out[3] = bi;
    return sg * Math.sqrt(best);
  }

  /** Arc length s on the profile where it first crosses height y within [sFrom, sTo]. */
  sAtY(y, sFrom = 0, sTo = Infinity) {
    for (let i = 0; i < this.n - 1; i++) {
      if (this.S[i + 1] < sFrom || this.S[i] > sTo) continue;
      const y0 = this.py[i], y1 = this.py[i + 1];
      if ((y0 - y) * (y1 - y) <= 0 && y0 !== y1) {
        const t = (y - y0) / (y1 - y0);
        return this.S[i] + this.len[i] * t;
      }
    }
    return NaN;
  }
  /** Point on the profile at arc length s → [r, y, nr, ny] */
  atS(s) {
    let i = 0;
    while (i < this.n - 2 && this.S[i + 1] < s) i++;
    const t = Math.min(1, Math.max(0, (s - this.S[i]) / (this.len[i] || 1)));
    return [this.px[i] + this.dx[i] * t, this.py[i] + this.dy[i] * t, this.snx[i], this.sny[i]];
  }
  /** Max radius at height y (outer silhouette) */
  radiusAtY(y) {
    let best = 0;
    for (let i = 0; i < this.n - 1; i++) {
      const y0 = this.py[i], y1 = this.py[i + 1];
      if ((y0 - y) * (y1 - y) <= 0 && y0 !== y1) {
        const t = (y - y0) / (y1 - y0);
        best = Math.max(best, this.px[i] + this.dx[i] * t);
      }
    }
    return best;
  }
}
