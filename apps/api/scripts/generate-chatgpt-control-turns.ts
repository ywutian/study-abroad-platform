#!/usr/bin/env tsx
/**
 * Phase 2 V1 PR4 — generate real ChatGPT-control turns for the blind eval.
 *
 * Why
 * ---
 * PR3 shipped `seed-chatgpt-control-turns.ts` which inserted 20
 * EssayDebateSession rows with a loud placeholder string in turns[0]'s
 * AI text. The Day-6 blind eval cannot start until those become real
 * ChatGPT-style rebuttals (otherwise counselors rate placeholder strings
 * and the lumni-vs-control SHARP+USEFUL comparison is meaningless).
 *
 * What it does
 * ------------
 * For each EssayDebateSession where the AI turn (turns[1] by convention
 * — first user turn is index 0, first AI turn is index 1; older seeds
 * may put the placeholder at turns[0]) still starts with the PR3
 * `CHATGPT_CONTROL_PLACEHOLDER` prefix:
 *   1. Load the corresponding AdmissionCase (essay + prompt + school).
 *   2. Synthesize a generic "user challenge" — same pattern across all
 *      sessions so the comparison is apples-to-apples with what lumni
 *      would see if a user filed the same challenge.
 *   3. Call OpenAI (model: $OPENAI_MODEL, default gpt-4o-mini) asking
 *      for a structured rebuttal: `{ rebuttal, evidence: [{quote, source}],
 *      openQuestion }`. The prompt mirrors the lumni system prompt's
 *      output contract so blind raters can't tell them apart by
 *      structure.
 *   4. Replace the AI turn's text/evidence/openQuestion + mark
 *      `source: 'chatgpt-control'` (new PR4 field; see
 *      `DebateTurnDto.source` and `DebateBlindEvalService` which now
 *      detects control sessions via this marker as the primary signal,
 *      falling back to placeholder-text matching for legacy rows).
 *
 * Idempotency
 * -----------
 * Skip any session whose AI turn already has
 * `source === 'chatgpt-control'`. Re-runs only fill in newly-seeded
 * placeholder rows.
 *
 * Budget guard
 * ------------
 * Refuses to run if estimated total cost > $5. Typical run: 20 sessions
 * × ~$0.01 = $0.20. The cap is a sanity belt; if it ever trips, the
 * cause is a runaway loop or a model swap, not normal operation.
 *
 * Audit trail
 * -----------
 * Every model response is archived to
 * `apps/api/scripts/data/chatgpt-control-turns-<YYYY-MM-DD>.json`.
 * This file is gitignored — it captures non-deterministic model output
 * for incident review, not for repo history.
 *
 * Usage
 * -----
 *   pnpm --filter api exec tsx scripts/generate-chatgpt-control-turns.ts
 *   pnpm --filter api exec tsx scripts/generate-chatgpt-control-turns.ts --dry-run
 *   pnpm --filter api exec tsx scripts/generate-chatgpt-control-turns.ts --case-id <id>
 */
import 'reflect-metadata';
import { config as loadDotenv } from 'dotenv';
import { resolve, dirname } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

// Pre-load .env so OPENAI_API_KEY + OPENAI_MODEL are visible. See
// scripts/lib/precompute.module.ts for full rationale on why CLI
// scripts need to dotenv-load themselves.
loadDotenv({
  path: resolve(__dirname, '../.env.local'),
});
loadDotenv({
  path: resolve(__dirname, '../.env'),
});

import { PrismaClient, Prisma } from '@prisma/client';
import OpenAI from 'openai';

const ARCHIVE_DIR = resolve(__dirname, 'data');
const ARCHIVE_PATH = resolve(
  ARCHIVE_DIR,
  `chatgpt-control-turns-${new Date().toISOString().slice(0, 10)}.json`,
);

const PLACEHOLDER_PREFIX = 'PR3 PLACEHOLDER';

/**
 * Hard ceiling — refuses to run if the cost-of-run model estimate
 * exceeds this. Typical run is $0.20, so this is a sanity belt.
 */
const BUDGET_CAP_USD = 5.0;

/**
 * Rough cost per session at gpt-4o-mini list pricing
 *   ($0.15 / 1M input, $0.60 / 1M output).
 * Essay text up to ~2000 tokens + system prompt ~300 + ~400 output
 *   ≈ 2700 input + 400 output = $0.0007. Round generously to $0.01
 *   to account for model-tier swaps (e.g. gpt-4o or gpt-5.4-mini have
 *   different pricing).
 */
const COST_PER_SESSION_USD = 0.01;

interface AiTurn {
  id: string;
  role: 'user' | 'ai';
  text: string;
  evidence?: Array<{
    quote: string;
    source: 'essay' | 'prior_commentary' | 'profile' | 'school';
    paragraphIndex?: number;
  }>;
  openQuestion?: string;
  tokensUsed?: number;
  source?: 'chatgpt-control';
  createdAt: string;
}

interface RebuttalShape {
  rebuttal: string;
  evidence: Array<{ quote: string; source?: string }>;
  openQuestion: string;
}

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(`[generate-chatgpt-control] ${msg}`);
}

function warn(msg: string) {
  // eslint-disable-next-line no-console
  console.warn(`[generate-chatgpt-control] WARN: ${msg}`);
}

/**
 * Build the simulated "user challenge" we send to OpenAI. Same shape
 * across all sessions so the blind raters can't fingerprint control
 * sessions by the user message itself.
 */
function buildUserChallenge(): string {
  return [
    '我刚收到 AI 对这篇文书的评估，但我对其中一些判断不完全认同。',
    '请你站在作者立场上，挑出 AI 评估中最值得商榷的一条具体观点，',
    '用文书原文中的具体句子作为证据反驳它，',
    '并给出一个可以让 AI 重新思考的开放性问题。',
  ].join(' ');
}

function buildSystemPrompt(
  essayText: string,
  essayPrompt: string | null,
  schoolName: string | null,
): string {
  return [
    'You are an essay-feedback assistant responding to a user who is challenging a prior AI assessment of their college application essay.',
    "Your job is to push back constructively, citing the user's essay text verbatim as evidence.",
    '',
    schoolName ? `Target school: ${schoolName}` : '',
    essayPrompt ? `Essay prompt: ${essayPrompt}` : '',
    '',
    'ESSAY TEXT (use verbatim quotes from this when constructing `evidence`):',
    '"""',
    essayText.slice(0, 8000),
    '"""',
    '',
    'Respond with ONLY a single JSON object of this shape:',
    '{',
    '  "rebuttal": "2-4 sentences pushing back on the most-debatable point in the user\'s implicit challenge",',
    '  "evidence": [',
    '    { "quote": "verbatim snippet from the essay text above", "source": "essay" }',
    '  ],',
    '  "openQuestion": "one open-ended follow-up question to keep the user thinking"',
    '}',
    '',
    'Hard rules:',
    '- Every `quote` MUST appear verbatim in the essay text.',
    '- At least one evidence quote.',
    '- No additional keys, no commentary outside the JSON.',
    "- Respond in the same language as the user's challenge (Chinese).",
  ]
    .filter(Boolean)
    .join('\n');
}

function parseLooseJson(raw: string): RebuttalShape | null {
  // Strip code fences if present.
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'rebuttal' in parsed &&
      'evidence' in parsed
    ) {
      return parsed as RebuttalShape;
    }
  } catch {
    /* fallthrough */
  }
  // Try to extract the first {...} block.
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
      if (
        parsed &&
        typeof parsed === 'object' &&
        'rebuttal' in parsed &&
        'evidence' in parsed
      ) {
        return parsed as RebuttalShape;
      }
    } catch {
      /* nothing */
    }
  }
  return null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const onlyCaseId = getArg('case-id');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY missing — cannot generate control turns. Check apps/api/.env.',
    );
  }
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const prisma = new PrismaClient();
  const openai = new OpenAI({ apiKey });

  const archive: Array<{
    sessionId: string;
    admissionCaseId: string | null;
    promptModel: string;
    request: { systemPrompt: string; userChallenge: string };
    response: RebuttalShape | { raw: string; parseError: true };
    tokensUsed: number;
  }> = [];

  try {
    // Find candidates: sessions whose first AI turn either still carries
    // the PR3 placeholder OR is not yet marked as chatgpt-control.
    const sessions = await prisma.essayDebateSession.findMany({
      where: onlyCaseId ? { admissionCaseId: onlyCaseId } : {},
      select: {
        id: true,
        admissionCaseId: true,
        turns: true,
      },
    });

    const candidates: Array<{
      sessionId: string;
      admissionCaseId: string;
      aiTurnIndex: number;
      turns: AiTurn[];
    }> = [];

    for (const s of sessions) {
      if (!s.admissionCaseId) continue;
      const turns = Array.isArray(s.turns)
        ? (s.turns as unknown as AiTurn[])
        : [];
      const aiTurnIdx = turns.findIndex((t) => t.role === 'ai');
      if (aiTurnIdx < 0) continue;
      const aiTurn = turns[aiTurnIdx];
      // Skip if already marked as chatgpt-control (idempotency).
      if (aiTurn.source === 'chatgpt-control') continue;
      // Only touch sessions still carrying the PR3 placeholder — this
      // guards against accidentally overwriting real lumni-debate
      // sessions that just happen to share the same admissionCaseId.
      if (!aiTurn.text?.startsWith(PLACEHOLDER_PREFIX)) continue;
      candidates.push({
        sessionId: s.id,
        admissionCaseId: s.admissionCaseId,
        aiTurnIndex: aiTurnIdx,
        turns,
      });
    }

    const estimatedCost = candidates.length * COST_PER_SESSION_USD;
    log(
      `Found ${candidates.length} placeholder session(s) · model=${model} · estimatedCost≈$${estimatedCost.toFixed(2)} · cap=$${BUDGET_CAP_USD}`,
    );
    if (estimatedCost > BUDGET_CAP_USD) {
      throw new Error(
        `Estimated cost $${estimatedCost.toFixed(2)} exceeds budget cap $${BUDGET_CAP_USD} — refusing to run`,
      );
    }
    if (candidates.length === 0) {
      log('Nothing to do.');
      return;
    }
    if (dryRun) {
      log('[dry-run] would call OpenAI for each session above.');
      return;
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let totalTokensIn = 0;
    let totalTokensOut = 0;

    for (const c of candidates) {
      processed++;
      const ac = await prisma.admissionCase.findUnique({
        where: { id: c.admissionCaseId },
        select: {
          essayContent: true,
          essayPrompt: true,
          school: { select: { name: true } },
        },
      });
      if (!ac || !ac.essayContent || ac.essayContent.length < 100) {
        warn(
          `Skip session=${c.sessionId} — case=${c.admissionCaseId} missing essayContent`,
        );
        failed++;
        continue;
      }

      const userChallenge = buildUserChallenge();
      const systemPrompt = buildSystemPrompt(
        ac.essayContent,
        ac.essayPrompt,
        ac.school?.name ?? null,
      );

      try {
        // Newer OpenAI models (gpt-4.1, gpt-5.x, o1/o3/o4 series) reject
        // `max_tokens` and require `max_completion_tokens`. Detect on
        // model family — fall back to legacy `max_tokens` for gpt-3.x /
        // gpt-4 / gpt-4o-mini (which still accept both).
        const useCompletionTokens = /^(gpt-(4\.1|5)|o[1-9])/i.test(model);
        const tokenParam: Record<string, number> = useCompletionTokens
          ? { max_completion_tokens: 800 }
          : { max_tokens: 800 };
        const completion = await openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userChallenge },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.4,
          ...tokenParam,
        });
        const raw = completion.choices?.[0]?.message?.content ?? '';
        const tokensIn = completion.usage?.prompt_tokens ?? 0;
        const tokensOut = completion.usage?.completion_tokens ?? 0;
        totalTokensIn += tokensIn;
        totalTokensOut += tokensOut;

        const parsed = parseLooseJson(raw);
        if (!parsed) {
          warn(
            `Session=${c.sessionId} — model output did not parse as JSON; archiving raw and skipping DB update`,
          );
          archive.push({
            sessionId: c.sessionId,
            admissionCaseId: c.admissionCaseId,
            promptModel: model,
            request: { systemPrompt, userChallenge },
            response: { raw, parseError: true },
            tokensUsed: tokensIn + tokensOut,
          });
          failed++;
          continue;
        }

        // Build the replacement AI turn. Preserve the original turn id
        // so blind-eval evaluations keyed on (sessionId, turnIndex) stay
        // stable.
        const original = c.turns[c.aiTurnIndex];
        const replacement: AiTurn = {
          id: original.id ?? randomUUID(),
          role: 'ai',
          text: parsed.rebuttal,
          evidence: (parsed.evidence ?? []).map((e) => ({
            quote: e.quote,
            // Force `essay` as the source label — the control generator
            // only quotes from the essay text, not from
            // prior_commentary/profile/school context (it doesn't have
            // those classes loaded — that's lumni's advantage). This
            // makes the asymmetry visible in the blind-eval reports.
            source: 'essay' as const,
          })),
          openQuestion: parsed.openQuestion,
          tokensUsed: tokensIn + tokensOut,
          source: 'chatgpt-control',
          createdAt: original.createdAt ?? new Date().toISOString(),
        };

        const newTurns = [...c.turns];
        newTurns[c.aiTurnIndex] = replacement;

        await prisma.essayDebateSession.update({
          where: { id: c.sessionId },
          data: {
            turns: newTurns as unknown as Prisma.InputJsonValue,
            totalTokens: { increment: tokensIn + tokensOut },
          },
        });

        archive.push({
          sessionId: c.sessionId,
          admissionCaseId: c.admissionCaseId,
          promptModel: model,
          request: { systemPrompt, userChallenge },
          response: parsed,
          tokensUsed: tokensIn + tokensOut,
        });
        succeeded++;

        if (processed % 5 === 0) {
          log(
            `Progress ${processed}/${candidates.length} · ok=${succeeded} fail=${failed} tokens=${totalTokensIn + totalTokensOut}`,
          );
        }
      } catch (err) {
        warn(
          `OpenAI call failed session=${c.sessionId}: ${(err as Error).message}`,
        );
        failed++;
      }
    }

    log(
      `Done. processed=${processed} succeeded=${succeeded} failed=${failed} tokensIn=${totalTokensIn} tokensOut=${totalTokensOut}`,
    );

    // Write archive even on partial failure so we can audit what was
    // sent / what came back.
    mkdirSync(dirname(ARCHIVE_PATH), { recursive: true });
    writeFileSync(
      ARCHIVE_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          model,
          summary: {
            candidates: candidates.length,
            succeeded,
            failed,
            tokensIn: totalTokensIn,
            tokensOut: totalTokensOut,
          },
          rows: archive,
        },
        null,
        2,
      ),
    );
    log(`Archived ${archive.length} responses → ${ARCHIVE_PATH}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Fatal:', err);
      process.exit(1);
    });
}
