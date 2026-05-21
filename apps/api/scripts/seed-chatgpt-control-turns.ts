#!/usr/bin/env tsx
/**
 * Seed ChatGPT-control EssayDebateSession rows for the 20 dogfood cases.
 *
 * Why
 * ---
 * Day-6 blind-eval is A/B: every counsellor sees lumni rebuttals and
 * ChatGPT-control rebuttals on the same essays, rates both blind, and
 * the gate script computes lumni-vs-control SHARP+USEFUL share. To do
 * that the queue needs control rows in the DB; without them the gate
 * would only see lumni data and the comparison check would always pass
 * vacuously.
 *
 * What this DOES NOT do
 * ---------------------
 * It does NOT call OpenAI. PR3 deliberately leaves a loud placeholder
 * string in every control turn:
 *
 *   "PR3 PLACEHOLDER — OpenAI control turn to be filled by ops-team
 *    before Day 6 blind-eval. See CONTEXT_AUDIT.md."
 *
 * Operations must replace the placeholder with a real ChatGPT-generated
 * rebuttal before counsellors start eval. The eval admin UI surfaces the
 * placeholder verbatim so it's impossible to miss.
 *
 * Idempotency
 * -----------
 * For each dogfood case we create at most one control session (looks up
 * by admissionCaseId + an internal marker on the user-turn text). Re-runs
 * are no-ops.
 *
 * Usage
 * -----
 *   pnpm --filter api exec tsx scripts/seed-chatgpt-control-turns.ts
 *   pnpm --filter api exec tsx scripts/seed-chatgpt-control-turns.ts --dry-run
 *   pnpm --filter api exec tsx scripts/seed-chatgpt-control-turns.ts --paragraph 2
 */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { DOGFOOD_CASE_IDS } from './precompute-dogfood-analyses';

const logger = new Logger('seed-chatgpt-control-turns');

/**
 * Loud placeholder string. Reproduced verbatim from
 * DebateBlindEvalService.CHATGPT_CONTROL_PLACEHOLDER — kept in two places
 * so the seeder doesn't need to import nestjs context. Keep in sync.
 */
export const CHATGPT_CONTROL_PLACEHOLDER =
  'PR3 PLACEHOLDER — OpenAI control turn to be filled by ops-team before Day 6 blind-eval. See CONTEXT_AUDIT.md.';

/**
 * Marker on the synthetic user turn so the seeder can find its own rows
 * on re-run without storing a schema column for "control session".
 */
const CONTROL_USER_TURN_MARKER = '[control-seed-2026-05-20]';

/**
 * The seed needs a user FK because EssayDebateSession.userId is required.
 * We look up the platform's system/admin user — same pattern other seeds
 * use (e.g. essay-harvest). Falls back to ANY admin role user.
 */
async function resolveSeedUserId(prisma: PrismaClient): Promise<string> {
  const sysUser = await prisma.user.findFirst({
    where: { email: { contains: 'system' } },
    select: { id: true },
  });
  if (sysUser) return sysUser.id;
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' as never },
    select: { id: true },
  });
  if (!adminUser) {
    throw new Error(
      'No system/admin user found — cannot seed control sessions without a userId FK.',
    );
  }
  return adminUser.id;
}

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const paragraphArg = getArg('paragraph');
  const paragraphIndex = paragraphArg ? parseInt(paragraphArg, 10) : 0;

  const prisma = new PrismaClient();
  try {
    const userId = await resolveSeedUserId(prisma);
    logger.log(`Using seedUserId=${userId} paragraphIndex=${paragraphIndex}`);

    let created = 0;
    let skipped = 0;
    let missing = 0;

    for (const caseId of DOGFOOD_CASE_IDS) {
      const exists = await prisma.essayDebateSession.findFirst({
        where: {
          admissionCaseId: caseId,
          // user turn marker is the cheapest way to spot our own seed rows
          turns: {
            path: ['0', 'text'],
            string_contains: CONTROL_USER_TURN_MARKER,
          } as never,
        },
        select: { id: true },
      });
      if (exists) {
        skipped++;
        continue;
      }

      const ac = await prisma.admissionCase.findUnique({
        where: { id: caseId },
        select: { id: true, essayContent: true },
      });
      if (!ac) {
        missing++;
        logger.warn(`Case ${caseId} not found — skipping`);
        continue;
      }

      const now = new Date().toISOString();
      const userTurn = {
        id: randomUUID(),
        role: 'user' as const,
        text: `${CONTROL_USER_TURN_MARKER} I disagree with the AI feedback on this essay — show me a counter-argument.`,
        createdAt: now,
      };
      const aiTurn = {
        id: randomUUID(),
        role: 'ai' as const,
        text: CHATGPT_CONTROL_PLACEHOLDER,
        evidence: [],
        openQuestion: undefined as string | undefined,
        tokensUsed: 0,
        createdAt: now,
      };

      if (dryRun) {
        logger.log(`[dry-run] would create control session for case=${caseId}`);
        created++;
        continue;
      }

      await prisma.essayDebateSession.create({
        data: {
          userId,
          admissionCaseId: caseId,
          paragraphIndex,
          turns: [userTurn, aiTurn] as unknown as Prisma.InputJsonValue,
          totalTurns: 1,
          totalTokens: 0,
        },
      });
      created++;
    }

    logger.log(
      `Done. created=${created} skipped=${skipped} missing=${missing} total=${DOGFOOD_CASE_IDS.length}`,
    );
    if (!dryRun && created > 0) {
      logger.warn(
        `OPS REMINDER — ${created} control sessions now hold the placeholder string. Before Day 6 eval, replace ai turn .text with real ChatGPT rebuttals (see CONTEXT_AUDIT.md and the PR3 description).`,
      );
    }
  } finally {
    await prisma.$disconnect();
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
