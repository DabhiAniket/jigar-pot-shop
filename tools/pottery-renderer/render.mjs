#!/usr/bin/env node
// Jigar Matka House — procedural pottery renderer (zero dependencies).
//
//   node tools/pottery-renderer/render.mjs --out <dir> [--only products,hero,...]
//        [--quality draft|preview|final] [--filter <substring>] [--threads N] [--list]
//
// Renders deterministic studio "product photos" of terracotta pottery by SDF
// ray marching surfaces of revolution, split across worker threads.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { encodePNG } from './lib/png.mjs';
import { finishImage } from './lib/post.mjs';
import { QUALITY } from './lib/scene.mjs';
import { allJobs, GROUPS } from './lib/jobs.mjs';
import { srgb } from './lib/materials.mjs';
import { srgbEncode } from './lib/renderer.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const a = { out: 'renders', quality: 'final', only: null, filter: null, threads: os.availableParallelism?.() ?? os.cpus().length, list: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--out') a.out = v();
    else if (k === '--quality') a.quality = v();
    else if (k === '--only') a.only = v().split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === '--filter') a.filter = v();
    else if (k === '--threads') a.threads = Math.max(1, parseInt(v(), 10));
    else if (k === '--list') a.list = true;
    else if (k === '--help' || k === '-h') a.help = true;
    else throw new Error(`unknown argument ${k}`);
  }
  return a;
}

const HELP = `Usage: node render.mjs --out <dir> [options]
  --out <dir>          output root (default ./renders)
  --only <groups>      comma list of: ${GROUPS.join(', ')}
  --filter <text>      only jobs whose output path contains <text>
  --quality <q>        draft (0.3x, 1spp) | preview (0.5x, 4spp) | final (default)
  --threads <n>        worker threads (default: all cores)
  --list               print the job list and exit`;

class Pool {
  constructor(n) {
    this.workers = Array.from({ length: n }, () => new Worker(path.join(here, 'lib', 'worker.mjs')));
  }
  render(spec, quality, W, H) {
    const buf = new SharedArrayBuffer(W * H * 8 * 4);
    const ctr = new SharedArrayBuffer(4);
    const rowsPer = Math.max(1, Math.min(8, Math.floor(H / (this.workers.length * 6)) || 1));
    return new Promise((resolve, reject) => {
      let left = this.workers.length;
      for (const w of this.workers) {
        const onMsg = (m) => {
          w.off('message', onMsg);
          if (m.type === 'error') reject(new Error(m.error));
          else if (--left === 0) resolve(new Float32Array(buf));
        };
        w.on('message', onMsg);
        w.postMessage({ type: 'render', spec, quality, buf, ctr, rowsPer });
      }
    });
  }
  close() { for (const w of this.workers) w.terminate(); }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); return; }
  if (!QUALITY[args.quality]) throw new Error(`unknown quality ${args.quality}`);
  let jobs = allJobs();
  if (args.only) {
    for (const g of args.only) if (!GROUPS.includes(g)) throw new Error(`unknown group ${g} (have ${GROUPS.join(', ')})`);
    jobs = jobs.filter((j) => args.only.includes(j.group));
  }
  if (args.filter) jobs = jobs.filter((j) => j.file.includes(args.filter));
  if (args.list) { for (const j of jobs) console.log(`${j.group.padEnd(11)} ${j.file}  ${j.spec.width}x${j.spec.height}${j.alpha ? ' RGBA' : ''}`); return; }
  if (!jobs.length) { console.log('no jobs selected'); return; }
  const outRoot = path.resolve(args.out);
  fs.mkdirSync(outRoot, { recursive: true });
  const Q = QUALITY[args.quality];
  const pool = new Pool(args.threads);
  const creamBytes = srgb('#F6F0E5').map((c) => Math.round(srgbEncode(c) * 255));
  const manifestPath = path.join(outRoot, 'manifest.json');
  let manifest = { generator: 'tools/pottery-renderer', note: 'Illustrative procedural renders; replace with real product photography.', files: [] };
  if (fs.existsSync(manifestPath)) {
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { /* start fresh */ }
  }
  const byFile = new Map(manifest.files.map((f) => [f.file, f]));
  const t0 = Date.now();
  let totalBytes = 0;
  let pending = null;
  const finalize = ({ job, buf, W, H, ms }) => {
    const tp = Date.now();
    const img = finishImage(buf, W, H, { alpha: job.alpha, post: job.spec.post, creamBytes, seed: job.seed ?? 1 });
    const png = encodePNG(W, H, img.channels, img.data);
    const file = path.join(outRoot, job.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, png);
    totalBytes += png.length;
    byFile.set(job.file, { file: job.file, width: W, height: H, hasAlpha: !!job.alpha, description: job.desc });
    console.log(`  ✓ ${job.file.padEnd(48)} ${W}x${H}  render ${(ms / 1000).toFixed(1)}s  post ${((Date.now() - tp) / 1000).toFixed(1)}s  ${(png.length / 1e6).toFixed(2)} MB`);
  };
  console.log(`Rendering ${jobs.length} image(s) at quality=${args.quality} with ${args.threads} threads → ${outRoot}`);
  for (const job of jobs) {
    const W = Math.max(8, Math.round(job.spec.width * (job.spec.resScale ?? Q.scale)));
    const H = Math.max(8, Math.round(job.spec.height * (job.spec.resScale ?? Q.scale)));
    const ts = Date.now();
    const p = pool.render(job.spec, args.quality, W, H).then((buf) => ({ job, buf, W, H, ms: Date.now() - ts }));
    if (pending) finalize(pending);
    pending = await p;
  }
  if (pending) finalize(pending);
  pool.close();
  manifest.files = [...byFile.values()].sort((a, b) => a.file.localeCompare(b.file));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Done: ${jobs.length} image(s), ${(totalBytes / 1e6).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s. Manifest: ${manifestPath}`);
}

main().catch((e) => { console.error(e.stack || e); process.exit(1); });
