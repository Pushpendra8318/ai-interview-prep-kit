import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: undefined,
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
