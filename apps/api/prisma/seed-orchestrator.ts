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
    name: '1/11  Main seed (schools / competitions / deadlines / teams)',
    cmd: 'npx tsx prisma/seed.ts',
  },
  {
    name: '2/11  Prediction closure (School / HighSchool CDS fields)',
    cmd: 'npx tsx prisma/seeds/seed-prediction-closure.ts',
  },
  {
    name: '3/11  CDS admit bands — build merged payload',
    cmd: 'npx tsx prisma/seeds/build-cds-admit-bands.ts',
  },
  {
    name: '3/11  CDS admit bands — apply (SchoolCdsAdmitBand)',
    cmd: 'npx tsx scripts/load-cds-bands.ts --file prisma/seeds/data/cds-admit-bands.json --apply',
  },
  {
    name: '4/11  World rankings — QS / THE / ARWU / FORBES / WSJ (SchoolRanking)',
    cmd: 'npx tsx scripts/closure-agents/collect-school-rankings.ts',
  },
  {
    name: '5/11  US_NEWS ranking-list backfill (SchoolRanking)',
    cmd: 'npx tsx scripts/backfill-school-ranking-lists.ts',
  },
  {
    name: '6/11  High schools (~150 reference HighSchool rows)',
    cmd: 'npx tsx prisma/seed-high-schools.ts',
  },
  {
    name: '7/11  School programs — all US schools (SchoolProgram)',
    cmd: 'npx tsx scripts/seed-school-programs.ts --all',
  },
  {
    name: '8/11  Essay prompts — top-50 (EssayPrompt)',
    cmd: 'npx tsx prisma/seed-essay-prompts-v2.ts',
  },
  {
    name: '9/11  Activity templates (ActivityTemplate)',
    cmd: 'npx tsx prisma/seed-activity-templates.ts',
  },
  {
    name: '10/11 Closure targets — scan DB (ClosureTarget)',
    cmd: 'npx tsx scripts/closure-agents/seed-closure-targets.ts',
  },
  {
    name: '11/11 Top-school admission cases (AdmissionCase)',
    cmd: 'npx tsx prisma/seeds/load-top-cases.ts',
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
