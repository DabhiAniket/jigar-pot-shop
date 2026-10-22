import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/helpers/global-setup.ts'],
    setupFiles: ['test/helpers/setup-env.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
