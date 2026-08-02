/**
 * Contested-dependency version pin guard (lightweight One-Version Rule).
 *
 * Some dependencies have caused weeks of version flip-flop — most notably zod:
 * pinned to 3 (#111) → knip crashed on zod/mini (#419) → knip pinned to v5 to
 * purge zod 4 from the lockfile (#424) → zod 4 allowed back as an isolated knip
 * dep (#434). That back-and-forth is a *diamond dependency* (two majors of one
 * package resolvable at once), the exact failure mode Google's One-Version Rule
 * prevents — see docs/adr/0021-dependency-version-pinning.md.
 *
 * This guard does NOT dedupe the whole tree (a blanket `pnpm dedupe` is itself a
 * large, risky resolution change). It asserts only that the *contested* packages
 * keep exactly the set of MAJOR versions we deliberately decided on. A new major
 * sneaking in (or a deliberate one not recorded here) fails the build, forcing
 * the version change to be explicit and reviewed instead of silently re-resolved.
 *
 * To change a pin: update PINS below AND the ADR in the same PR. That is the
 * point — the lockfile is downstream of a recorded decision, not the source of
 * truth.
 *
 * Usage: tsx scripts/check-dep-pins.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const LOCKFILE = path.join(ROOT, 'pnpm-lock.yaml');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

interface Pin {
  /** The exact set of major versions allowed to coexist in the lockfile. */
  allowedMajors: number[];
  /** Why this set — shown on failure so the next person doesn't relitigate. */
  reason: string;
}

const PINS: Record<string, Pin> = {
  zod: {
    allowedMajors: [3, 4],
    reason:
      'App + all runtime/test code is pinned to zod 3 via pnpm.overrides ("zod": "3.25.76"). ' +
      'zod 4 is allowed ONLY as knip\'s isolated dev-tool dependency (override "knip>zod": "^4.1.11"). ' +
      'This split is deliberate and recorded in ADR-0021 — do NOT add a third zod major, and do ' +
      'NOT migrate the app to zod 4 without a new ADR.',
  },
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Collect every top-level resolved version of `name` from pnpm-lock.yaml. */
function resolvedVersions(name: string, lines: string[]): string[] {
  // pnpm-lock v9 keys packages/snapshots as `  name@1.2.3:` (2-space indent).
  // Peer-contextualised entries (`  foo@1(name@2):`) are matched by `name` only
  // when `name` itself is the key, never inside the parentheses, because the
  // anchor requires `name@` immediately after the indent.
  const re = new RegExp('^  ' + escapeRegex(name) + '@([0-9][^:()\\s]*):');
  const versions = new Set<string>();
  for (const line of lines) {
    const m = line.match(re);
    if (m) versions.add(m[1]);
  }
  return [...versions];
}

/**
 * Duplicate-key guard for `pnpm.overrides`.
 *
 * `pnpm.overrides` is where every CVE fix lands (see .claude/rules/security.md).
 * It is also plain JSON — and JSON's own rule is "last duplicate key wins,
 * silently". `JSON.parse` drops the earlier entry without a warning, pnpm never
 * sees it, and no existing gate reads the raw text. So a *second* `"js-yaml@^4"`
 * added months after the first quietly deletes the original pin.
 *
 * That is a security-gate failure mode, not a style nit: the next `>=x.y.z`
 * added to fix an advisory can be shadowed by a stale looser range sitting
 * above it, and the build stays green while the fix does nothing.
 *
 * This check re-reads package.json as TEXT (never via JSON.parse, which is
 * exactly the blind spot) and fails on any repeated key.
 */
function duplicateOverrideKeys(): { key: string; values: string[] }[] {
  const text = fs.readFileSync(PACKAGE_JSON, 'utf8');
  const lines = text.split('\n');

  // Locate the `"overrides": {` line, then walk to its matching close brace.
  // Values in this block are always strings (no nesting), so brace depth only
  // moves on the opening line and the final close.
  const startIdx = lines.findIndex((l) => /^\s*"overrides"\s*:\s*\{\s*$/.test(l));
  if (startIdx === -1) return [];

  const seen = new Map<string, string[]>();
  let depth = 1;
  for (let i = startIdx + 1; i < lines.length && depth > 0; i++) {
    const line = lines[i];
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    if (depth <= 0) break;
    // `      "pkg@^1": ">=1.2.3",` — key may itself contain `@`, `>`, `<`, spaces.
    const m = line.match(/^\s*"((?:[^"\\]|\\.)+)"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (!m) continue;
    const [, key, value] = m;
    seen.set(key, [...(seen.get(key) ?? []), value]);
  }

  return [...seen.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([key, values]) => ({ key, values }));
}

function main(): void {
  if (!fs.existsSync(LOCKFILE)) {
    console.error('❌ pnpm-lock.yaml not found — run from the repo root.');
    process.exit(1);
  }
  const lines = fs.readFileSync(LOCKFILE, 'utf8').split('\n');
  const errors: string[] = [];

  for (const { key, values } of duplicateOverrideKeys()) {
    errors.push(
      [
        `\`pnpm.overrides["${key}"]\` is declared ${values.length}× — JSON keeps only the LAST one.`,
        `   declared: ${values.map((v) => `"${v}"`).join(' → ')}   (effective: "${values[values.length - 1]}")`,
        `   why it matters: overrides is the CVE-fix mechanism (.claude/rules/security.md). A duplicate`,
        `   key silently deletes the earlier pin — a security fix can land, stay green, and do nothing.`,
        `   → merge the duplicates into ONE entry with the narrowest range that satisfies every reason.`,
      ].join('\n')
    );
  }

  for (const [name, pin] of Object.entries(PINS)) {
    const versions = resolvedVersions(name, lines);
    if (versions.length === 0) {
      errors.push(`\`${name}\` is pinned but not present in the lockfile — did a guard go stale?`);
      continue;
    }
    const majors = [...new Set(versions.map((v) => Number(v.split('.')[0])))].sort((a, b) => a - b);
    const allowed = [...pin.allowedMajors].sort((a, b) => a - b);
    const unexpected = majors.filter((m) => !allowed.includes(m));
    const missing = allowed.filter((m) => !majors.includes(m));

    if (unexpected.length > 0 || missing.length > 0) {
      const parts = [
        `\`${name}\` major versions drifted from the recorded pin.`,
        `   expected majors: {${allowed.join(', ')}}   found majors: {${majors.join(', ')}}   (versions: ${versions.join(', ')})`,
      ];
      if (unexpected.length > 0) parts.push(`   unexpected new major(s): ${unexpected.join(', ')}`);
      if (missing.length > 0) parts.push(`   expected major(s) gone: ${missing.join(', ')}`);
      parts.push(`   why: ${pin.reason}`);
      parts.push(
        `   → if this change is intentional, update PINS in this script AND ADR-0021 in the same PR.`
      );
      errors.push(parts.join('\n'));
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ Contested-dependency pin check failed:\n');
    for (const e of errors) console.error('   ' + e + '\n');
    console.error(
      'See docs/adr/0021-dependency-version-pinning.md and docs/ANTI_CHURN_PLAYBOOK.md.\n'
    );
    process.exit(1);
  }
  const summary = Object.keys(PINS)
    .map((n) => `${n} {${PINS[n].allowedMajors.join(',')}}`)
    .join(', ');
  console.log(`✅ Contested-dependency pins hold: ${summary}`);
  console.log('✅ pnpm.overrides has no duplicate keys (no silently-shadowed CVE pin).');
}

main();
