#!/usr/bin/env tsx
/**
 * Parse legacy range-string fields on AdmissionCase into structured
 * columns (`gpa11`, `testScores[]` JSON, `gpaScale`).
 *
 * Motivation
 * ----------
 * /admin/prediction-workflow/data-inventory shows 1,235 approved cases
 * but `casesWithGpa11 = 0` and `casesWithTestScores = 0`. Every import
 * path populates the legacy `gpaRange` / `satRange` / `actRange` /
 * `toeflRange` strings without also writing the structured columns the
 * ML feature vector and Scorecard teacher actually read. This script
 * performs a one-time catch-up.
 *
 * Safety
 * ------
 *   - Only writes fields that are currently NULL; never overwrites a
 *     counselor-entered structured score.
 *   - Uses the pure parsers in `src/modules/prediction/utils/
 *     legacy-case-parser.ts` (covered by 32 unit tests). Gibberish
 *     input → null → skip, no invented data.
 *   - `--dry-run` prints counts + a preview without touching the DB.
 *
 * Idempotent: re-running after a partial success just picks up where it
 * left off (Prisma filter only loads cases that still have NULL targets).
 */

import { PrismaClient, Prisma } from '@prisma/client';
import {
  parseGpaRange,
  parseTestScoreRange,
  toTestScoreEntry,
  type NormalizedTestScoreEntry,
} from '../src/modules/prediction/utils/legacy-case-parser';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const verbose = process.argv.includes('--verbose');

  console.log(
    `[normalize-legacy-cases] Starting ${dryRun ? '(DRY RUN)' : '(LIVE)'}...`,
  );

  const cases = await prisma.admissionCase.findMany({
    where: {
      reviewStatus: { in: ['AUTO_APPROVED', 'APPROVED'] },
      OR: [
        { gpaRange: { not: null }, gpa11: null },
        // testScores is a nullable JSON column. Prisma filters nullable JSON
        // with `{ equals: DbNull }` (DB NULL) rather than the `JsonNull`
        // literal (which refers to the JSON value `null` stored in the column).
        { satRange: { not: null }, testScores: { equals: Prisma.DbNull } },
        { actRange: { not: null }, testScores: { equals: Prisma.DbNull } },
        { toeflRange: { not: null }, testScores: { equals: Prisma.DbNull } },
      ],
    },
    select: {
      id: true,
      gpaRange: true,
      gpa11: true,
      gpaScale: true,
      satRange: true,
      actRange: true,
      toeflRange: true,
      testScores: true,
    },
  });

  console.log(
    `[normalize-legacy-cases] Loaded ${cases.length} cases with at least one unparsed legacy field`,
  );

  let gpaWritten = 0;
  let testScoresWritten = 0;
  const parseFailures: Array<{ id: string; field: string; value: string }> = [];

  for (const c of cases) {
    const updates: {
      gpa11?: number;
      gpaScale?: number;
      testScores?: NormalizedTestScoreEntry[];
    } = {};

    if (c.gpaRange && c.gpa11 == null) {
      const parsed = parseGpaRange(c.gpaRange);
      if (parsed) {
        updates.gpa11 = parsed.gpa;
        if (c.gpaScale == null) updates.gpaScale = parsed.scale;
      } else {
        parseFailures.push({ id: c.id, field: 'gpaRange', value: c.gpaRange });
      }
    }

    if (c.testScores === null) {
      const entries: NormalizedTestScoreEntry[] = [];
      const tryAdd = (raw: string | null, type: 'SAT' | 'ACT' | 'TOEFL') => {
        if (!raw) return;
        const parsed = parseTestScoreRange(raw, type);
        if (parsed) entries.push(toTestScoreEntry(parsed));
        else
          parseFailures.push({
            id: c.id,
            field: `${type.toLowerCase()}Range`,
            value: raw,
          });
      };
      tryAdd(c.satRange, 'SAT');
      tryAdd(c.actRange, 'ACT');
      tryAdd(c.toeflRange, 'TOEFL');
      if (entries.length > 0) updates.testScores = entries;
    }

    if (!updates.gpa11 && !updates.gpaScale && !updates.testScores) continue;

    if (updates.gpa11 != null) gpaWritten++;
    if (updates.testScores) testScoresWritten++;

    if (verbose && gpaWritten + testScoresWritten <= 10) {
      console.log(
        `  ${c.id}:`,
        JSON.stringify({
          gpa11: updates.gpa11,
          gpaScale: updates.gpaScale,
          testScores: updates.testScores,
        }),
      );
    }

    if (!dryRun) {
      await prisma.admissionCase.update({
        where: { id: c.id },
        data: {
          ...(updates.gpa11 != null ? { gpa11: updates.gpa11 } : {}),
          ...(updates.gpaScale != null ? { gpaScale: updates.gpaScale } : {}),
          ...(updates.testScores
            ? {
                testScores:
                  updates.testScores as unknown as Prisma.InputJsonValue,
              }
            : {}),
        },
      });
    }
  }

  console.log(
    `[normalize-legacy-cases] ${dryRun ? 'Would write' : 'Wrote'} gpa11 for ${gpaWritten} cases, testScores[] for ${testScoresWritten} cases.`,
  );
  if (parseFailures.length > 0) {
    console.log(
      `[normalize-legacy-cases] ${parseFailures.length} parse failures (not fatal — gibberish inputs skipped):`,
    );
    for (const f of parseFailures.slice(0, 10)) {
      console.log(`  ${f.id} | ${f.field} = ${JSON.stringify(f.value)}`);
    }
    if (parseFailures.length > 10) {
      console.log(`  ...and ${parseFailures.length - 10} more`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('[normalize-legacy-cases] Failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
