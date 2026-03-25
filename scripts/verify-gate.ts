/**
 * Per-commit verification gate.
 *
 * Detects which apps are affected by changed files and runs only the relevant
 * checks (typecheck, test, lint:routes, lint:i18n). Designed for use during
 * incremental development — run before each commit to catch issues early.
 *
 * Usage:
 *   npx tsx scripts/verify-gate.ts            # Check all uncommitted changes
 *   npx tsx scripts/verify-gate.ts --staged   # Check only staged files
 *   npx tsx scripts/verify-gate.ts --verbose  # Show which checks are skipped and why
 */

import { execSync } from 'child_process';
import * as path from 'path';

// ── Config ──────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const stagedOnly = process.argv.includes('--staged');
const verbose = process.argv.includes('--verbose');

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
    const cmd = stagedOnly
      ? 'git diff --cached --name-only --diff-filter=ACM'
      : 'git diff --name-only HEAD';
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
  const mode = stagedOnly ? 'staged' : 'uncommitted';
  console.log(`\n🔍 Verify Gate — checking ${mode} changes...\n`);

  const files = getChangedFiles();
  if (files.length === 0) {
    console.log('No changed files detected. Nothing to verify.');
    process.exit(0);
  }

  const affected = detectAffectedApps(files);
  console.log(`📂 Changed files: ${files.length}`);
  console.log(`📦 Affected apps: ${[...affected].join(', ') || 'none'}\n`);

  if (affected.size === 0) {
    console.log('No app-level changes detected (config/docs only). Skipping checks.');
    process.exit(0);
  }

  const results: CheckResult[] = [];

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

  // 2. Tests for affected apps
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
    results.push(runCheck('test:mobile', 'pnpm --filter mobile test --passWithNoTests'));
  }

  // 3. Conditional checks
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
    console.log('Fix the issues above before committing.');
    process.exit(1);
  }

  console.log(`✅ All ${passed.length} check(s) passed! Safe to commit.\n`);
  process.exit(0);
}

main();
