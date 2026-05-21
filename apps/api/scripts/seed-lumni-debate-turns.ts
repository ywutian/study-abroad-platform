#!/usr/bin/env tsx
/**
 * Phase 2 V1 PR5 — seed 20 real lumni debate turns for the agent-driven
 * blind eval.
 *
 * Why
 * ---
 * PR4 seeded 20 `EssayDebateSession` rows with real ChatGPT-control turns
 * (`turns[1].source = 'chatgpt-control'`) covering the 20 dogfood case IDs
 * from `apps/api/src/modules/essay-debate/CONTEXT_AUDIT.md`. For the no-¥
 * agent-driven blind eval (PR5) to compare lumni-vs-control apples-to-apples
 * we need a matching lumni-Claude debate turn for each of those same 20
 * cases — same user challenge text, same paragraph-scope behaviour, real
 * `EssayDebateService` path (real context loader, real evidence-strip, real
 * budget counter).
 *
 * What it does
 * ------------
 * For each of the 20 dogfood case IDs:
 *
 *   1. Skip if a lumni session already exists for this case
 *      (= any EssayDebateSession with this `admissionCaseId` and at least
 *      one AI turn whose `source !== 'chatgpt-control'`). Idempotent.
 *   2. Use the SAME `buildUserChallenge()` text that the ChatGPT control
 *      script (`generate-chatgpt-control-turns.ts`) sent to OpenAI, so both
 *      pools are answering the same question. The control's user-turn DB
 *      row holds a separate "[control-seed-…] I disagree with the AI
 *      feedback…" placeholder marker — that placeholder is NOT what
 *      OpenAI was actually called with; the real challenge was the Chinese
 *      `buildUserChallenge()` output. We mirror that here for the lumni
 *      side so the prompts match.
 *   3. Pick a deterministic `paragraphIndex` per case so re-runs are
 *      stable: `caseId.charCodeAt(0) % numParagraphs`. The essay-debate
 *      context loader splits on `/\n\n+/`, so we mirror that split.
 *   4. Call the actual `EssayDebateService.createOrContinueTurn(
 *      systemUserId, { admissionCaseId, paragraphIndex, userText })`.
 *      This goes through the real Claude integration via `LLMService`,
 *      real `DebateContextLoader`, real `verifyEvidence` strip, real
 *      Redis budget counter.
 *   5. Log progress every 5 cases.
 *   6. Hard budget guard: refuse if estimated total Claude cost > $3.
 *      Sonnet-class pricing at ~$0.04/turn × 20 ≈ $0.80 typical.
 *
 * Idempotency
 * -----------
 * Re-runs are no-ops for cases that already have a lumni session.
 *
 * Bootstrap
 * ---------
 * Uses the slim `PrecomputeModule` pattern PR4 introduced (the full
 * `AppModule` blows up under `tsx`/esbuild because decorator parameter
 * metadata isn't emitted). We add `EssayDebateModule` to its imports.
 *
 * Usage
 * -----
 *   pnpm --filter api exec tsx scripts/seed-lumni-debate-turns.ts
 *   pnpm --filter api exec tsx scripts/seed-lumni-debate-turns.ts --dry-run
 *   pnpm --filter api exec tsx scripts/seed-lumni-debate-turns.ts --case-id <id>
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
import { PrecomputeModule } from './lib/precompute.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EssayDebateService } from '../src/modules/essay-debate/essay-debate.service';
import { DOGFOOD_CASE_IDS } from './precompute-dogfood-analyses';
import type { DebateTurnDto } from '../src/modules/essay-debate/dto/debate-turn-response.dto';

const logger = new Logger('seed-lumni-debate-turns');

/**
 * Hard ceiling. Refuses to run if the cost-of-run estimate exceeds this.
 * Typical run is ~$0.80, so $3 is a sanity belt.
 */
const BUDGET_CAP_USD = 3.0;

/**
 * Rough per-turn cost estimate at Sonnet-class pricing
 *   ($3 / 1M input, $15 / 1M output).
 *
 * Per-turn budget at ~6K char input (≈1.5K tokens) + 800 output tokens:
 *   1500 × 0.000003 + 800 × 0.000015 = $0.0165. Round generously to $0.04
 *   to absorb context-loader fan-out + model swaps.
 */
const COST_PER_TURN_USD = 0.04;

/**
 * Match the user-challenge string the ChatGPT-control generator sent to
 * OpenAI. Kept in sync verbatim — change both at once if you ever update
 * the eval question. See `apps/api/scripts/generate-chatgpt-control-turns.ts`
 * `buildUserChallenge()`.
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
 * Same paragraph-split rule as `DebateContextLoaderService.loadContext`
 * (`/\n\n+/` + trim + drop empty). Used to choose a deterministic
 * `paragraphIndex` per case.
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
  turnSource: 'lumni-claude';
  latencyMs: number;
  tokensUsed: number;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const onlyCaseId = getArg('case-id');

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
    `Targets: ${targetCaseIds.length} case(s) · estimatedCost≈$${estimatedCost.toFixed(2)} · cap=$${BUDGET_CAP_USD} · dryRun=${dryRun}`,
  );

  const app = await NestFactory.createApplicationContext(PrecomputeModule, {
    bufferLogs: false,
  });
  app.useLogger(['error', 'warn', 'log']);

  const prisma = app.get(PrismaService);
  const essayDebate = app.get(EssayDebateService);

  try {
    // Resolve the seed system user. Same pattern as
    // seed-chatgpt-control-turns.ts. Prefer 'top-cases@system.local'
    // (the canonical seed system user); fall back to anything matching
    // 'system' in email or an ADMIN.
    const sysUser =
      (await prisma.user.findFirst({
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
      }));
    if (!sysUser) {
      throw new Error(
        'No system/admin user found — cannot create lumni sessions without a userId FK.',
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

      // Idempotency: skip if a lumni session already exists.
      // A "lumni session" = any EssayDebateSession with this admissionCaseId
      // whose turns array contains at least one AI turn whose source is not
      // 'chatgpt-control'. We check all sessions for this case and look at
      // their AI turns in code (raw JSON-path queries on negation are noisy).
      const existingSessions = await prisma.essayDebateSession.findMany({
        where: { admissionCaseId: caseId },
        select: { id: true, turns: true },
      });
      const hasLumni = existingSessions.some((s) => {
        const turns = Array.isArray(s.turns)
          ? (s.turns as unknown as DebateTurnDto[])
          : [];
        return turns.some(
          (t) => t.role === 'ai' && t.source !== 'chatgpt-control',
        );
      });
      if (hasLumni) {
        skipped++;
        if ((i + 1) % 5 === 0 || i === targetCaseIds.length - 1) {
          logger.log(
            `[${i + 1}/${targetCaseIds.length}] case=${caseId} — lumni session already exists, skipping`,
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
        reports.push({
          caseId,
          sessionId: resp.sessionId,
          turnSource: 'lumni-claude',
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
        `Lumni run summary · sessions=${reports.length} totalTokens=${totalTokens} meanLatencyMs=${meanLatency}`,
      );
      for (const r of reports) {
        logger.log(
          `  · case=${r.caseId} session=${r.sessionId} source=${r.turnSource} latencyMs=${r.latencyMs} tokens=${r.tokensUsed}`,
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
