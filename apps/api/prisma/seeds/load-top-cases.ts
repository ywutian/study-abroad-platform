#!/usr/bin/env tsx
/**
 * load-top-cases.ts
 *
 * Idempotent loader for the committed top-school admission-case library
 * (`scripts/top50-cases.json`, ~933 cases). Part of the Tier-1 seed
 * orchestrator.
 *
 * The JSON ships each case with a stable `id` (a real cuid). We use that `id`
 * directly as the `AdmissionCase` primary key, which makes the load a pure
 * `upsert` keyed on a stable field — re-running never produces duplicates.
 *
 * Cases are attached to a dedicated system user and marked
 * `visibility = ANONYMOUS` + `reviewStatus = APPROVED` so they surface in the
 * public case galleries. Schools are matched by English name (via `nameNorm`)
 * with a Chinese-name fallback; unmatched cases are skipped (never fabricated).
 *
 * Usage:
 *   cd apps/api && pnpm exec tsx prisma/seeds/load-top-cases.ts
 */
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { PrismaClient, type AdmissionResult } from '@prisma/client';
import { normalizeSchoolName } from '@study-abroad/shared';

const prisma = new PrismaClient();

const CASES_FILE = path.join(__dirname, '../../scripts/top50-cases.json');
const IMPORT_BATCH_ID = 'tier1-top50-cases';
const SYSTEM_USER_EMAIL = 'top-cases@system.local';

interface RawCase {
  id: string;
  school: string;
  schoolEn?: string;
  year: number;
  result: string;
  round?: string | null;
  major?: string | null;
  gpa?: string | null;
  sat?: string | null;
  act?: string | null;
  toefl?: string | null;
  tags?: string[];
}

const VALID_RESULTS = new Set<AdmissionResult>([
  'ADMITTED',
  'REJECTED',
  'WAITLISTED',
  'DEFERRED',
]);

async function main() {
  if (!existsSync(CASES_FILE)) {
    console.error(`ERROR: cases file not found: ${CASES_FILE}`);
    process.exit(1);
  }

  const parsed = JSON.parse(readFileSync(CASES_FILE, 'utf8')) as {
    cases?: RawCase[];
  };
  const cases = parsed.cases ?? [];
  if (cases.length === 0) {
    console.error('ERROR: top50-cases.json has no `cases` array');
    process.exit(1);
  }

  // Dedicated system user for the committed case library.
  const systemUser = await prisma.user.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    update: {},
    create: {
      email: SYSTEM_USER_EMAIL,
      passwordHash: 'seed-no-login',
      role: 'USER',
    },
  });

  let upserted = 0;
  let skippedNoSchool = 0;
  let skippedBadResult = 0;

  for (const c of cases) {
    const result = (c.result ?? '').toUpperCase() as AdmissionResult;
    if (!VALID_RESULTS.has(result)) {
      skippedBadResult++;
      continue;
    }

    const englishName = c.schoolEn ?? c.school;
    const nameNorm = normalizeSchoolName(englishName);
    let school = await prisma.school.findUnique({ where: { nameNorm } });
    if (!school && c.school) {
      school = await prisma.school.findFirst({
        where: { nameZh: { contains: c.school, mode: 'insensitive' } },
      });
    }
    if (!school) {
      skippedNoSchool++;
      continue;
    }

    const data = {
      userId: systemUser.id,
      schoolId: school.id,
      year: c.year ?? new Date().getFullYear(),
      round: c.round ?? null,
      result,
      major: c.major ?? null,
      gpaRange: c.gpa ?? null,
      satRange: c.sat ?? null,
      actRange: c.act ?? null,
      toeflRange: c.toefl ?? null,
      tags: Array.isArray(c.tags) ? c.tags : [],
      visibility: 'ANONYMOUS' as const,
      reviewStatus: 'APPROVED' as const,
      source: 'manual',
      importBatchId: IMPORT_BATCH_ID,
    };

    await prisma.admissionCase.upsert({
      where: { id: c.id },
      update: data,
      create: { id: c.id, ...data },
    });
    upserted++;
  }

  console.log(
    `top-cases: ${upserted} upserted, ` +
      `${skippedNoSchool} skipped (school unmatched), ` +
      `${skippedBadResult} skipped (bad result)`,
  );

  if (upserted === 0) {
    console.error('ERROR: no admission cases loaded');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
