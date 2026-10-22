// Worker thread: builds the scene for a job (models are cached per worker)
// and renders row blocks pulled from a shared atomic counter.
import { parentPort } from 'node:worker_threads';
import { buildScene } from './scene.mjs';
import { setScene, renderRows } from './renderer.mjs';

parentPort.on('message', (msg) => {
  if (msg.type !== 'render') return;
  try {
    const scene = buildScene(msg.spec, msg.quality);
    setScene(scene);
    const out = new Float32Array(msg.buf);
    const ctr = new Int32Array(msg.ctr);
    const rows = msg.rowsPer;
    for (;;) {
      const blk = Atomics.add(ctr, 0, 1);
      const y0 = blk * rows;
      if (y0 >= scene.H) break;
      renderRows(y0, Math.min(scene.H, y0 + rows), out);
    }
    parentPort.postMessage({ type: 'done' });
  } catch (e) {
    parentPort.postMessage({ type: 'error', error: String(e && e.stack || e) });
  }
});
