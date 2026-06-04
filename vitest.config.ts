import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    include: ['src/**/*.{spec,test}.{ts,tsx}'],
    testTimeout: 30000,
  },
});
