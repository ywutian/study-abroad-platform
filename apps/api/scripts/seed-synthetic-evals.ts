#!/usr/bin/env tsx
/**
 * Phase 2 V1 PR4 — synthetic eval smoke test (LOCAL ONLY, NOT FOR PROD).
 *
 * What
 * ----
 * Validates that `scripts/debate-eval-gate.ts` (the Day-7 decision
 * gate) reads, aggregates, and verdicts EssayDebateEvaluation rows
 * correctly with the real data shape — including:
 *   - the new PR4 `source: 'chatgpt-control'` marker
 *   - Fleiss κ across 3 evaluators
 *   - lumni-vs-control SHARP+USEFUL share comparison
 *
 * It does this by:
 *   1. Picking up to 5 lumni sessions + up to 5 ChatGPT-control sessions
 *      from the local DB.
 *   2. For each session it creates EssayDebateEvaluation rows from 3
 *      fake evaluators (`counselor-smoke-1/-2/-3`) with mostly-aligned
 *      ratings (so κ should clear the 0.5 threshold).
 *   3. Runs `runGate()` against the freshly written rows + prints the
 *      verdict.
 *   4. Deletes every row it inserted. **This is a local validation, not
 *      production data — leaving rows behind would skew the real Day-7
 *      gate.**
 *
 * Idempotency / safety
 * --------------------
 * Uses a unique synthetic-evaluator prefix (`counselor-smoke-`) so
 * cleanup is unambiguous. If the script crashes mid-run, re-running it
 * still cleans up everything matching that prefix first.
 *
 * Usage
 * -----
 *   pnpm --filter api exec tsx scripts/seed-synthetic-evals.ts
 *   pnpm --filter api exec tsx scripts/seed-synthetic-evals.ts --keep   # debug: skip cleanup
 */
import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';
loadDotenv({ path: resolve(__dirname, '../.env.local') });
loadDotenv({ path: resolve(__dirname, '../.env') });

import { PrismaClient, EssayDebateRating } from '@prisma/client';
import {
  runGate,
  formatVerdict,
  DEFAULT_KAPPA_THRESHOLD,
  DEFAULT_EVIDENCE_RATE_THRESHOLD,
  EvaluationRow,
} from '../src/modules/essay-debate/debate-eval-gate.util';

const SYNTHETIC_EVALUATOR_PREFIX = 'counselor-smoke-';
const EVALUATORS = [
  'counselor-smoke-1',
  'counselor-smoke-2',
  'counselor-smoke-3',
];
const ARCHIVE_PATH = resolve(
  __dirname,
  'data',
  `synthetic-evals-${new Date().toISOString().slice(0, 10)}.json`,
);

interface AiTurn {
  role: 'user' | 'ai';
  source?: 'chatgpt-control';
}

async function pickPool(prisma: PrismaClient) {
  const sessions = await prisma.essayDebateSession.findMany({
    select: { id: true, turns: true },
  });

  const lumni: Array<{ sessionId: string; turnIndex: number }> = [];
  const control: Array<{ sessionId: string; turnIndex: number }> = [];

  for (const s of sessions) {
    const turns = Array.isArray(s.turns)
      ? (s.turns as unknown as AiTurn[])
      : [];
    for (let i = 0; i < turns.length; i++) {
      const t = turns[i];
      if (t.role !== 'ai') continue;
      if (t.source === 'chatgpt-control') {
        control.push({ sessionId: s.id, turnIndex: i });
      } else {
        lumni.push({ sessionId: s.id, turnIndex: i });
      }
    }
  }
  return { lumni: lumni.slice(0, 5), control: control.slice(0, 5) };
}

/**
 * Returns mostly-aligned ratings — 2 of 3 evaluators agree, 3rd diverges
 * occasionally. Lumni skewed toward SHARP/USEFUL; control toward
 * GENERIC. This is the shape we'd hope the real Day-6 eval produces if
 * the lumni stack actually outperforms a vanilla ChatGPT reply.
 */
function ratingsForLumni(itemIdx: number): EssayDebateRating[] {
  // Patterns rotated to vary per item so Fleiss κ has signal.
  const patterns: EssayDebateRating[][] = [
    ['SHARP', 'SHARP', 'USEFUL'],
    ['USEFUL', 'USEFUL', 'SHARP'],
    ['SHARP', 'USEFUL', 'SHARP'],
    ['USEFUL', 'SHARP', 'SHARP'],
    ['SHARP', 'SHARP', 'GENERIC'],
  ];
  return patterns[itemIdx % patterns.length];
}

function ratingsForControl(itemIdx: number): EssayDebateRating[] {
  const patterns: EssayDebateRating[][] = [
    ['GENERIC', 'GENERIC', 'USEFUL'],
    ['SYCOPHANTIC', 'GENERIC', 'GENERIC'],
    ['GENERIC', 'USEFUL', 'GENERIC'],
    ['USEFUL', 'GENERIC', 'GENERIC'],
    ['GENERIC', 'GENERIC', 'GENERIC'],
  ];
  return patterns[itemIdx % patterns.length];
}

async function cleanupSyntheticRows(prisma: PrismaClient): Promise<number> {
  const result = await prisma.essayDebateEvaluation.deleteMany({
    where: {
      evaluatorId: { startsWith: SYNTHETIC_EVALUATOR_PREFIX },
    },
  });
  return result.count;
}

async function main() {
  const keep = process.argv.includes('--keep');
  const prisma = new PrismaClient();
  let createdCount = 0;
  try {
    // Always start clean — defend against a previous crashed run.
    const preCount = await cleanupSyntheticRows(prisma);
    if (preCount > 0) {
      console.log(
        `[seed-synthetic-evals] Cleared ${preCount} stale synthetic row(s) from prior run.`,
      );
    }

    const { lumni, control } = await pickPool(prisma);
    console.log(
      `[seed-synthetic-evals] Pool lumni=${lumni.length} control=${control.length}`,
    );
    if (lumni.length === 0 && control.length === 0) {
      console.warn(
        '[seed-synthetic-evals] No AI turns found in any EssayDebateSession — nothing to evaluate. Did you run seed-chatgpt-control-turns.ts + generate-chatgpt-control-turns.ts?',
      );
      return;
    }

    const created: Array<EvaluationRow> = [];

    for (let i = 0; i < lumni.length; i++) {
      const item = lumni[i];
      const ratings = ratingsForLumni(i);
      for (let r = 0; r < EVALUATORS.length; r++) {
        const row = await prisma.essayDebateEvaluation.upsert({
          where: {
            sessionId_turnIndex_evaluatorId: {
              sessionId: item.sessionId,
              turnIndex: item.turnIndex,
              evaluatorId: EVALUATORS[r],
            },
          },
          create: {
            sessionId: item.sessionId,
            turnIndex: item.turnIndex,
            evaluatorId: EVALUATORS[r],
            rating: ratings[r],
            isChatGptControl: false,
            evidenceIntegrity: r !== 2, // 2/3 say evidence integrity is good
          },
          update: {
            rating: ratings[r],
            isChatGptControl: false,
            evidenceIntegrity: r !== 2,
          },
          select: {
            sessionId: true,
            turnIndex: true,
            evaluatorId: true,
            rating: true,
            isChatGptControl: true,
            evidenceIntegrity: true,
          },
        });
        created.push(row);
        createdCount++;
      }
    }

    for (let i = 0; i < control.length; i++) {
      const item = control[i];
      const ratings = ratingsForControl(i);
      for (let r = 0; r < EVALUATORS.length; r++) {
        const row = await prisma.essayDebateEvaluation.upsert({
          where: {
            sessionId_turnIndex_evaluatorId: {
              sessionId: item.sessionId,
              turnIndex: item.turnIndex,
              evaluatorId: EVALUATORS[r],
            },
          },
          create: {
            sessionId: item.sessionId,
            turnIndex: item.turnIndex,
            evaluatorId: EVALUATORS[r],
            rating: ratings[r],
            isChatGptControl: true,
            evidenceIntegrity: null,
          },
          update: {
            rating: ratings[r],
            isChatGptControl: true,
            evidenceIntegrity: null,
          },
          select: {
            sessionId: true,
            turnIndex: true,
            evaluatorId: true,
            rating: true,
            isChatGptControl: true,
            evidenceIntegrity: true,
          },
        });
        created.push(row);
        createdCount++;
      }
    }

    console.log(
      `[seed-synthetic-evals] Inserted ${createdCount} synthetic eval rows.`,
    );

    // Run the gate against the freshly written rows.
    const verdict = runGate(created, {
      kappa: DEFAULT_KAPPA_THRESHOLD,
      evidenceRate: DEFAULT_EVIDENCE_RATE_THRESHOLD,
    });
    console.log('\n=== SYNTHETIC EVAL GATE VERDICT ===');
    console.log(formatVerdict(verdict));
    console.log('===================================\n');

    // Archive for audit.
    try {
      const { mkdirSync, writeFileSync } = await import('fs');
      const { dirname } = await import('path');
      mkdirSync(dirname(ARCHIVE_PATH), { recursive: true });
      writeFileSync(
        ARCHIVE_PATH,
        JSON.stringify(
          { generatedAt: new Date().toISOString(), verdict, rows: created },
          null,
          2,
        ),
      );
      console.log(`[seed-synthetic-evals] Archived → ${ARCHIVE_PATH}`);
    } catch (err) {
      console.warn(
        `[seed-synthetic-evals] Archive write failed: ${(err as Error).message}`,
      );
    }
  } finally {
    if (!process.argv.includes('--keep')) {
      const deleted = await cleanupSyntheticRows(prisma);
      console.log(
        `[seed-synthetic-evals] Cleaned up ${deleted} synthetic row(s).`,
      );
    } else {
      console.log(
        '[seed-synthetic-evals] --keep flag set; rows NOT deleted. Run again without --keep to clean up.',
      );
    }
    await prisma.$disconnect();
    if (keep) {
      // squash unused-variable warning in some lint configs
      void createdCount;
    }
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal:', err);
      process.exit(1);
    });
}
