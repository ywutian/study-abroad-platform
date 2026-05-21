#!/usr/bin/env tsx
/**
 * Precompute paragraph-analysis cache for all gallery-visible AdmissionCases.
 *
 * Why this exists
 * ---------------
 * The 文书 gallery analyze endpoint costs 20 points and ~5-10s of LLM time per
 * call. For the 190-row public archive that ratio is fine for a fresh request
 * but kills the perceived-quality bar for a returning visitor. PR 1 adds an
 * `AdmissionCase.aiAnalysisCache` JSON column keyed by locale; this script
 * fills it for every gallery-visible essay so the next user gets an instant
 * response (still charged 20 pts per spec — see mama-persona feedback in the
 * 19-agent debate).
 *
 * What it does NOT do
 * -------------------
 * - It is NOT invoked from migrate.sh. The Cloud Run task has a 300s ceiling;
 *   190 essays × 2 locales × ~5-10s/each = 30-60 min, which would time out
 *   and silently leave us in the slow path. Run it ad-hoc against prod after
 *   the migration deploys.
 *
 * Idempotency
 * -----------
 * For each (case, locale) it skips when `aiAnalysisCache[locale].promptVersion`
 * already matches `PARAGRAPH_PROMPT_VERSION`. Bumping the version invalidates
 * old cached rows on the next run.
 *
 * Usage
 * -----
 *   pnpm precompute:gallery-analysis                  # both zh + en
 *   pnpm precompute:gallery-analysis --locale zh      # one locale
 *   pnpm precompute:gallery-analysis --limit 10       # smoke test
 *   pnpm precompute:gallery-analysis --case-id <id>   # single case
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
// PR4 fix: use slim PrecomputeModule instead of AppModule. AppModule
// drags in EmailModule (which fails to instantiate in standalone CLI),
// ThrottlerModule, global guards, scheduler — none of which scripts need.
// See scripts/lib/precompute.module.ts for the full rationale.
import { PrecomputeModule } from './lib/precompute.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  EssayAiService,
  PARAGRAPH_PROMPT_VERSION,
} from '../src/modules/essay/essay-ai.service';
import { CASE_PUBLIC_WHERE } from '../src/modules/essay/constants/essay-gallery.constants';

const logger = new Logger('precompute-gallery-analysis');

type Locale = 'zh' | 'en';

interface CachedAnalysisEntry {
  promptVersion: string;
  generatedAt: string;
  payload: unknown;
}

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function readCacheEntry(
  blob: unknown,
  locale: string,
): CachedAnalysisEntry | null {
  if (!blob || typeof blob !== 'object' || Array.isArray(blob)) return null;
  const entry = (blob as Record<string, unknown>)[locale];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const e = entry as Record<string, unknown>;
  if (
    typeof e.promptVersion !== 'string' ||
    typeof e.generatedAt !== 'string' ||
    e.payload == null
  ) {
    return null;
  }
  return {
    promptVersion: e.promptVersion,
    generatedAt: e.generatedAt,
    payload: e.payload,
  };
}

function mergeEntry(
  blob: unknown,
  locale: string,
  entry: CachedAnalysisEntry,
): Record<string, CachedAnalysisEntry> {
  const base: Record<string, CachedAnalysisEntry> =
    blob && typeof blob === 'object' && !Array.isArray(blob)
      ? ({ ...(blob as Record<string, CachedAnalysisEntry>) } as Record<
          string,
          CachedAnalysisEntry
        >)
      : {};
  base[locale] = entry;
  return base;
}

async function main() {
  const localeArg = getArg('locale');
  const limitArg = getArg('limit');
  const caseIdArg = getArg('case-id');

  const locales: Locale[] =
    localeArg === 'zh' ? ['zh'] : localeArg === 'en' ? ['en'] : ['zh', 'en'];
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;

  logger.log(
    `Bootstrapping Nest context · locales=${locales.join(',')} limit=${limit ?? 'all'} case-id=${caseIdArg ?? 'all'}`,
  );

  const app = await NestFactory.createApplicationContext(PrecomputeModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const essayAi = app.get(EssayAiService);

    const cases = await prisma.admissionCase.findMany({
      where: {
        ...CASE_PUBLIC_WHERE,
        ...(caseIdArg ? { id: caseIdArg } : {}),
      },
      select: {
        id: true,
        essayContent: true,
        essayPrompt: true,
        aiAnalysisCache: true,
        school: { select: { name: true } },
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    logger.log(
      `Found ${cases.length} gallery-visible essays. PARAGRAPH_PROMPT_VERSION=${PARAGRAPH_PROMPT_VERSION}`,
    );

    let processed = 0;
    let skipped = 0;
    let written = 0;
    let errored = 0;

    for (const c of cases) {
      if (!c.essayContent || c.essayContent.length < 200) {
        skipped++;
        continue;
      }
      let blob: unknown = c.aiAnalysisCache;
      let touched = false;

      for (const locale of locales) {
        const existing = readCacheEntry(blob, locale);
        if (existing && existing.promptVersion === PARAGRAPH_PROMPT_VERSION) {
          continue; // already current
        }

        try {
          const analysis = await essayAi.analyzeEssayParagraphs(
            c.essayContent,
            c.essayPrompt || undefined,
            c.school?.name,
            locale,
          );
          const entry: CachedAnalysisEntry = {
            promptVersion: PARAGRAPH_PROMPT_VERSION,
            generatedAt: new Date().toISOString(),
            payload: analysis as unknown,
          };
          blob = mergeEntry(blob, locale, entry);
          touched = true;
          written++;
        } catch (err) {
          // Don't abort the batch on a single failure — log + move on so the
          // remaining 189 cases can still get cached.
          errored++;
          logger.error(
            `Analyze failed case=${c.id} locale=${locale}: ${(err as Error).message}`,
          );
        }
      }

      if (touched) {
        try {
          await prisma.admissionCase.update({
            where: { id: c.id },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { aiAnalysisCache: blob as any },
          });
        } catch (err) {
          errored++;
          logger.error(
            `Cache write failed case=${c.id}: ${(err as Error).message}`,
          );
        }
      }

      processed++;
      if (processed % 10 === 0) {
        logger.log(
          `Progress ${processed}/${cases.length} · written=${written} skipped=${skipped} errored=${errored}`,
        );
      }
    }

    logger.log(
      `Done. processed=${processed} written=${written} skipped=${skipped} errored=${errored}`,
    );
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Fatal:', err);
    process.exit(1);
  });
