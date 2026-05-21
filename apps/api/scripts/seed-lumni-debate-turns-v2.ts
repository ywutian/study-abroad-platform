#!/usr/bin/env tsx
/**
 * Phase 2 V1 PR7 — regen 20 lumni debate turns under the v2 prompt
 * (PR6, `DEBATE_PROMPT_VERSION = 'v2'`).
 *
 * Why
 * ---
 * PR6 (`75d84918`) bumped `DEBATE_PROMPT_VERSION` v1 → v2: bans 8
 * concession-opening phrases, requires the rebuttal to reference a
 * specific phrase from the prior commentary, and fixes the
 * evidence-verbatim normaliser (lowercase + fuzzy fallback). For PR7's
 * re-eval to be a fair v1-vs-v2 comparison we need fresh v2-generated
 * lumni turns alongside:
 *   - the 20 v1-prompt PR5 lumni sessions (left untouched as audit trail)
 *   - the 20 PR4 ChatGPT-control sessions (don't regen — those didn't
 *     change)
 *
 * What it does
 * ------------
 * For each of the 20 dogfood case IDs from `CONTEXT_AUDIT.md` §2:
 *
 *   1. Idempotency: skip if a session whose `turns` contain
 *      `source: 'lumni-v2'` already exists for this case.
 *   2. Use the SAME `buildUserChallenge()` text the v1 batch +
 *      `generate-chatgpt-control-turns.ts` sent (so all three pools
 *      answer the same question per case → apples-to-apples).
 *   3. Same deterministic `paragraphIndex = caseId.charCodeAt(0) %
 *      numParagraphs` rule as the v1 batch so the per-case
 *      paragraph-scope is identical across all three pools.
 *   4. Call `EssayDebateService.createOrContinueTurn(systemUserId, { … })`
 *      — real Claude/OpenAI integration via `LLMService`, real
 *      `DebateContextLoader`, real `verifyEvidence` strip, real Redis
 *      budget counter, real v2 prompt.
 *   5. After the service writes the AI turn, patch the persisted
 *      `turns[]` JSON to stamp `turns[last].source = 'lumni-v2'` and
 *      `turns[last].promptVersion = 'v2'`. The live service
 *      deliberately doesn't tag its own writes (the field is reserved
 *      for the script-driven blind-eval pools); we set it post-hoc so
 *      the gate decoder + queue can identify which pool each row
 *      belongs to.
 *   6. Hard budget guard: refuse if `targets × COST_PER_TURN` > $3.
 *      Typical run ≈ $0.80 (LLM_PROVIDER=openai locally → gpt-5.4-mini).
 *
 * Pool labelling table
 * --------------------
 *   PR5 v1 lumni           → `turns[].source` ABSENT (no marker)
 *   PR4 ChatGPT control    → `turns[].source = 'chatgpt-control'`
 *   PR7 v2 lumni (this)    → `turns[].source = 'lumni-v2'`
 *
 * Bootstrap
 * ---------
 * Uses the slim `PrecomputeModule` from `scripts/lib/precompute.module.ts`
 * (PR4/PR5 pattern). `EssayDebateService` is already wired in.
 *
 * Usage
 * -----
 *   pnpm --filter api exec tsx scripts/seed-lumni-debate-turns-v2.ts
 *   pnpm --filter api exec tsx scripts/seed-lumni-debate-turns-v2.ts --dry-run
 *   pnpm --filter api exec tsx scripts/seed-lumni-debate-turns-v2.ts --case-id <id>
 */
import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';

// Eagerly load .env so ANTHROPIC_API_KEY / OPENAI_API_KEY / DATABASE_URL are
// visible BEFORE any Nest module evaluation. See PrecomputeModule for
// rationale.
loadDotenv({ path: resolve(__dirname, '../.env.local') });
loadDotenv({ path: resolve(__dirname, '../.env') });

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrecomputeModule } from './lib/precompute.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EssayDebateService } from '../src/modules/essay-debate/essay-debate.service';
import { DEBATE_PROMPT_VERSION } from '../src/modules/essay-debate/essay-debate.prompts';
import { DOGFOOD_CASE_IDS } from './precompute-dogfood-analyses';
import type { DebateTurnDto } from '../src/modules/essay-debate/dto/debate-turn-response.dto';

const logger = new Logger('seed-lumni-debate-turns-v2');

/** Hard ceiling — refuses to run if cost estimate exceeds. */
const BUDGET_CAP_USD = 3.0;

/**
 * Rough per-turn cost. Same heuristic as the v1 seeder:
 *   ~1.5K input tokens + 800 output tokens at Sonnet-class pricing
 *   ($3/M input, $15/M output) ≈ $0.0165 → round to $0.04 for safety
 *   margin (model swaps, longer essays, context-loader fan-out).
 *
 * LLM_PROVIDER=openai locally → gpt-5.4-mini, which is ~10x cheaper than
 * the Anthropic Sonnet estimate; $0.04 stays conservative either way.
 */
const COST_PER_TURN_USD = 0.04;

/**
 * Pool marker we stamp on `turns[last]` after the service writes it. The
 * gate decoder + blind-eval queue use this to identify which pool the
 * row belongs to. Must NOT collide with `'chatgpt-control'` (PR4) or
 * the un-marked v1 lumni rows (PR5).
 */
const DEFAULT_POOL_SOURCE_MARKER = 'lumni-v2' as const;
const VALID_POOL_MARKERS = ['lumni-v2', 'lumni-v3', 'lumni-v4'] as const;
type PoolMarker = (typeof VALID_POOL_MARKERS)[number];

/**
 * Must match `buildUserChallenge()` in `seed-lumni-debate-turns.ts` (v1)
 * and `generate-chatgpt-control-turns.ts` (control). Kept verbatim — do
 * NOT diverge or the v1/v2/control pools stop being apples-to-apples.
 */
function buildUserChallenge(): string {
  return [
    '我刚收到 AI 对这篇文书的评估，但我对其中一些判断不完全认同。',
    '请你站在作者立场上，挑出 AI 评估中最值得商榷的一条具体观点，',
    '用文书原文中的具体句子作为证据反驳它，',
    '并给出一个可以让 AI 重新思考的开放性问题。',
  ].join(' ');
}

/**
 * Mirror `DebateContextLoaderService.loadContext`'s paragraph-split rule
 * so the deterministic `paragraphIndex` we pick is in-range.
 */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function deterministicParagraphIndex(
  caseId: string,
  numParagraphs: number,
): number {
  if (numParagraphs <= 0) return 0;
  return caseId.charCodeAt(0) % numParagraphs;
}

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

interface TurnReport {
  caseId: string;
  sessionId: string;
  turnSource: PoolMarker;
  promptVersion: string;
  latencyMs: number;
  tokensUsed: number;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const onlyCaseId = getArg('case-id');
  const rawMarker = getArg('pool-marker') ?? DEFAULT_POOL_SOURCE_MARKER;
  if (!(VALID_POOL_MARKERS as readonly string[]).includes(rawMarker)) {
    throw new Error(
      `Invalid --pool-marker "${rawMarker}". Must be one of: ${VALID_POOL_MARKERS.join(', ')}`,
    );
  }
  const POOL_SOURCE_MARKER = rawMarker as PoolMarker;

  // Sanity assert — refuse to run on the legacy v1 prompt. v2 (PR6), v3
  // (PR8), and v4 (PR9) are all acceptable; the seed name says "v2" but
  // the script is the generic re-seed entry-point and the prompt version
  // is logged per-turn in the audit blob.
  const acceptable = ['v2', 'v3', 'v4'];
  if (!acceptable.includes(DEBATE_PROMPT_VERSION as string)) {
    throw new Error(
      `DEBATE_PROMPT_VERSION is "${DEBATE_PROMPT_VERSION}", expected one of ${acceptable.join(', ')} — ` +
        `did PR6/PR8/PR9 land? Refusing to run.`,
    );
  }

  const targetCaseIds = onlyCaseId
    ? [onlyCaseId]
    : ([...DOGFOOD_CASE_IDS] as string[]);

  const estimatedCost = targetCaseIds.length * COST_PER_TURN_USD;
  if (estimatedCost > BUDGET_CAP_USD) {
    throw new Error(
      `Estimated cost $${estimatedCost.toFixed(2)} exceeds budget cap $${BUDGET_CAP_USD} — refusing to run.`,
    );
  }
  logger.log(
    `PR7 v2-lumni regen · targets=${targetCaseIds.length} · estimatedCost≈$${estimatedCost.toFixed(2)} · cap=$${BUDGET_CAP_USD} · promptVersion=${DEBATE_PROMPT_VERSION} · dryRun=${dryRun}`,
  );

  const app = await NestFactory.createApplicationContext(PrecomputeModule, {
    bufferLogs: false,
  });
  app.useLogger(['error', 'warn', 'log']);

  const prisma = app.get(PrismaService);
  const essayDebate = app.get(EssayDebateService);

  try {
    // Resolve the seed system user. Same fallback chain as the v1 seeder.
    // `--user-id <id>` lets you override when the default user has burned
    // its 30/day budget (each script run consumes one turn per case; if
    // you've already run the v1 seeder + dogfood backfill today, the
    // top-cases user is at-cap and the rest of this run will fail with
    // `Daily essay-debate turn limit reached`).
    const overrideUserId = getArg('user-id');
    const sysUser = overrideUserId
      ? await prisma.user.findUnique({
          where: { id: overrideUserId },
          select: { id: true, email: true },
        })
      : ((await prisma.user.findFirst({
          where: { email: 'top-cases@system.local' },
          select: { id: true, email: true },
        })) ??
        (await prisma.user.findFirst({
          where: { email: { contains: 'system' } },
          select: { id: true, email: true },
        })) ??
        (await prisma.user.findFirst({
          where: { role: 'ADMIN' as never },
          select: { id: true, email: true },
        })));
    if (!sysUser) {
      throw new Error(
        'No system/admin user found — cannot create lumni-v2 sessions without a userId FK.',
      );
    }
    logger.log(`Using systemUserId=${sysUser.id} (${sysUser.email})`);

    const userChallenge = buildUserChallenge();

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const reports: TurnReport[] = [];

    for (let i = 0; i < targetCaseIds.length; i++) {
      const caseId = targetCaseIds[i];

      // Idempotency: skip if a lumni-v2 session already exists for this
      // case. We check the JSON marker because that's the source of truth
      // for pool membership — the EssayDebateSession row alone (without
      // its turns) can't tell us which pool it belongs to.
      //
      // Prisma's generated `JsonFilter` type can't fully express
      // `array_contains` against a typed array literal; cast the where
      // payload to satisfy the compiler. The actual runtime semantics
      // are well-supported (Postgres `@>` JSON containment).
      const v2Filter = {
        admissionCaseId: caseId,
        turns: {
          array_contains: [{ source: POOL_SOURCE_MARKER }],
        },
      } as unknown as Prisma.EssayDebateSessionWhereInput;
      const existingV2 = await prisma.essayDebateSession.findFirst({
        where: v2Filter,
        select: { id: true },
      });
      if (existingV2) {
        skipped++;
        if ((i + 1) % 5 === 0 || i === targetCaseIds.length - 1) {
          logger.log(
            `[${i + 1}/${targetCaseIds.length}] case=${caseId} — lumni-v2 session ${existingV2.id} already exists, skipping`,
          );
        }
        continue;
      }

      // Look up the case to derive paragraph count + verify essayContent exists.
      const ac = await prisma.admissionCase.findUnique({
        where: { id: caseId },
        select: { id: true, essayContent: true },
      });
      if (!ac || !ac.essayContent || ac.essayContent.length < 100) {
        logger.warn(`case=${caseId} missing essayContent — skipping`);
        failed++;
        continue;
      }

      const paragraphs = splitParagraphs(ac.essayContent);
      const paragraphIndex = deterministicParagraphIndex(
        caseId,
        paragraphs.length,
      );

      if (dryRun) {
        logger.log(
          `[dry-run] case=${caseId} paragraphIndex=${paragraphIndex} numParagraphs=${paragraphs.length}`,
        );
        created++;
        continue;
      }

      const t0 = Date.now();
      try {
        const resp = await essayDebate.createOrContinueTurn(sysUser.id, {
          admissionCaseId: caseId,
          paragraphIndex,
          userText: userChallenge,
        });
        const latencyMs = Date.now() - t0;

        // ── Stamp the pool marker + promptVersion on the AI turn ─────
        // The live `EssayDebateService` doesn't write `source` on its
        // own turns (that field is reserved for script-authored pools).
        // We patch the persisted JSON post-hoc so the gate + queue can
        // decode pool membership. We refetch first so we operate on the
        // canonical post-write state (the service may have added more
        // than just the one user+ai pair, in theory).
        const refetched = await prisma.essayDebateSession.findUnique({
          where: { id: resp.sessionId },
          select: { id: true, turns: true },
        });
        if (!refetched) {
          throw new Error(
            `Session ${resp.sessionId} vanished between write and stamp`,
          );
        }
        const turns = Array.isArray(refetched.turns)
          ? (refetched.turns as unknown as DebateTurnDto[])
          : [];
        // The most recent AI turn is what we want to stamp. The service
        // appends user, then ai — so the last entry is always the AI turn
        // we just generated. Defensive: assert role===ai before stamping.
        const lastIdx = turns.length - 1;
        if (lastIdx < 0 || turns[lastIdx].role !== 'ai') {
          throw new Error(
            `Session ${resp.sessionId}: last turn (idx=${lastIdx}, role=${turns[lastIdx]?.role}) is not an AI turn — refusing to stamp.`,
          );
        }
        // Stamp `source` (typed on the DTO) + `promptVersion` (free-form
        // metadata we want surfaced for audit). The DTO uses optional
        // properties so this is a backwards-compatible write.
        type StampedTurn = DebateTurnDto & { promptVersion?: string };
        const stamped: StampedTurn = {
          ...turns[lastIdx],
          source: POOL_SOURCE_MARKER,
          promptVersion: DEBATE_PROMPT_VERSION,
        };
        const nextTurns: StampedTurn[] = [...turns];
        nextTurns[lastIdx] = stamped;
        await prisma.essayDebateSession.update({
          where: { id: resp.sessionId },
          data: { turns: nextTurns as unknown as Prisma.InputJsonValue },
        });

        reports.push({
          caseId,
          sessionId: resp.sessionId,
          turnSource: POOL_SOURCE_MARKER,
          promptVersion: DEBATE_PROMPT_VERSION,
          latencyMs,
          tokensUsed: resp.aiTurn.tokensUsed ?? 0,
        });
        created++;
        if ((i + 1) % 5 === 0 || i === targetCaseIds.length - 1) {
          logger.log(
            `Progress ${i + 1}/${targetCaseIds.length} · created=${created} skipped=${skipped} failed=${failed}`,
          );
        }
      } catch (err) {
        const latencyMs = Date.now() - t0;
        failed++;
        logger.warn(
          `case=${caseId} createOrContinueTurn failed (after ${latencyMs}ms): ${(err as Error).message}`,
        );
      }
    }

    logger.log(
      `Done. created=${created} skipped=${skipped} failed=${failed} total=${targetCaseIds.length}`,
    );

    if (reports.length > 0) {
      const totalTokens = reports.reduce((s, r) => s + r.tokensUsed, 0);
      const meanLatency = Math.round(
        reports.reduce((s, r) => s + r.latencyMs, 0) / reports.length,
      );
      logger.log(
        `Lumni-v2 run summary · sessions=${reports.length} totalTokens=${totalTokens} meanLatencyMs=${meanLatency}`,
      );
      for (const r of reports) {
        logger.log(
          `  · case=${r.caseId} session=${r.sessionId} source=${r.turnSource} promptVersion=${r.promptVersion} latencyMs=${r.latencyMs} tokens=${r.tokensUsed}`,
        );
      }
    }
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Fatal:', err);
      process.exit(1);
    });
}
