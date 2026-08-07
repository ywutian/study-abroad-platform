import { runGate, withPatchedFile, expectClean, expectFired } from './harness';

const SRC = 'apps/api/src/modules/prediction/outcome/outcome.service.ts';
const BASELINE = 'scripts/any-baseline.json';
const GATE = 'check-any-ratchet.ts';

const append = (line: string) => (s: string) => `${s}\n${line}\n`;

/**
 * Proof for `check-any-ratchet.ts`.
 *
 * It counted `: any` / `as any` / `<any>` and `@ts-ignore` / `@ts-expect-error`,
 * and treated that as the set of ways a type gets erased. Two commoner ones were
 * outside it, both found by probing on 2026-08-06:
 *
 *   // @ts-nocheck          ← removes checking from the WHOLE file, counted as 0
 *   x as unknown as Y       ← erases a type without ever naming `any`
 *
 * `@ts-nocheck` is the worse of the two by a distance: one line at the top of a
 * live service left the ratchet green. Production carried none, so closing it
 * cost nothing and leaving it open cost a file.
 *
 * The third seed is the one that generalises. Adding `doubleCast` to the counter
 * enforced NOTHING, because `current > baseline[metric]` compares against
 * `undefined` when the key is absent and `n > undefined` is false. Three seeded
 * violations passed without a murmur. **Adding a metric is not the same act as
 * enabling it**, and the gate now says so instead of passing.
 */
export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  await withPatchedFile(
    SRC,
    (s) => `// @ts-nocheck\n${s}`,
    () => expectFired(runGate(GATE), 'tsSuppress')
  );

  await withPatchedFile(SRC, append('const __probe = 0 as unknown as string;'), () =>
    expectFired(runGate(GATE), 'doubleCast')
  );

  await withPatchedFile(SRC, append('const __probe2 = {} as any;'), () =>
    expectFired(runGate(GATE), 'explicitAny')
  );

  await withPatchedFile(SRC, append('// @ts-ignore\nconst __probe3: number = "x";'), () =>
    expectFired(runGate(GATE), 'tsSuppress')
  );

  // A metric present in the counter but absent from the baseline must be
  // reported as unenforced, not silently skipped.
  await withPatchedFile(
    BASELINE,
    (s) => {
      const b = JSON.parse(s) as Record<string, Record<string, number>>;
      delete b['apps/api'].doubleCast;
      return `${JSON.stringify(b, null, 2)}\n`;
    },
    () => expectFired(runGate(GATE), 'not being enforced at all')
  );
}
