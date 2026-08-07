/**
 * The gate that watches the gates.
 *
 * This repo runs ~85 checks — 19 `scripts/check-*.ts`, 32 inline quality rules,
 * 16 governance rules, 3 ratchets, 16 CI jobs. Every one of them is code, and
 * none of them had a test. That is not a hypothetical worry; in a single
 * session it produced:
 *
 *   - `check-migration-safety --new-only` looking for migrations with a git
 *     command that cannot see new files. Printed "✅ No migration files to
 *     check" on every pre-push, for as long as it had existed.
 *   - `check-client-closure` invoked only as `--self-test`, so it exercised its
 *     own fixtures and never once scanned this repo.
 *   - CI's web unit-test step running `vitest run` without `--coverage`, so the
 *     coverage floor the ratchet so carefully protects had never been evaluated.
 *   - `pull_request.branches` naming branch prefixes this repo has never used
 *     and omitting the ones it does, so stacked PRs got zero jobs while
 *     `gh pr checks` still showed green.
 *   - `list-query-needs-keep-previous` carrying 42 findings of which about a
 *     third were wrong, so nobody read it and the real ones went unfixed.
 *
 * Every one passed continuously. That is the shape of the failure: in shell,
 * in JS truthiness, in a linter, in cron — "nothing happened" and "everything
 * is fine" are encoded identically. Absence of evidence renders as evidence of
 * absence, and both look like success.
 *
 * ## What this does
 *
 * A gate is PROVEN when `scripts/gate-proofs/<name>.proof.ts` exists AND its
 * `prove()` runs clean. A proof seeds a real violation, runs the real gate as a
 * subprocess, and asserts it goes red — the loop that is otherwise done by hand
 * and forgotten. Because this runs the proofs rather than merely counting
 * files, a proof that proves nothing fails here too.
 *
 * ## Why a ratchet and not a requirement
 *
 * Demanding all 19 at once would mean writing 19 proofs before landing any, and
 * the change would never land. `scripts/gate-proof-baseline.json` records how
 * many are unproven today; the number may only go DOWN. Same bargain as the
 * coverage, type-escape and file-size ratchets.
 *
 * ponytail: proofs run as subprocesses and some gates are slow, so this is not
 * a per-commit check — it belongs in `lint:all` and pre-push, not pre-commit.
 *
 * Usage:
 *   tsx scripts/check-gate-proofs.ts            # verify (CI, lint:all)
 *   tsx scripts/check-gate-proofs.ts --update   # lock in newly written proofs
 */
import * as fs from 'fs';
import * as path from 'path';
import { resetAssertionCounter, firedAssertions } from './gate-proofs/harness';

const ROOT = path.resolve(__dirname, '..');
const GATE_DIR = path.join(ROOT, 'scripts');
const PROOF_DIR = path.join(GATE_DIR, 'gate-proofs');
const BASELINE_FILE = path.join(GATE_DIR, 'gate-proof-baseline.json');
const UPDATE = process.argv.includes('--update');

/**
 * This file is the watcher, not one of the watched.
 *
 * ⚠️ Which means it has no proof, and cannot easily have one: `runGate` spawns
 * `npx tsx scripts/check-gate-proofs.ts`, so a self-proof would re-enter the
 * whole suite and recurse. The gap is real — on 2026-08-06 this runner counted
 * `export async function prove() {}` as PROVEN, and nothing but reading it
 * would have said so. The expectFired floor below closes that specific hole;
 * removing the floor would be silent again.
 *
 * If you touch the PROVEN/BROKEN decision, seed a vacuous proof by hand and
 * confirm it reddens before you believe the green tick:
 *
 *   printf 'export async function prove(){}' > scripts/gate-proofs/check-cron-manifest.proof.ts
 *   pnpm lint:gate-proofs   # must fail
 *   git checkout -- scripts/gate-proofs/check-cron-manifest.proof.ts
 */
const SELF = 'check-gate-proofs.ts';

function gateScripts(): string[] {
  return fs
    .readdirSync(GATE_DIR)
    .filter((f) => f.startsWith('check-') && f.endsWith('.ts') && f !== SELF)
    .sort();
}

interface Baseline {
  _comment?: string;
  [key: string]: unknown;
  unproven?: number;
}

async function main(): Promise<void> {
  const gates = gateScripts();
  const proven: string[] = [];
  const unproven: string[] = [];
  const broken: string[] = [];

  for (const gate of gates) {
    const name = gate.replace(/\.ts$/, '');
    const proofPath = path.join(PROOF_DIR, `${name}.proof.ts`);
    if (!fs.existsSync(proofPath)) {
      unproven.push(name);
      continue;
    }
    try {
      const mod = (await import(proofPath)) as { prove?: () => Promise<void> };
      if (typeof mod.prove !== 'function') {
        broken.push(`${name}: proof file exports no \`prove()\``);
        continue;
      }
      resetAssertionCounter();
      await mod.prove();
      if (firedAssertions() === 0) {
        // A proof that never made the gate go red has demonstrated nothing.
        // `export async function prove() {}` used to count as PROVEN and lower
        // the unproven count — coverage claimed for a gate nobody had tested,
        // with a green tick printed over it.
        broken.push(
          `${name}: prove() completed without a single expectFired() — it never made ` +
            `the gate go red, so it demonstrates nothing. Seed a violation and assert ` +
            `the gate catches it; expectClean alone only says a green tree is green.`
        );
        continue;
      }
      proven.push(name);
    } catch (error) {
      broken.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // A proof that fails is worse than no proof: it claims coverage that is not
  // there. Always fatal, never ratcheted.
  if (broken.length > 0) {
    console.error('\n❌ Gate proof(s) failed:\n');
    for (const b of broken) console.error(`   ${b}\n`);
    console.error(
      '   A red proof means the gate did NOT go red on a seeded violation —\n' +
        '   so it is not checking what it claims to check.\n'
    );
    process.exit(1);
  }

  const baseline = fs.existsSync(BASELINE_FILE)
    ? (JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Baseline)
    : undefined;

  if (UPDATE) {
    const notes = Object.fromEntries(
      Object.entries(baseline ?? {}).filter(([k]) => k.startsWith('_'))
    );
    const out = {
      _comment:
        (notes._comment as string | undefined) ??
        'One-way ceiling on gates that have never been proven to fail. `check-gate-proofs.ts` runs every `scripts/gate-proofs/<gate>.proof.ts` and fails when this number RISES. Writing a proof lowers it; run `pnpm lint:gate-proofs --update` to lock the win. Raising it requires editing this file in the same PR — which is the point.',
      ...notes,
      unproven: Math.min(unproven.length, baseline?.unproven ?? Infinity),
    };
    fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(out, null, 2)}\n`);
    console.log(`✅ Gate-proof baseline written: ${out.unproven} unproven of ${gates.length}.`);
    return;
  }

  if (!baseline || typeof baseline.unproven !== 'number') {
    console.error(
      `❌ ${path.relative(ROOT, BASELINE_FILE)} missing or malformed — run with --update to seed it.`
    );
    process.exit(1);
  }

  if (unproven.length > baseline.unproven) {
    console.error('\n❌ Gate-proof ratchet failed:\n');
    console.error(
      `   Unproven gates: ${baseline.unproven} → ${unproven.length} (+${unproven.length - baseline.unproven}).\n` +
        `   A new gate landed without a proof that it goes red on a violation.\n` +
        `   Write scripts/gate-proofs/<gate>.proof.ts — see harness.ts and the\n` +
        `   existing proofs; each is about ten lines.\n\n` +
        `   Still unproven:\n${unproven.map((u) => `     ${u}`).join('\n')}\n`
    );
    process.exit(1);
  }

  const line = `${proven.length} proven, ${unproven.length} unproven of ${gates.length}`;
  if (unproven.length < baseline.unproven) {
    console.log(`✅ Gate proofs hold — and improved: ${line}`);
    console.log(
      `   ${baseline.unproven} → ${unproven.length}. Run \`pnpm lint:gate-proofs --update\` to lock it in.`
    );
  } else {
    console.log(`✅ Gate proofs hold: ${line}`);
  }
}

void main();
