/**
 * Seed-and-observe harness for proving a gate actually fails.
 *
 * Every guardrail in this repo passes on a clean tree. That says nothing: a
 * gate that scans zero files, matches nothing, or was never invoked passes
 * identically to one that is working. This session alone turned up
 * `check-migration-safety` whose `--new-only` could never see a migration,
 * `check-client-closure` invoked only as `--self-test`, a CI step running
 * `vitest run` without `--coverage` so no threshold was ever evaluated, and a
 * cron heartbeat whose base URL was never configured. All green the whole time.
 *
 * The only thing that separates "passes because it is correct" from "passes
 * because it is not looking" is breaking the input on purpose and watching the
 * gate go red. This automates exactly that loop.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export const ROOT = path.resolve(__dirname, '..', '..');

/** How a gate is invoked and what "it fired" looks like. */
export interface GateRun {
  /** Exit code. Non-zero is the usual "it fired". */
  status: number;
  stdout: string;
}

/**
 * Run a repo gate as a subprocess, the way CI does.
 *
 * Deliberately NOT importing the script and calling a function: several of
 * these gates only exist as `main()` side effects, and the thing worth proving
 * is what the command does, not what an internal helper returns.
 */
export function runGate(script: string, args: string[] = []): GateRun {
  try {
    const stdout = execFileSync('npx', ['tsx', path.join('scripts', script), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // Default is 1MB, and exceeding it KILLS the child and truncates the
      // capture — which reads as "gate fired but never mentioned the seeded
      // violation" when the mention was simply past the cut. A full
      // migration-safety scan is ~170KB today; 64MB means a capture problem
      // can no longer impersonate a gate problem.
      maxBuffer: 64 * 1024 * 1024,
    });
    return { status: 0, stdout };
  } catch (err) {
    const e = err as {
      status?: number | null;
      signal?: string | null;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };
    const text = (v?: string | Buffer) => (Buffer.isBuffer(v) ? v.toString('utf8') : (v ?? ''));
    // A signal kill (e.g. maxBuffer exceeded → SIGTERM) has status null. Say
    // so in the output instead of letting it pass as a plain non-zero exit.
    const signalNote = e.signal ? `\n[runGate: child killed by ${e.signal}]` : '';
    return {
      status: e.status ?? 1,
      stdout: `${text(e.stdout)}${text(e.stderr)}${signalNote}`,
    };
  }
}

/**
 * Write `content` over `relPath`, run `body`, and put the original back —
 * whatever happens, including a throw.
 *
 * Restores from an in-memory copy rather than git, so a proof cannot be
 * defeated by an unrelated dirty tree, and asserts the restore landed. A
 * harness that corrupts the repo when a proof fails would be worse than no
 * harness.
 */
export async function withSeededViolation<T>(
  relPath: string,
  content: string,
  body: () => Promise<T> | T
): Promise<T> {
  const abs = path.join(ROOT, relPath);
  const original = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;

  let result: T | undefined;
  let bodyError: unknown;
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    result = await body();
  } catch (error) {
    bodyError = error;
  }

  // Restore outside try/finally on purpose: throwing from a `finally` discards
  // whatever `body()` threw, so a failed proof would surface as a restore
  // complaint and the real reason would be gone.
  let restoreError: string | null = null;
  try {
    if (original === null) {
      fs.rmSync(abs, { force: true });
    } else {
      fs.writeFileSync(abs, original);
      if (fs.readFileSync(abs, 'utf8') !== original) {
        restoreError = 'content did not match after write-back';
      }
    }
  } catch (error) {
    restoreError = error instanceof Error ? error.message : String(error);
  }

  if (bodyError) {
    // The proof's own failure is the headline; a restore problem alongside it
    // still has to be said, or the next command runs on a dirty tree.
    if (restoreError) {
      console.error(
        `⚠️  ALSO failed to restore ${relPath} (${restoreError}) — check the tree by hand.`
      );
    }
    throw bodyError;
  }
  if (restoreError) {
    throw new Error(
      `Proof harness failed to restore ${relPath}: ${restoreError}. Check the tree by hand.`
    );
  }
  return result as T;
}

/** Same, for editing a file in place rather than replacing it wholesale. */
export async function withPatchedFile<T>(
  relPath: string,
  patch: (original: string) => string,
  body: () => Promise<T> | T
): Promise<T> {
  const abs = path.join(ROOT, relPath);
  const original = fs.readFileSync(abs, 'utf8');
  const seeded = patch(original);
  if (seeded === original) {
    throw new Error(
      `Proof for ${relPath} seeded nothing — the patch did not change the file, ` +
        `so a "gate fired" result would prove nothing. Fix the proof, not the gate.`
    );
  }
  return withSeededViolation(relPath, seeded, body);
}

/**
 * How many times `expectFired` has run since the last reset.
 *
 * `check-gate-proofs.ts` counts a proof as PROVEN if `prove()` returns without
 * throwing — so until 2026-08-06 this was a passing proof:
 *
 *   export async function prove(): Promise<void> {}
 *
 * It lowered the unproven count, claimed coverage for a gate nobody had tested,
 * and the runner printed a green tick. Its own docstring says a false proof is
 * worse than no proof; it just had no way to tell one.
 *
 * A proof made only of `expectClean` is the same emptiness spelled longer — it
 * shows the gate is green on a green tree, which is not evidence of anything.
 * Demonstrating the gate can go RED is the whole job, so at least one
 * `expectFired` is the floor.
 */
let firedCount = 0;
export function resetAssertionCounter(): void {
  firedCount = 0;
}
export function firedAssertions(): number {
  return firedCount;
}

export function expectFired(run: GateRun, mustMention?: string): void {
  firedCount++;
  if (run.status === 0) {
    throw new Error(
      `Gate did NOT fire on a seeded violation (exit 0).\n--- output ---\n${run.stdout.slice(0, 800)}`
    );
  }
  if (mustMention && !run.stdout.includes(mustMention)) {
    // Show the TAIL as well as the head. The first version of this message
    // sliced the head only, and the one time it fired in CI the interesting
    // bytes were the last ~300 of a 167KB capture — the diagnostic hid exactly
    // the evidence needed to tell a truncated capture from a wrong gate.
    const head = run.stdout.slice(0, 600);
    const tail = run.stdout.length > 1200 ? run.stdout.slice(-600) : '';
    throw new Error(
      `Gate fired but never mentioned "${mustMention}" — it may be failing for an unrelated ` +
        `reason, which would make this proof green for the wrong cause.\n` +
        `--- captured ${run.stdout.length} bytes; head ---\n${head}` +
        (tail ? `\n--- tail ---\n${tail}` : '')
    );
  }
}

export function expectClean(run: GateRun): void {
  if (run.status !== 0) {
    throw new Error(
      `Gate is red on an unmodified tree, so this proof cannot tell you anything ` +
        `about the seeded violation. Fix the tree first.\n--- output ---\n${run.stdout.slice(0, 800)}`
    );
  }
}
