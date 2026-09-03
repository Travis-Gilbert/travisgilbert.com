import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * The portfolio tests read the committed fixture and the committed evidence
 * files, so they run in Node with the repo root as the working directory rather
 * than in a DOM environment. `loadFieldSnapshot` resolves the fixture from
 * `process.cwd()`, which is what `root` fixes here.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    root: import.meta.dirname,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
