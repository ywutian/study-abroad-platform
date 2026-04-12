/**
 * Journey path accuracy checker — verifies code paths implied by active journeys exist.
 * Usage: npx tsx scripts/check-journey-paths.ts [--verbose] [--json] | pnpm lint:journeys
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
type Severity = 'error' | 'warning' | 'info';
interface Issue {
  rule: string;
  severity: Severity;
  file: string;
  message: string;
}

// ── Journey-to-path mapping ─────────────────────────────────

const JOURNEY_PATH_MAP: Record<string, string[]> = {
  A1: [
    'apps/web/src/app/[locale]/(auth)/register',
    'apps/web/src/app/[locale]/(auth)/login',
    'apps/api/src/modules/auth',
  ],
  A2: ['apps/web/src/app/[locale]/(main)/profile', 'apps/api/src/modules/profile'],
  A3: [
    'apps/web/src/app/[locale]/(main)/schools',
    'apps/api/src/modules/recommendation',
    'apps/api/src/modules/ai-agent',
  ],
  A4: ['apps/web/src/app/[locale]/(main)/essays', 'apps/api/src/modules/essay'],
  A5: ['apps/web/src/app/[locale]/(main)/timeline', 'apps/api/src/modules/timeline'],
  A6: ['apps/web/src/app/[locale]/(main)/ai', 'apps/api/src/modules/ai-agent'],
  A7: ['apps/web/src/messages/en.json', 'apps/web/src/messages/zh.json'],
  A10: [
    'apps/web/src/app/[locale]/(main)/prediction',
    'apps/web/src/app/[locale]/(main)/cases',
    'apps/web/src/app/[locale]/(main)/ranking',
    'apps/api/src/modules/prediction',
    'apps/api/src/modules/case',
  ],
  A11: ['apps/mobile/src/app', 'apps/mobile/src/components'],
};

// ── CLI Parsing ─────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  return { verbose: args.includes('--verbose'), json: args.includes('--json') };
}

// ── Registry loader ─────────────────────────────────────────

interface JourneyEntry {
  id: string;
  title: string;
  registryStatus: string;
}

function loadRegistry(): JourneyEntry[] {
  const registryPath = path.resolve(ROOT, 'scripts/release-gate/registry.ts');
  if (!fs.existsSync(registryPath)) {
    console.error(`Registry not found: ${registryPath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(registryPath, 'utf8');
  const ids = [...content.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
  const titles = [...content.matchAll(/title:\s*'([^']+)'/g)].map((m) => m[1]);
  const statuses = [...content.matchAll(/registryStatus:\s*'([^']+)'/g)].map((m) => m[1]);
  return ids.map((id, i) => ({
    id,
    title: titles[i] || '(unknown)',
    registryStatus: statuses[i] || 'unknown',
  }));
}

// ── Checker ─────────────────────────────────────────────────

function checkJourneyPaths(): Issue[] {
  const issues: Issue[] = [];
  const registry = loadRegistry();

  const activeJourneys = registry.filter(
    (j) => j.registryStatus === 'active' || j.registryStatus === 'temporary-child'
  );

  for (const journey of activeJourneys) {
    const paths = JOURNEY_PATH_MAP[journey.id];
    if (!paths) {
      issues.push({
        rule: 'journey-path-accuracy',
        severity: 'info',
        file: `scripts/release-gate/registry.ts`,
        message: `Journey ${journey.id} ("${journey.title}") has no path mapping — consider adding one`,
      });
      continue;
    }

    for (const codePath of paths) {
      const fullPath = path.resolve(ROOT, codePath);
      if (!fs.existsSync(fullPath)) {
        issues.push({
          rule: 'journey-path-accuracy',
          severity: 'error',
          file: codePath,
          message: `Missing path for journey ${journey.id} ("${journey.title}")`,
        });
      }
    }
  }

  // Also verify no mapped journeys are inactive
  for (const [journeyId] of Object.entries(JOURNEY_PATH_MAP)) {
    const journey = registry.find((j) => j.id === journeyId);
    if (!journey) {
      issues.push({
        rule: 'journey-path-accuracy',
        severity: 'warning',
        file: 'scripts/check-journey-paths.ts',
        message: `Path map references journey "${journeyId}" which does not exist in registry`,
      });
    } else if (journey.registryStatus === 'inactive') {
      issues.push({
        rule: 'journey-path-accuracy',
        severity: 'warning',
        file: 'scripts/check-journey-paths.ts',
        message: `Path map references journey "${journeyId}" ("${journey.title}") which is inactive`,
      });
    }
  }

  return issues;
}

// ── Runner ──────────────────────────────────────────────────

function main() {
  const opts = parseArgs();
  const allIssues = checkJourneyPaths();

  const filtered = opts.verbose ? allIssues : allIssues.filter((i) => i.severity !== 'info');

  if (opts.json) {
    console.log(JSON.stringify({ issues: filtered, total: filtered.length }, null, 2));
    return;
  }

  const errors = filtered.filter((i) => i.severity === 'error');
  const warnings = filtered.filter((i) => i.severity === 'warning');
  const infos = filtered.filter((i) => i.severity === 'info');

  console.log('\n📋 Journey Path Check Report');
  console.log('═'.repeat(60));

  if (errors.length > 0) {
    console.log(`\n❌ ERRORS (${errors.length}):`);
    for (const e of errors) {
      console.log(`  [${e.rule}] ${e.file}: ${e.message}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
    for (const w of warnings) {
      console.log(`  [${w.rule}] ${w.file}: ${w.message}`);
    }
  }

  if (opts.verbose && infos.length > 0) {
    console.log(`\nℹ️  INFO (${infos.length}):`);
    for (const i of infos) {
      console.log(`  [${i.rule}] ${i.file}: ${i.message}`);
    }
  }

  const total = errors.length + warnings.length + (opts.verbose ? infos.length : 0);
  if (total === 0) {
    console.log('\n✅ All journey paths exist');
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(
    `Journeys checked: all | Errors: ${errors.length} | Warnings: ${warnings.length}${opts.verbose ? ` | Info: ${infos.length}` : ''}`
  );

  if (errors.length > 0) {
    process.exit(1);
  }
}

main();
