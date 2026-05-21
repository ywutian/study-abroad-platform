#!/usr/bin/env tsx
/**
 * Precompute paragraph-analysis cache for just the 20 Phase-2-V1-PR3
 * dogfood case IDs (see apps/api/src/modules/essay-debate/CONTEXT_AUDIT.md).
 *
 * Why this exists
 * ---------------
 * `precompute-gallery-analysis.ts` walks every gallery-visible AdmissionCase.
 * For the Day-5 dogfood pass we only need the 20 case IDs the audit doc
 * pre-selected, so this companion script targets just those IDs. Cost is
 * tiny: 20 cases × 2 locales × ~$0.0004/call ≈ $0.02. Idempotent — skips
 * (case, locale) pairs whose `aiAnalysisCache[locale].promptVersion` is
 * already current, so re-runs are safe.
 *
 * Usage:
 *   pnpm --filter api exec tsx scripts/precompute-dogfood-analyses.ts
 *   pnpm --filter api exec tsx scripts/precompute-dogfood-analyses.ts --locale zh
 *   pnpm --filter api exec tsx scripts/precompute-dogfood-analyses.ts --dry-run
 *
 * Run this BEFORE the Day-6 blind-eval starts so Class 6
 * (`priorCommentary`) is populated for the dogfood pool.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  EssayAiService,
  PARAGRAPH_PROMPT_VERSION,
} from '../src/modules/essay/essay-ai.service';

const logger = new Logger('precompute-dogfood-analyses');

type Locale = 'zh' | 'en';

/**
 * The 20 L2-verified dogfood case IDs from CONTEXT_AUDIT.md (section 2).
 * Kept in code rather than read from the doc so the script can run without
 * the audit doc being co-located in prod images.
 */
export const DOGFOOD_CASE_IDS = [
  'cmpdnegbw000rh6kfothxa69f',
  'cmpdnegbo000ph6kfnlo83j6t',
  'cmpdnegbb000nh6kf94vzdq3a',
  'cmpdnegay000lh6kf6o167s8b',
  'cmpdnegar000jh6kfvrqqxo58',
  'cmpdnegae000hh6kfr5k0760u',
  'cmpdnega6000fh6kftyckvz43',
  'cmpdneg9c000dh6kf6h7g1hu1',
  'cmpdneg94000bh6kflhd0j41i',
  'cmpdneg8r0009h6kforaeu5qp',
  'cmpdneg8j0007h6kfr2l36e9i',
  'cmpdneg7z0005h6kfz3li3bfa',
  'cmpdneg7l0003h6kfubgtv56e',
  'cmpdneg4z0001h6kfuvmnwckw',
  'cmpdn3mdq000tqewfgjszi5zb',
  'cmpdn3mdn000rqewf5la5rnep',
  'cmpdn3mdl000pqewfdnllbbks',
  'cmpdn3mdh000nqewf1ub0zdu7',
  'cmpdn3mdf000lqewf0zljnxyd',
  'cmpdn3mda000jqewf4e2ifmja',
] as const;

interface CachedAnalysisEntry {
  promptVersion: string;
  generatedAt: string;
  payload: unknown;
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

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const localeArg = getArg('locale');
  const dryRun = process.argv.includes('--dry-run');

  const locales: Locale[] =
    localeArg === 'zh' ? ['zh'] : localeArg === 'en' ? ['en'] : ['zh', 'en'];

  logger.log(
    `Bootstrapping Nest context · cases=${DOGFOOD_CASE_IDS.length} locales=${locales.join(',')} dryRun=${dryRun}`,
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const essayAi = app.get(EssayAiService);

    const cases = await prisma.admissionCase.findMany({
      where: { id: { in: [...DOGFOOD_CASE_IDS] } },
      select: {
        id: true,
        essayContent: true,
        essayPrompt: true,
        aiAnalysisCache: true,
        school: { select: { name: true } },
      },
    });

    if (cases.length !== DOGFOOD_CASE_IDS.length) {
      const foundIds = new Set(cases.map((c) => c.id));
      const missing = DOGFOOD_CASE_IDS.filter((id) => !foundIds.has(id));
      logger.warn(
        `Found ${cases.length}/${DOGFOOD_CASE_IDS.length} cases. Missing: ${missing.join(', ')}`,
      );
    }

    logger.log(
      `PARAGRAPH_PROMPT_VERSION=${PARAGRAPH_PROMPT_VERSION}; processing ${cases.length} cases`,
    );

    let written = 0;
    let skipped = 0;
    let errored = 0;
    let cachedAtEnd = 0;

    for (const c of cases) {
      if (!c.essayContent || c.essayContent.length < 200) {
        logger.warn(`Skip case=${c.id} — essayContent missing or too short`);
        skipped++;
        continue;
      }

      let blob: unknown = c.aiAnalysisCache;
      let touched = false;

      for (const locale of locales) {
        const existing = readCacheEntry(blob, locale);
        if (existing && existing.promptVersion === PARAGRAPH_PROMPT_VERSION) {
          continue;
        }
        if (dryRun) {
          logger.log(`[dry-run] would analyze case=${c.id} locale=${locale}`);
          touched = true;
          continue;
        }
        try {
          const analysis = await essayAi.analyzeEssayParagraphs(
            c.essayContent,
            c.essayPrompt || undefined,
            c.school?.name,
            locale,
          );
          blob = mergeEntry(blob, locale, {
            promptVersion: PARAGRAPH_PROMPT_VERSION,
            generatedAt: new Date().toISOString(),
            payload: analysis as unknown,
          });
          touched = true;
          written++;
        } catch (err) {
          errored++;
          logger.error(
            `Analyze failed case=${c.id} locale=${locale}: ${(err as Error).message}`,
          );
        }
      }

      if (touched && !dryRun) {
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
    }

    // Re-count what's actually cached for reporting.
    const after = await prisma.admissionCase.count({
      where: {
        id: { in: [...DOGFOOD_CASE_IDS] },
        aiAnalysisCache: { not: { equals: null as never } },
      },
    });
    cachedAtEnd = after;

    logger.log(
      `Done. written=${written} skipped=${skipped} errored=${errored} cachedAtEnd=${cachedAtEnd}/${DOGFOOD_CASE_IDS.length}`,
    );
    if (cachedAtEnd < DOGFOOD_CASE_IDS.length && !dryRun) {
      logger.warn(
        `Only ${cachedAtEnd}/${DOGFOOD_CASE_IDS.length} dogfood cases have aiAnalysisCache populated. Class-6 context will be empty for the rest.`,
      );
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
