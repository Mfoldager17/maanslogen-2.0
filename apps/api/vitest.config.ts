import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * swc i stedet for esbuild: Nests dekoratører har brug for `emitDecoratorMetadata`,
 * som esbuild ikke understøtter.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    root: './',
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
