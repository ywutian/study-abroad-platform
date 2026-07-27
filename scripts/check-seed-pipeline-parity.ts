/**
 * Seed-pipeline parity guard.
 *
 * Each production seed lives in THREE hand-maintained places that must agree:
 *   1. apps/api/migrate.sh   — `run_seed "label" ./prisma/<x>.js` (what prod RUNS)
 *   2. apps/api/Dockerfile   — `npx tsc … prisma/<x>.ts …`        (what gets COMPILED into the image)
 *   3. the .ts source on disk
 *
 * When a new seed is added to migrate.sh but missed in the Dockerfile compile
 * list, the .js never exists in the --prod image, migrate.sh's `[ -f ]` guard
 * prints a NON-fatal warning, and the deploy proceeds green — a silent prod data
 * gap. This recurred across #246 / #296 / 0eea4fb1 / 1392ebf0.
 *
 * This guard asserts the load-bearing direction: every seed migrate.sh runs has a
 * matching .ts in the Dockerfile compile list AND on disk. Pure static text
 * parsing — zero deploy/DB risk, fully local. See docs/DEPLOY_CONFIG.md.
 *
 * Usage: tsx scripts/check-seed-pipeline-parity.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const API = path.join(ROOT, 'apps/api');
const MIGRATE_SH = path.join(API, 'migrate.sh');
const DOCKERFILE = path.join(API, 'Dockerfile');

/** `run_seed "label" ./prisma/<x>.js` → "prisma/<x>" (extension-less, ./-stripped). */
function migrateSeedStems(): { stem: string; raw: string }[] {
  const text = fs.readFileSync(MIGRATE_SH, 'utf8');
  const out: { stem: string; raw: string }[] = [];
  for (const m of text.matchAll(/run_seed\s+"[^"]*"\s+(\.?\/?\S+\.js)\b/g)) {
    const raw = m[1];
    const stem = raw.replace(/^\.\//, '').replace(/\.js$/, '');
    out.push({ stem, raw });
  }
  return out;
}

/** Every `prisma/<x>.ts` argument across the Dockerfile's `npx tsc …` passes → "prisma/<x>". */
function dockerfileCompiledStems(): Set<string> {
  const text = fs.readFileSync(DOCKERFILE, 'utf8');
  const set = new Set<string>();
  for (const m of text.matchAll(/\b(prisma\/[^\s\\]+)\.ts\b/g)) {
    set.add(m[1]);
  }
  return set;
}

function main() {
  const errors: string[] = [];
  for (const f of [MIGRATE_SH, DOCKERFILE]) {
    if (!fs.existsSync(f)) {
      console.error(`❌ Missing ${path.relative(ROOT, f)} — has the deploy pipeline moved?`);
      process.exit(1);
    }
  }

  const seeds = migrateSeedStems();
  if (seeds.length === 0) {
    console.error('❌ No `run_seed … .js` lines found in migrate.sh — parser drift?');
    process.exit(1);
  }
  const compiled = dockerfileCompiledStems();

  for (const { stem, raw } of seeds) {
    // 1. The .ts source must exist on disk.
    const tsAbs = path.join(API, `${stem}.ts`);
    if (!fs.existsSync(tsAbs)) {
      errors.push(`migrate.sh runs ${raw} but apps/api/${stem}.ts does not exist on disk.`);
    }
    // 2. It must be in the Dockerfile compile list, or its .js won't exist in the prod image.
    if (!compiled.has(stem)) {
      errors.push(
        `migrate.sh runs ${raw} but apps/api/${stem}.ts is NOT in the Dockerfile tsc compile list — ` +
          `the .js will be missing in the --prod image (silent seed skip). Add it to the Dockerfile.`
      );
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ Seed-pipeline parity broken:\n');
    for (const e of errors) console.error('   ' + e);
    console.error(
      '\nEvery seed migrate.sh runs must be compiled into the image (Dockerfile) and exist on disk.\n'
    );
    process.exit(1);
  }
  console.log(
    `✅ Seed pipeline in parity: all ${seeds.length} migrate.sh seeds are compiled in the Dockerfile + present on disk.`
  );

  checkFixtureRegenRebuildsShared();
}

/**
 * Second guard, same family: a workflow that regenerates a package's SOURCE
 * must rebuild that package before anything consumes it.
 *
 * `gold:fixtures` rewrites
 * packages/shared/src/fixtures/application-analysis-render.data.ts. The two
 * consumers resolve @study-abroad/shared differently — the web app takes the
 * `import` condition and gets the fresh .ts, the Playwright specs run under
 * Node and get dist. Without a rebuild in between they disagree: the page
 * renders the new data while the spec asserts against the old
 * expectedSchoolOrder, and the failure reads as a product bug with nothing
 * behind it.
 *
 * ci.yml's governance job always rebuilt; the nightly did not, and the drift
 * sat there until the first change to the analysis output exposed it.
 */
function checkFixtureRegenRebuildsShared(): void {
  const dir = path.join(ROOT, '.github/workflows');
  const errors: string[] = [];
  let checked = 0;

  for (const file of fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
    const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!/gold:fixtures/.test(lines[i])) continue;
      checked++;
      const after = lines.slice(i + 1).join('\n');
      if (!/@study-abroad\/shared\s+build/.test(after)) {
        errors.push(
          `${file}:${i + 1} runs \`gold:fixtures\` but never rebuilds @study-abroad/shared afterwards — ` +
            `shared/dist keeps the committed fixture while the .ts source is regenerated, so the web app ` +
            `and the Playwright specs read different data.`
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ Fixture-regen parity broken:\n');
    for (const e of errors) console.error('   ' + e);
    console.error(
      '\nAdd a `pnpm --filter @study-abroad/shared build` step after the gold:fixtures step.\n'
    );
    process.exit(1);
  }
  console.log(
    `✅ Fixture regen in parity: all ${checked} gold:fixtures step(s) rebuild @study-abroad/shared afterwards.`
  );
}

main();
