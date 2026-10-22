import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    server: 'src/server.ts',
    worker: 'src/worker.ts',
    vercel: 'src/vercel.ts',
    migrate: 'scripts/migrate.ts',
    'bootstrap-admin': 'scripts/bootstrap-admin.ts',
    'cleanup-media': 'scripts/cleanup-media.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  splitting: true,
  // Workspace package ships TypeScript source, so it is bundled; npm dependencies stay external.
  noExternal: ['@jmh/shared'],
});
