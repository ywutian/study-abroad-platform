import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // `page.tsx` / `layout.tsx` are NOT excluded on purpose. In the App Router
      // they are where route-level logic lives (data fetching, auth gating,
      // param parsing), so excluding them hid the single largest body of
      // untested code in the repo — 826 source files with the routes invisible
      // to the floor below. Only the structurally-mandated stubs stay out:
      // `loading.tsx` is required to exist by the `no-missing-loading` quality
      // rule and is a Skeleton, `error.tsx` / `not-found.tsx` likewise.
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/types/**',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
        'src/app/**/not-found.tsx',
      ],
      // Measured 2026-08-02 with routes included: 10.24 / 9.54 / 7.43 / 10.41.
      // branches and functions READ LOWER than the old 10/10 not because coverage
      // regressed but because the denominator got honest — un-excluding the App
      // Router added ~4.5k statements that were always untested and always
      // invisible. The old numbers were never enforced anyway (CI ran plain
      // `vitest run`), and the real functions figure was already 8.92% under the
      // narrower denominator. Raise these as routes gain tests; never re-add the
      // page.tsx exclusion to make the number look better.
      thresholds: {
        statements: 10,
        branches: 9,
        functions: 7,
        lines: 10,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
