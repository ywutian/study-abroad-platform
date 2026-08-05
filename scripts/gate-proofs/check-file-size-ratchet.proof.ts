import * as fs from 'fs';
import * as path from 'path';
import { ROOT, runGate, withSeededViolation, expectClean, expectFired } from './harness';

/**
 * Two things, because this gate has failed in two different ways.
 *
 *  1. It must go red when a package grows past its baseline. Straightforward.
 *  2. `--update` must NOT eat the `_`-prefixed notes. It used to rebuild the
 *     file as `{_comment, ...counts}`, dropping every per-target note — and
 *     those notes are the only record of WHY a number was ever raised, i.e.
 *     the only thing that makes a raised baseline reviewable. One `--update`
 *     silently deleted the rationale for every previous raise.
 */
const BASELINE = 'scripts/file-size-baseline.json';

export async function prove(): Promise<void> {
  expectClean(runGate('check-file-size-ratchet.ts'));

  // (1) grow a package past its baseline
  const big = `${'// seeded overage line\n'.repeat(900)}export const seeded = 1;\n`;
  await withSeededViolation('scripts/__gate_proof_big_file.ts', big, () =>
    expectFired(runGate('check-file-size-ratchet.ts'), 'overage')
  );

  // (2) --update preserves the notes
  const abs = path.join(ROOT, BASELINE);
  const before = JSON.parse(fs.readFileSync(abs, 'utf8')) as Record<string, unknown>;
  const notesBefore = Object.keys(before).filter((k) => k.startsWith('_'));
  if (notesBefore.length < 2) {
    throw new Error(
      `${BASELINE} carries fewer than two \`_\` notes, so this half of the proof ` +
        `cannot demonstrate anything. Seed one before trusting it.`
    );
  }

  const original = fs.readFileSync(abs, 'utf8');
  try {
    runGate('check-file-size-ratchet.ts', ['--update']);
    const after = JSON.parse(fs.readFileSync(abs, 'utf8')) as Record<string, unknown>;
    const lost = notesBefore.filter((k) => !(k in after));
    if (lost.length > 0) {
      throw new Error(
        `--update dropped rationale note(s): ${lost.join(', ')}. ` +
          `A baseline whose raises have no recorded reason is not reviewable.`
      );
    }
  } finally {
    fs.writeFileSync(abs, original);
  }
}
