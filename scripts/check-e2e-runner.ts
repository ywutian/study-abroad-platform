/**
 * Playwright spec runner inventory.
 *
 * A spec that lives under `e2e/` but is never named in a GitHub workflow is
 * not a test — it is a document. `e2e/full-ui-surface.spec.ts` (~1200 lines)
 * and several siblings sat that way: local `package.json` scripts existed,
 * PR CI ran only `e2e/core-pages.spec.ts`, and nothing said the rest were
 * deliberately non-CI.
 *
 * A spec is OK when either:
 *   1. Some `.github/workflows/*.yml` mentions `e2e/<name>.spec.ts` (a real
 *      runner — PR, nightly, whatever), or
 *   2. It is listed in `e2e/non-ci-allowlist.json` (an explicit declaration
 *      that it is not CI).
 *
 * `e2e/manual/` is ignored (the other way to declare non-CI: move the file).
 * A local package.json script is not a runner — that is how the 1770-line
 * hole looked "covered".
 *
 * Usage: tsx scripts/check-e2e-runner.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const E2E_DIR = path.join(ROOT, 'e2e');
const ALLOWLIST_FILE = path.join(E2E_DIR, 'non-ci-allowlist.json');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');

interface Allowlist {
  _comment?: string;
  specs?: string[];
}

function walkSpecs(dir: string, relPrefix: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'manual' && entry.isDirectory()) continue;
    const rel = `${relPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...walkSpecs(path.join(dir, entry.name), rel));
    } else if (entry.name.endsWith('.spec.ts')) {
      out.push(rel.replace(/\\/g, '/'));
    }
  }
  return out.sort();
}

function workflowCorpus(): string {
  if (!fs.existsSync(WORKFLOWS_DIR)) return '';
  return fs
    .readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => fs.readFileSync(path.join(WORKFLOWS_DIR, f), 'utf8'))
    .join('\n');
}

function loadAllowlist(): string[] {
  if (!fs.existsSync(ALLOWLIST_FILE)) {
    throw new Error(
      `${path.relative(ROOT, ALLOWLIST_FILE)} is missing. Specs without a ` +
        `workflow runner must be declared there, or the inventory cannot tell ` +
        `an accidental orphan from a deliberate non-CI spec.`
    );
  }
  const parsed = JSON.parse(fs.readFileSync(ALLOWLIST_FILE, 'utf8')) as Allowlist;
  if (!Array.isArray(parsed.specs)) {
    throw new Error(`${path.relative(ROOT, ALLOWLIST_FILE)} is missing a "specs" array.`);
  }
  return parsed.specs;
}

function main(): void {
  const specs = walkSpecs(E2E_DIR, 'e2e');
  const corpus = workflowCorpus();
  const allowlist = loadAllowlist();
  const allowSet = new Set(allowlist);
  const errors: string[] = [];

  if (new Set(allowlist).size !== allowlist.length) {
    errors.push('e2e/non-ci-allowlist.json has duplicate entries.');
  }

  for (const entry of allowlist) {
    if (!specs.includes(entry)) {
      errors.push(
        `Allowlist names ${entry}, but that spec does not exist under e2e/ ` +
          `(or it lives in e2e/manual/, which is already excluded).`
      );
    }
  }

  for (const spec of specs) {
    const inWorkflow = corpus.includes(spec);
    const declaredNonCi = allowSet.has(spec);
    if (inWorkflow && declaredNonCi) {
      errors.push(
        `${spec} is named in a GitHub workflow AND in e2e/non-ci-allowlist.json. ` +
          `Pick one: it has a runner, so take it off the allowlist.`
      );
      continue;
    }
    if (!inWorkflow && !declaredNonCi) {
      errors.push(
        `${spec} has no GitHub workflow runner and is not in e2e/non-ci-allowlist.json. ` +
          `Either name it in a workflow (PR CI smoke is e2e/core-pages.spec.ts — do not ` +
          `dump a 1000-line suite into PR CI), or declare it non-CI in the allowlist. ` +
          `A package.json script is not enough.`
      );
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ Playwright spec runner inventory failed:\n');
    for (const e of errors) console.error(`   ${e}\n`);
    process.exit(1);
  }

  const ciCount = specs.filter((s) => corpus.includes(s)).length;
  console.log(
    `✅ Playwright specs have a runner or a non-CI declaration: ` +
      `${ciCount} in workflows, ${allowlist.length} allowlisted, ${specs.length} total.`
  );
}

main();
