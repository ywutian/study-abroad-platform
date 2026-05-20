#!/usr/bin/env tsx
/**
 * seed-orchestrator.ts — Tier-1 unified US-data seed orchestrator.
 *
 * Runs every committed, offline, idempotent seed step IN ORDER. Each step is
 * shelled out via `npx tsx <script>` with `stdio: 'inherit'` so its output
 * streams live. The orchestrator stops with exit code 1 the moment any step
 * fails.
 *
 * This is what `pnpm --filter api db:seed` invokes. It is fully offline (no
 * network), reads only committed JSON payloads, and is safe to run twice — the
 * underlying scripts all upsert / skip-if-exists.
 *
 * Demo data (mock users / forum / demo cases) is intentionally NOT included
 * here — see `db:seed:demo` -> `prisma/seed-all-features.ts`.
 *
 * Usage:
 *   cd apps/api && pnpm exec tsx prisma/seed-orchestrator.ts
 */
import { execSync } from 'node:child_process';
import * as path from 'node:path';

const API_ROOT = path.join(__dirname, '..');

interface Step {
  name: string;
  /** Command run from API_ROOT. */
  cmd: string;
}

const STEPS: Step[] = [
  {
    // Main seed already builds the FULL unified US catalog: prisma/seed.ts
    // imports buildUnifiedCollegeCatalog() (scripts/lib/college-catalog.ts),
    // which merges all 7 committed school payloads — seed-top100,
    // seed-more-schools, seed-more-us-schools, seed-us-schools-141-200,
    // seed-uc-schools, seed-more-schools-expanded, seed-final-schools.
    // Those 300 raw entries dedup on nameNorm to 240 unique US schools, so the
    // standalone scripts add zero new rows here (verified: 0 created on a fresh
    // re-run). 300 is NOT reachable from committed data without fabricating
    // schools, so the catalog stays at 240 — see verify-seed.ts School (US).
    name: 'Main seed — full unified US catalog (240 schools) + competitions / deadlines / teams',
    cmd: 'npx tsx prisma/seed.ts',
  },
  {
    name: 'Prediction closure (School / HighSchool CDS fields)',
    cmd: 'npx tsx prisma/seeds/seed-prediction-closure.ts',
  },
  {
    name: 'CDS admit bands — build merged payload',
    cmd: 'npx tsx prisma/seeds/build-cds-admit-bands.ts',
  },
  {
    name: 'CDS admit bands — apply (SchoolCdsAdmitBand)',
    cmd: 'npx tsx prisma/seeds/load-cds-bands.ts --file prisma/seeds/data/cds-admit-bands.json --apply',
  },
  {
    name: 'World rankings — QS / THE / ARWU / FORBES / WSJ (SchoolRanking)',
    cmd: 'npx tsx prisma/seeds/closure-agents/collect-school-rankings.ts',
  },
  {
    name: 'US_NEWS ranking-list backfill (SchoolRanking)',
    cmd: 'npx tsx prisma/seeds/backfill-school-ranking-lists.ts',
  },
  {
    name: 'High schools (~150 reference HighSchool rows)',
    cmd: 'npx tsx prisma/seed-high-schools.ts',
  },
  {
    name: 'School programs — all US schools (SchoolProgram)',
    cmd: 'npx tsx prisma/seeds/seed-school-programs.ts --all',
  },
  {
    name: 'Essay prompts — top-50 (EssayPrompt)',
    cmd: 'npx tsx prisma/seed-essay-prompts-v2.ts',
  },
  {
    name: 'Activity templates (ActivityTemplate)',
    cmd: 'npx tsx prisma/seed-activity-templates.ts',
  },
  {
    name: 'Closure targets — scan DB (ClosureTarget)',
    cmd: 'npx tsx prisma/seeds/closure-agents/seed-closure-targets.ts',
  },
  {
    name: 'Top-school admission cases (AdmissionCase)',
    cmd: 'npx tsx prisma/seeds/load-top-cases.ts',
  },
  {
    // Phase C — public-archive essay gallery: imports ~185 anonymized essays
    // from committed data-*.ts files (JHU / Hamilton / MIT / Harvard /
    // PrepMaven / CollegeVine / Stanford / USC / CollegeEssayGuy / Shemmassian)
    // as AdmissionCase rows with visibility=ANONYMOUS, reviewStatus=APPROVED.
    // Idempotent: dedups on tag `source:<url>#<author>`.
    name: 'Essay gallery — public archive AdmissionCase import',
    cmd: 'npx tsx prisma/seeds/essay-harvest/import-essays.ts',
  },
  {
    name: 'Assessment question banks — MBTI / HOLLAND / STRENGTH (Assessment)',
    cmd: 'npx tsx prisma/seed-assessment.ts',
  },
];

async function main() {
  const startedAt = Date.now();
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Tier-1 US-data seed orchestrator');
  console.log(`  ${STEPS.length} steps · offline · idempotent`);
  console.log('═══════════════════════════════════════════════════════════');

  for (const [index, step] of STEPS.entries()) {
    console.log(`\n▶ Step ${index + 1}/${STEPS.length}: ${step.name}`);
    console.log(`  $ ${step.cmd}`);
    try {
      execSync(step.cmd, { stdio: 'inherit', cwd: API_ROOT });
    } catch {
      console.error(
        `\n✗ Seed orchestrator FAILED at step ${index + 1}: ${step.name}`,
      );
      process.exit(1);
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(
    `  ✓ Tier-1 seed complete — ${STEPS.length} steps in ${elapsed}s`,
  );
  console.log('  Next: pnpm --filter api db:verify:seed');
  console.log('═══════════════════════════════════════════════════════════');
}

main();
