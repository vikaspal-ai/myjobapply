import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 20000, // 20s timeout for live cloud database roundtrips
    hookTimeout: 20000,
    fileParallelism: false, // Run database test files sequentially to avoid pooler contention
    globalSetup: ['./src/test/global-teardown.ts'], // Purge synthetic fixtures after the suite finishes
  },
});
