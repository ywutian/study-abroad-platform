import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Only the live pure-logic surface. scoring/ml/* is orphaned dead code
      // (post-v5 deletion, no live importer) and is excluded, not tested.
      include: ['src/scoring/**/*.ts', 'src/utils/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/scoring/types.ts',
        'src/scoring/ml/**',
      ],
      // Floor locked into scripts/coverage-thresholds.baseline.json via the
      // coverage ratchet — set below the achieved ~92/84/97/93 with headroom.
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 95,
        lines: 90,
      },
    },
  },
});
