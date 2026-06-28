/**
 * Verification gate — runs affected-app checks before commit / push.
 *
 * Three modes:
 *   1. Default   (`npx tsx scripts/verify-gate.ts`)
 *      Compares working tree to HEAD. Use during active editing.
 *   2. --staged  (pre-commit)
 *      Compares staged files to HEAD. Used after `git add`.
 *   3. --pre-push (pre-push hook)
 *      Compares committed changes to upstream (`@{u}...HEAD` or
 *      `origin/main...HEAD`). This is the **mode that actually matches
 *      what CI will see**. Runs full eslint + integration + drift in
 *      addition to typecheck + test, so CI failures surface locally.
 *
 * Usage:
 *   npx tsx scripts/verify-gate.ts              # uncommitted changes
 *   npx tsx scripts/verify-gate.ts --staged     # staged files (pre-commit)
 *   npx tsx scripts/verify-gate.ts --pre-push   # pushing changes (pre-push)
 *   npx tsx scripts/verify-gate.ts --verbose    # include skip reasons
 *   npx tsx scripts/verify-gate.ts --no-test    # skip tests (fast-push; CI runs them)
 */

import { execSync } from 'child_process';
import * as path from 'path';

// ── Config ──────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const stagedOnly = process.argv.includes('--staged');
const prePush = process.argv.includes('--pre-push');
const verbose = process.argv.includes('--verbose');
// Fast-push: skip the slow test suite locally and let CI run it. The pre-push
// hook passes this so `git push` stays fast; tests still gate the PR in CI.
const noTest = process.argv.includes('--no-test');

type App = 'api' | 'web' | 'mobile' | 'shared';

interface CheckResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

// ── Detect Affected Apps ────────────────────────────────────

function getChangedFiles(): string[] {
  try {
    let cmd: string;
    if (prePush) {
      // Pre-push: compare committed commits against the upstream branch.
      // This matches what CI actually receives (the pushed commits).
      // Uses `@{u}` (configured upstream) → falls back to `origin/main`.
      try {
        execSync('git rev-parse --abbrev-ref @{u}', {
          cwd: ROOT,
          stdio: 'pipe',
        });
        cmd = 'git diff --name-only @{u}...HEAD';
      } catch {
        // No upstream tracking yet — compare against origin/main
        cmd = 'git diff --name-only origin/main...HEAD';
      }
    } else if (stagedOnly) {
      cmd = 'git diff --cached --name-only --diff-filter=ACM';
    } else {
      cmd = 'git diff --name-only HEAD';
    }
    const output = execSync(cmd, { encoding: 'utf8', cwd: ROOT });
    return output.split('\n').filter(Boolean);
  } catch {
    // If HEAD doesn't exist (initial commit), fall back to all tracked files
    try {
      const output = execSync('git diff --cached --name-only', { encoding: 'utf8', cwd: ROOT });
      return output.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}

function detectAffectedApps(files: string[]): Set<App> {
  const apps = new Set<App>();

  for (const file of files) {
    if (file.startsWith('apps/api/')) apps.add('api');
    else if (file.startsWith('apps/web/')) apps.add('web');
    else if (file.startsWith('apps/mobile/')) apps.add('mobile');
    else if (file.startsWith('packages/shared/')) apps.add('shared');
  }

  // shared changes affect all downstream apps
  if (apps.has('shared')) {
    apps.add('api');
    apps.add('web');
    apps.add('mobile');
  }

  return apps;
}

// ── Check Runners ───────────────────────────────────────────

function runCheck(name: string, command: string): CheckResult {
  const start = Date.now();
  try {
    execSync(command, {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: verbose ? 'inherit' : 'pipe',
      timeout: 120_000, // 2 minutes per check
    });
    return { name, passed: true, duration: Date.now() - start };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Extract last few lines of output for error summary
    const lines = message.split('\n');
    const summary = lines.slice(-10).join('\n').trim();
    return { name, passed: false, duration: Date.now() - start, error: summary };
  }
}

function hasI18nChanges(files: string[]): boolean {
  return files.some(
    (f) =>
      f.includes('messages/en.json') ||
      f.includes('messages/zh.json') ||
      f.includes('locales/en.json') ||
      f.includes('locales/zh.json')
  );
}

function hasRouteChanges(files: string[]): boolean {
  return files.some(
    (f) =>
      f.includes('api-routes.ts') ||
      f.includes('.controller.ts') ||
      f.includes('lib/api/') ||
      f.includes('services/')
  );
}

// ── Main ────────────────────────────────────────────────────

function main() {
  const mode = prePush ? 'pre-push' : stagedOnly ? 'staged' : 'uncommitted';
  console.log(`\n🔍 Verify Gate — checking ${mode} changes...\n`);

  const files = getChangedFiles();
  if (files.length === 0) {
    console.log('No changed files detected. Nothing to verify.');
    process.exit(0);
  }

  const affected = detectAffectedApps(files);
  console.log(`📂 Changed files: ${files.length}`);
  console.log(`📦 Affected apps: ${[...affected].join(', ') || 'none'}\n`);

  // In pre-push mode, repo-wide checks (drift, integration) always run even
  // for config-only changes — a CLAUDE.md or manifest edit can still break
  // drift rules, and route helper changes can break integration rules.
  if (affected.size === 0 && !prePush) {
    console.log('No app-level changes detected (config/docs only). Skipping checks.');
    process.exit(0);
  }

  const results: CheckResult[] = [];

  // 0. Build shared package when mobile/shared affected (CI parity: Metro needs dist/)
  if (affected.has('shared') || affected.has('mobile')) {
    console.log('📦 Building shared package (required for mobile bundling)...');
    results.push(runCheck('build:shared', 'pnpm --filter @study-abroad/shared build'));
  }

  // 1. Typecheck affected apps
  if (affected.has('api')) {
    console.log('🔍 Typecheck: api...');
    results.push(
      runCheck('typecheck:api', 'pnpm --filter api exec tsc --noEmit --project tsconfig.build.json')
    );
  }
  if (affected.has('web')) {
    console.log('🔍 Typecheck: web...');
    results.push(runCheck('typecheck:web', 'pnpm --filter web exec tsc --noEmit'));
  }
  if (affected.has('mobile')) {
    console.log('🔍 Typecheck: mobile...');
    results.push(runCheck('typecheck:mobile', 'pnpm --filter mobile exec tsc --noEmit'));
  }

  // 2. Lint affected apps — **pre-push only** (catches eslint errors like
  //    `await void` that CI lint job would fail on). Skipped in pre-commit
  //    to keep commits fast; lint-staged already runs on staged files.
  if (prePush) {
    if (affected.has('api')) {
      console.log('🧹 Lint: api...');
      results.push(runCheck('lint:api', 'pnpm --filter api lint'));
    }
    if (affected.has('web')) {
      console.log('🧹 Lint: web...');
      results.push(runCheck('lint:web', 'pnpm --filter web lint'));
    }
    if (affected.has('mobile')) {
      console.log('🧹 Lint: mobile...');
      results.push(runCheck('lint:mobile', 'pnpm --filter study-abroad-mobile lint'));
    }
  } else if (verbose) {
    console.log('   ⏭️  lint — skipped (not in --pre-push mode)');
  }

  // 3. Tests for affected apps — skipped under --no-test (fast-push: CI runs them)
  if (!noTest) {
    if (affected.has('api')) {
      console.log('🧪 Test: api...');
      results.push(runCheck('test:api', 'pnpm --filter api test --passWithNoTests'));
    }
    if (affected.has('web')) {
      console.log('🧪 Test: web...');
      results.push(runCheck('test:web', 'pnpm --filter web test -- --passWithNoTests'));
    }
    if (affected.has('mobile')) {
      console.log('🧪 Test: mobile...');
      results.push(
        runCheck('test:mobile', 'pnpm --filter study-abroad-mobile test --passWithNoTests')
      );
    }
  } else if (verbose) {
    console.log('   ⏭️  test — skipped (--no-test; CI runs the full suite)');
  }

  // 4. Conditional targeted checks
  if (hasRouteChanges(files)) {
    console.log('🔗 Checking API route consistency...');
    results.push(runCheck('lint:routes', 'pnpm lint:routes'));
  } else if (verbose) {
    console.log('   ⏭️  lint:routes — skipped (no route-related changes)');
  }

  if (hasI18nChanges(files)) {
    console.log('🌐 Checking i18n consistency...');
    results.push(runCheck('lint:i18n', 'pnpm --filter web lint:i18n'));
  } else if (verbose) {
    console.log('   ⏭️  lint:i18n — skipped (no i18n file changes)');
  }

  // 5. Full integration + drift checks — **pre-push only** (expensive, ~30s).
  //    Catches route-helper-sync, governance rules, BRIEF.md drift, etc.
  //    These are the same checks CI runs but scoped to commits being pushed.
  if (prePush) {
    console.log('🔎 Integration check (21 rules)...');
    results.push(runCheck('lint:integration', 'pnpm lint:integration'));

    console.log('📋 Drift check (6 rules)...');
    results.push(runCheck('lint:drift', 'pnpm lint:drift'));
  } else if (verbose) {
    console.log('   ⏭️  lint:integration / lint:drift — skipped (not in --pre-push mode)');
  }

  // ── Report ──────────────────────────────────────────────────

  console.log('\n' + '─'.repeat(60));
  console.log('📊 Results:\n');

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    const time = `${(r.duration / 1000).toFixed(1)}s`;
    console.log(`  ${icon} ${r.name} (${time})`);
  }

  console.log('');

  if (failed.length > 0) {
    console.log(`❌ ${failed.length} check(s) failed:\n`);
    for (const r of failed) {
      console.log(`  ── ${r.name} ──`);
      if (r.error) {
        // Show only last 5 lines to keep output concise
        const errorLines = r.error.split('\n').slice(-5);
        for (const line of errorLines) {
          console.log(`    ${line}`);
        }
      }
      console.log('');
    }
    console.log(
      prePush ? 'Fix the issues above before pushing.' : 'Fix the issues above before committing.'
    );
    process.exit(1);
  }

  const successMsg = prePush
    ? `✅ All ${passed.length} check(s) passed! Safe to push.\n`
    : `✅ All ${passed.length} check(s) passed! Safe to commit.\n`;
  console.log(successMsg);
  process.exit(0);
}

main();
