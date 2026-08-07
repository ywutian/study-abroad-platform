import { runGate, withPatchedFile, expectClean, expectFired } from './harness';

const PKG = 'package.json';
const LOCK = 'pnpm-lock.yaml';
const GATE = 'check-dep-pins.ts';

/**
 * Proof for `check-dep-pins.ts`.
 *
 * Unlike the other gates proven this session, probing this one turned up **no
 * defect** — recorded here so the next person does not re-run the same
 * investigation:
 *
 *  - An override key naming a package absent from the lockfile (8 today) is not
 *    flagged, and should not be. Those are latent guards: `ws@>=8.0.0 <8.21.0`
 *    selects nothing now that ws resolves to 8.21.x, but it fires again if
 *    anything drags ws back into that range. Deleting them removes protection;
 *    flagging them cries wolf 27 times.
 *  - The dangerous variant — an override that DOES select a resolved version
 *    and whose value is then not satisfied, i.e. a pin silently not applied —
 *    is **zero** today, measured with real semver. It also cannot hide: the
 *    version it would leave in place is what `check-dependency-audit.ts` scans,
 *    and that gate is proven separately.
 *
 * (One caveat found the hard way while measuring: the lockfile's own
 * `overrides:` block near the top has the same `  name@version:` shape as a
 * package entry, but carries a value. Counting it made `jws@4.0.0` look like a
 * resolved version and produced a false "override not applied" finding. Package
 * entries end with a bare colon.)
 *
 * So this proof pins the three behaviours that are already right.
 */
export async function prove(): Promise<void> {
  expectClean(runGate(GATE));

  // 1. A third zod major — the diamond dependency ADR-0021 exists to prevent.
  // Seeded in the LOCKFILE, not package.json: the gate reads resolved versions,
  // so an override edit alone changes nothing it looks at.
  await withPatchedFile(
    LOCK,
    (s) =>
      s.replace(
        /^ {2}zod@3\./m,
        '  zod@5.0.0:\n    resolution: {integrity: sha512-seed}\n\n  zod@3.'
      ),
    () => expectFired(runGate(GATE), 'zod')
  );

  // 2. A runtime dependency at the workspace root. `pnpm deploy --legacy` links
  //    these into every deployed app, which is how seven frontend packages once
  //    shipped inside the NestJS image (972 MB → 466 MB when removed).
  await withPatchedFile(
    PKG,
    (s) => s.replace(/"pnpm":\s*\{/, '"dependencies": { "lodash": "^4" },\n  "pnpm": {'),
    () => expectFired(runGate(GATE), 'dependencies')
  );

  // 3. A duplicate overrides key. JSON parsers keep the last occurrence, so the
  //    file silently disagrees with itself and which pin applies depends on line
  //    order — six keys were affected before this guard existed.
  await withPatchedFile(
    PKG,
    (s) =>
      s.replace(
        /"js-yaml@\^3":\s*"[^"]*",/,
        '"js-yaml@^3": ">=3.15.1 <4",\n      "js-yaml@^3": ">=3.0.0 <4",'
      ),
    () => expectFired(runGate(GATE), 'times.')
  );
}
