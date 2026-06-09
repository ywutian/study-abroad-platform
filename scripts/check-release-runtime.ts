#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';

import { buildFullSurfaceRegistry } from './release-gate/full-surface-registry';
import {
  RELEASE_RUNTIME_HARD_FAIL_STATUSES,
  RELEASE_RUNTIME_SLOW_STATUSES,
  normalizeReleaseRuntimeEnvironment,
  type ReleaseRuntimeEnvironment,
  type ReleaseRuntimeWaiverFile,
} from './release-gate/release-runtime-budget';

const ROOT = process.cwd();
const DEFAULT_WAIVER_PATH = path.join(ROOT, 'scripts/release-gate/release-runtime-waivers.json');

interface CliArgs {
  environment: ReleaseRuntimeEnvironment;
  summaryPath?: string;
  waiverPath: string;
  allowFiltered: boolean;
  maxAgeHours: number;
}

interface ReleaseRuntimeSummaryRecord {
  surfaceId: string;
  route: string;
  status: string;
  releaseRuntime?: {
    classification?: {
      rootCause?: string;
    };
  };
}

interface ReleaseRuntimeSummary {
  schemaVersion: string;
  mode: string;
  environment: ReleaseRuntimeEnvironment;
  generatedAt: string;
  evidenceRoot: string;
  routeCount: number;
  expectedWebRouteCount: number;
  records: ReleaseRuntimeSummaryRecord[];
}

function parseArgs(argv: string[]): CliArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const [rawKey, inlineValue] = current.slice(2).split(/=(.*)/s, 2);
    const key = rawKey;
    if (inlineValue !== undefined && inlineValue !== '') {
      values.set(key, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      values.set(key, 'true');
      continue;
    }
    values.set(key, next);
    index += 1;
  }

  return {
    environment: normalizeReleaseRuntimeEnvironment(values.get('environment') ?? 'local'),
    summaryPath: values.get('summary') ? path.resolve(ROOT, values.get('summary')!) : undefined,
    waiverPath: path.resolve(ROOT, values.get('waivers') ?? DEFAULT_WAIVER_PATH),
    allowFiltered: values.get('allow-filtered') === 'true' || values.get('allow-filtered') === '1',
    maxAgeHours: Number(values.get('max-age-hours') ?? 48) || 48,
  };
}

function findLatestSummary(environment: ReleaseRuntimeEnvironment) {
  const reportRoot = path.join(ROOT, 'e2e-report');
  if (!fs.existsSync(reportRoot)) return null;
  const candidates: Array<{ filePath: string; mtimeMs: number }> = [];
  for (const entry of fs.readdirSync(reportRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('release-runtime-')) continue;
    const filePath = path.join(reportRoot, entry.name, environment, 'release-runtime-summary.json');
    if (!fs.existsSync(filePath)) continue;
    candidates.push({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs });
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return candidates[0]?.filePath ?? null;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function loadWaivers(filePath: string): ReleaseRuntimeWaiverFile {
  if (!fs.existsSync(filePath)) return { waivers: [] };
  return readJson<ReleaseRuntimeWaiverFile>(filePath);
}

function waiverKey(surfaceId: string, status: string) {
  return `${surfaceId}:${status}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const summaryPath = args.summaryPath ?? findLatestSummary(args.environment);
  if (!summaryPath) {
    console.error(
      `❌ No release-runtime summary found for environment=${args.environment}. Run pnpm full-surface:run -- --mode=release-runtime first.`
    );
    process.exit(1);
  }
  if (!fs.existsSync(summaryPath)) {
    console.error(`❌ Release-runtime summary does not exist: ${summaryPath}`);
    process.exit(1);
  }

  const summary = readJson<ReleaseRuntimeSummary>(summaryPath);
  if (summary.mode !== 'release-runtime') {
    console.error(`❌ ${path.relative(ROOT, summaryPath)} is not a release-runtime summary.`);
    process.exit(1);
  }
  if (summary.environment !== args.environment) {
    console.error(
      `❌ Summary environment mismatch: expected ${args.environment}, got ${summary.environment}.`
    );
    process.exit(1);
  }

  const generatedAtMs = Date.parse(summary.generatedAt);
  if (!Number.isNaN(generatedAtMs)) {
    const ageHours = (Date.now() - generatedAtMs) / (60 * 60 * 1000);
    if (ageHours > args.maxAgeHours) {
      console.error(
        `❌ Release-runtime summary is stale: ${ageHours.toFixed(1)}h old (limit ${args.maxAgeHours}h).`
      );
      process.exit(1);
    }
  }

  const registry = buildFullSurfaceRegistry();
  const expectedSurfaceIds = new Set(registry.routeInventory.web.map((route) => route.surfaceId));
  const actualSurfaceIds = new Set(summary.records.map((record) => record.surfaceId));
  const missing = [...expectedSurfaceIds].filter((surfaceId) => !actualSurfaceIds.has(surfaceId));
  const unexpected = [...actualSurfaceIds].filter(
    (surfaceId) => !expectedSurfaceIds.has(surfaceId)
  );

  const errors: string[] = [];
  if (!args.allowFiltered && missing.length > 0) {
    errors.push(
      `coverage: missing ${missing.length} web route(s): ${missing.slice(0, 10).join(', ')}`
    );
  }
  if (unexpected.length > 0) {
    errors.push(
      `coverage: summary contains ${unexpected.length} unknown route(s): ${unexpected
        .slice(0, 10)
        .join(', ')}`
    );
  }

  const hardStatuses = new Set<string>(RELEASE_RUNTIME_HARD_FAIL_STATUSES);
  const slowStatuses = new Set<string>(RELEASE_RUNTIME_SLOW_STATUSES);
  const hardFailures = summary.records.filter((record) => hardStatuses.has(record.status));
  for (const record of hardFailures) {
    errors.push(
      `${record.status}: ${record.surfaceId} (${record.route}) — ${
        record.releaseRuntime?.classification?.rootCause ?? 'no root cause recorded'
      }`
    );
  }

  const waivers = loadWaivers(args.waiverPath).waivers;
  const activeWaivers = new Map(
    waivers
      .filter((waiver) => Date.parse(waiver.expiresOn) >= Date.now())
      .map((waiver) => [waiverKey(waiver.surfaceId, waiver.status), waiver])
  );
  const expiredWaivers = waivers.filter((waiver) => Date.parse(waiver.expiresOn) < Date.now());
  for (const waiver of expiredWaivers) {
    errors.push(
      `expired waiver: ${waiver.surfaceId}:${waiver.status} expired on ${waiver.expiresOn}`
    );
  }

  const slowFailures = summary.records.filter((record) => slowStatuses.has(record.status));
  for (const record of slowFailures) {
    if (!activeWaivers.has(waiverKey(record.surfaceId, record.status))) {
      errors.push(
        `unwaived ${record.status}: ${record.surfaceId} (${record.route}) — ${
          record.releaseRuntime?.classification?.rootCause ?? 'no root cause recorded'
        }`
      );
    }
  }

  const coldStartOnly = summary.records.filter((record) => record.status === 'COLD_START_ONLY');
  console.log(
    [
      `Release runtime gate: ${path.relative(ROOT, summaryPath)}`,
      `Environment: ${summary.environment}`,
      `Routes: ${summary.records.length}/${registry.counts.webStandaloneRoutes}`,
      `Hard failures: ${hardFailures.length}`,
      `Slow failures: ${slowFailures.length}`,
      `Cold-start-only warnings: ${coldStartOnly.length}`,
    ].join('\n')
  );

  if (errors.length > 0) {
    console.error('\n❌ Release runtime gate failed:\n');
    for (const error of errors.slice(0, 30)) {
      console.error(`  - ${error}`);
    }
    if (errors.length > 30) {
      console.error(`  ... and ${errors.length - 30} more`);
    }
    process.exit(1);
  }

  console.log('✅ Release runtime gate passed.');
}

main();
