import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Only the live pure-logic surface. The old `src/scoring/ml/**` exclusion
      // said "orphaned dead code, no live importer" — that stopped being true
      // for metrics.ts, whose AUC/Brier feed the prediction shadow and
      // reporting services. The genuinely dead files were deleted 2026-07-24
      // and metrics.ts is now covered like everything else.
      include: ['src/scoring/**/*.ts', 'src/utils/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/**/index.ts', 'src/scoring/types.ts'],
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
