import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * E2E kører mod en rigtig Postgres. Ingen mocks af databasen — det er netop
 * transaktionerne og constraint'erne vi vil have bevist.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    root: './',
    // Delt database: testfilerne kører efter hinanden, ikke parallelt.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
    setupFiles: ['./test/setup.ts'],
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
