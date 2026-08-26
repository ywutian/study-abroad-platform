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
 * Two root-manifest invariants, both learned the same day (2026-07-26):
 *
 * 1. The workspace root must declare NO runtime `dependencies`.
 *    `pnpm deploy --legacy` (apps/api/Dockerfile) links the root's dependencies
 *    into every deployed app, so seven frontend packages sitting in the root —
 *    framer-motion, @sentry/nextjs and friends — shipped inside the NestJS
 *    production image. @sentry/nextjs peer-depends on `next`, which vendors its
 *    own copies of tar and brace-expansion under dist/compiled/, and Trivy
 *    flagged CRITICAL/HIGH CVEs in code the API can never load. Removing them
 *    took the image's node_modules from 972 MB to 466 MB. Root-level runtime
 *    deps are never right here: every app declares what it uses.
 *
 * 2. `pnpm.overrides` must have no duplicate keys.
 *    A merge landed both `"brace-expansion@^1": "1.1.16"` and
 *    `"brace-expansion@^2": ">=2.1.2 <3"`-style entries twice over; git saw two
 *    separate lines, not a conflict. JSON parsers keep the last occurrence, so
 *    the file silently disagreed with itself and which pin applied depended on
 *    line order. Six keys were affected before this guard existed.
 */
/**
 * GHSA-2v37-7h3g-55p8 / CVE-2026-67213: nanoid 3.x is patched at 3.3.18.
 * An override whose replacement range still includes 3.3.17 pins the
 * vulnerability. That is how this repo spent a week "fixed" while CI stayed red.
 */
function checkNanoidOverride(): string[] {
  const raw = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
  const manifest = JSON.parse(raw) as {
    pnpm?: { overrides?: Record<string, string>; auditConfig?: { ignoreGhsas?: string[] } };
  };
  const errors: string[] = [];
  const ignored = manifest.pnpm?.auditConfig?.ignoreGhsas ?? [];
  if (ignored.includes('GHSA-2v37-7h3g-55p8')) {
    errors.push(
      '`auditConfig.ignoreGhsas` lists GHSA-2v37-7h3g-55p8 — that advisory must be patched, not ignored.'
    );
  }
  const overrides = manifest.pnpm?.overrides ?? {};
  const nanoidKeys = Object.entries(overrides).filter(([k]) => k.startsWith('nanoid'));
  if (nanoidKeys.length === 0) {
    return errors;
  }
  for (const [key, value] of nanoidKeys) {
    if (/3\.3\.17/.test(key) || /3\.3\.17/.test(value)) {
      errors.push(
        `pnpm.overrides "${key}": "${value}" still names nanoid 3.3.17, which is inside GHSA-2v37-7h3g-55p8 (< 3.3.18). Pin to >=3.3.18 <4.`
      );
    }
  }
  return errors;
}

function checkRootManifest(): string[] {
  const errors: string[] = [];
  const manifestPath = path.join(ROOT, 'package.json');
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw) as {
    dependencies?: Record<string, string>;
    pnpm?: { overrides?: Record<string, string> };
  };

  const rootDeps = Object.keys(manifest.dependencies ?? {});
  if (rootDeps.length > 0) {
    errors.push(
      [
        `the workspace root declares ${rootDeps.length} runtime \`dependencies\`: ${rootDeps.join(', ')}`,
        `   \`pnpm deploy\` links these into EVERY deployed app, so they ship inside`,
        `   apps/api's production image whether or not the API uses them.`,
        `   → move each one to the app that imports it, or delete it if nothing does.`,
      ].join('\n')
    );
  }

  for (const [key, count] of duplicateOverrideKeys(raw)) {
    errors.push(
      [
        `\`pnpm.overrides\` declares "${key}" ${count} times.`,
        `   JSON keeps the last occurrence, so the effective pin depends on line order`,
        `   and the file disagrees with itself. Usually a merge that kept both sides.`,
        `   → keep one entry with the intended range.`,
      ].join('\n')
    );
  }

  return errors;
}

/**
 * GitHub Action release tags are movable references. Production workflows pin
 * third-party actions to immutable 40-character commit SHAs and keep the human
 * release label in a YAML comment for Dependabot/reviewer context.
 */
function checkWorkflowActionPins(): string[] {
  const workflows = path.join(ROOT, '.github', 'workflows');
  if (!fs.existsSync(workflows)) return [];
  const errors: string[] = [];
  for (const file of fs.readdirSync(workflows)) {
    if (!/\.ya?ml$/.test(file)) continue;
    const source = fs.readFileSync(path.join(workflows, file), 'utf8');
    for (const [index, line] of source.split('\n').entries()) {
      const match = line.match(/^\s*(?:-\s*)?uses:\s*([^\s#]+)(?:\s+#.*)?$/);
      if (!match || match[1].startsWith('./') || match[1].startsWith('docker://')) {
        continue;
      }
      const separator = match[1].lastIndexOf('@');
      const ref = separator >= 0 ? match[1].slice(separator + 1) : '';
      if (!/^[a-f0-9]{40}$/.test(ref)) {
        errors.push(
          `${file}:${index + 1} action must use an immutable 40-character commit SHA: ${match[1]}`
        );
      }
    }
  }
  return errors;
}

/** Raw-text scan: JSON.parse collapses duplicates, so the object can't reveal them. */
function duplicateOverrideKeys(raw: string): Array<[string, number]> {
  const anchor = raw.indexOf('"overrides"');
  if (anchor === -1) return [];
  const open = raw.indexOf('{', anchor);
  if (open === -1) return [];

  const counts = new Map<string, number>();
  let depth = 0;
  for (let i = open; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) break;
    } else if (ch === '"' && depth === 1) {
      // A string at depth 1 that is followed by ':' is a key of this object.
      let j = i + 1;
      let key = '';
      while (j < raw.length && raw[j] !== '"') {
        if (raw[j] === '\\') j++;
        key += raw[j];
        j++;
      }
      let k = j + 1;
      while (k < raw.length && /\s/.test(raw[k])) k++;
      if (raw[k] === ':') counts.set(key, (counts.get(key) ?? 0) + 1);
      i = j;
    }
  }
  return [...counts.entries()].filter(([, c]) => c > 1);
}

function main(): void {
  if (!fs.existsSync(LOCKFILE)) {
    console.error('❌ pnpm-lock.yaml not found — run from the repo root.');
    process.exit(1);
  }
  const lines = fs.readFileSync(LOCKFILE, 'utf8').split('\n');
  const errors: string[] = [];

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

  errors.push(...checkNanoidOverride());
  errors.push(...checkRootManifest());
  errors.push(...checkWorkflowActionPins());

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
  console.log(`✅ Dependency and GitHub Action pins hold: ${summary}`);
}

main();
