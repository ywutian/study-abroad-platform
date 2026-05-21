#!/usr/bin/env tsx
/**
 * Phase 2 V1 PR3 — Day-7 decision gate (CLI wrapper).
 *
 * Reads every EssayDebateEvaluation row from Postgres and runs the
 * decision gate against three thresholds from the original 7-day plan:
 *
 *   1. Fleiss κ across ≥3 evaluators ≥ 0.5
 *   2. Lumni-only evidence integrity rate ≥ 70%
 *   3. Lumni SHARP+USEFUL share ≥ ChatGPT control SHARP+USEFUL share
 *
 * All math lives in `src/modules/essay-debate/debate-eval-gate.util.ts`
 * and is exercised by `debate-eval-gate.util.spec.ts`. This file is a
 * thin Prisma loader + CLI wrapper so we can run the gate from the
 * command line (and from CI/pre-merge wiring later).
 *
 * Exit codes:
 *   0 — pass (admin may flip `essay_debate_enabled` to 10% canary)
 *   1 — fail (do NOT enable the feature flag)
 *   2 — fatal error (DB unreachable, prisma client out of sync, etc.)
 *
 * Usage:
 *   pnpm --filter api exec tsx scripts/debate-eval-gate.ts
 *   pnpm --filter api exec tsx scripts/debate-eval-gate.ts --kappa-threshold 0.4
 *   pnpm --filter api exec tsx scripts/debate-eval-gate.ts --json
 */
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_EVIDENCE_RATE_THRESHOLD,
  DEFAULT_KAPPA_THRESHOLD,
  EvaluationRow,
  formatVerdict,
  runGate,
} from '../src/modules/essay-debate/debate-eval-gate.util';

async function loadFromDb(): Promise<EvaluationRow[]> {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.essayDebateEvaluation.findMany({
      select: {
        sessionId: true,
        turnIndex: true,
        evaluatorId: true,
        rating: true,
        isChatGptControl: true,
        evidenceIntegrity: true,
      },
    });
    return rows;
  } finally {
    await prisma.$disconnect();
  }
}

function parseFloatArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx < 0) return fallback;
  const raw = process.argv[idx + 1];
  const parsed = parseFloat(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

async function main() {
  const kappaThreshold = parseFloatArg(
    'kappa-threshold',
    DEFAULT_KAPPA_THRESHOLD,
  );
  const evidenceThreshold = parseFloatArg(
    'evidence-threshold',
    DEFAULT_EVIDENCE_RATE_THRESHOLD,
  );
  const asJson = process.argv.includes('--json');

  const rows = await loadFromDb();
  const result = runGate(rows, {
    kappa: kappaThreshold,
    evidenceRate: evidenceThreshold,
  });

  if (asJson) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
  } else {
    // eslint-disable-next-line no-console
    console.log(formatVerdict(result));
    // eslint-disable-next-line no-console
    console.log(`  loaded ${rows.length} EssayDebateEvaluation rows\n`);
  }

  process.exit(result.pass ? 0 : 1);
}

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Fatal:', err);
    process.exit(2);
  });
}
