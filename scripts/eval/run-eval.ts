#!/usr/bin/env tsx
/**
 * AI Agent behavior audit
 *
 * Usage:
 *   npx tsx scripts/eval/run-eval.ts --mode=fixtures
 *   npx tsx scripts/eval/run-eval.ts --mode=live --sample=5
 *
 * Results are saved to scripts/eval/results/ by default.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  OFFICIAL_SCHOOL_TRUTH_OVERRIDES,
  OFFICIAL_SOURCE_RETRIEVED_AT,
} from '../audit/data/curated-school-truths';
import { EvalCase, EvalCategory, EvalResult, EvalSummary, Severity, BadCaseType } from './types';

type EvalMode = 'fixtures' | 'live';

type EvalCliOptions = {
  mode: EvalMode;
  sample: number;
  verbose: boolean;
  baseUrl: string;
  token?: string;
  outputDir?: string;
};

type EvalRunOutput = {
  results: EvalResult[];
  summary: EvalSummary;
  savedTo?: string;
};

type EvaluationOptions = {
  checkToolCalls?: boolean;
  actualToolCalls?: string[];
  rawOutput?: string;
  jsonPayloads?: Record<string, string>;
};

type LiveProbe = {
  verdict: EvalResult['verdict'];
  details?: string;
  actualToolCalls?: string[];
  rawOutput?: string;
  badCaseType?: BadCaseType;
};

const CURRENT_YEAR = new Date().getFullYear();
const SUPPORTED_LIVE_CATEGORIES = new Set<EvalCategory>([
  'deadline_accuracy',
  'international_student',
]);
const HARVARD_NEED_BLIND_SCHOOLS = ['Harvard', 'MIT', 'Yale', 'Princeton', 'Amherst'];

const LIVE_SCHOOL_ALIASES: Record<string, string> = {
  'Harvard University': 'Harvard',
  'Massachusetts Institute of Technology': 'MIT',
  'Yale University': 'Yale',
  'Princeton University': 'Princeton',
  'Amherst College': 'Amherst',
};

function loadApiEnv() {
  const envPath = path.join(process.cwd(), 'apps/api/.env');
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, valueRaw] = match;
    if (process.env[key] != null) continue;

    let value = valueRaw.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function parseArgs(argv: string[]): EvalCliOptions {
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      values.set(key, 'true');
      continue;
    }
    values.set(key, next);
    index += 1;
  }

  const mode = values.get('mode') === 'live' ? 'live' : 'fixtures';
  const sample = Number(values.get('sample') ?? '0');

  return {
    mode,
    sample: Number.isFinite(sample) && sample > 0 ? sample : 0,
    verbose: values.get('verbose') === 'true' || argv.includes('--verbose'),
    baseUrl: values.get('base-url') ?? 'http://localhost:4101/api/v1',
    token: values.get('token') ?? process.env.AUDIT_AUTH_TOKEN,
    outputDir: values.get('output-dir'),
  };
}

function normalizeText(value: string | undefined | null): string {
  return (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function collectJsonKeys(input: unknown, bucket: Set<string>): void {
  if (Array.isArray(input)) {
    for (const item of input) collectJsonKeys(item, bucket);
    return;
  }
  if (!input || typeof input !== 'object') return;

  for (const [key, value] of Object.entries(input)) {
    bucket.add(key);
    collectJsonKeys(value, bucket);
  }
}

function verifyJsonFields(
  payloads: Record<string, string>,
  expectedJsonFields: string[]
): { ok: boolean; details?: string } {
  const keys = new Set<string>();

  for (const [toolName, raw] of Object.entries(payloads)) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      collectJsonKeys(parsed, keys);
    } catch {
      return {
        ok: false,
        details: `Tool ${toolName} result is not valid JSON`,
      };
    }
  }

  const missing = expectedJsonFields.filter((field) => !keys.has(field));
  if (missing.length > 0) {
    return {
      ok: false,
      details: `Expected JSON fields missing: ${missing.join(', ')}`,
    };
  }

  return { ok: true };
}

function evaluateCase(
  evalCase: EvalCase,
  options: EvaluationOptions = {}
): Pick<EvalResult, 'verdict' | 'badCaseType' | 'details' | 'actualToolCalls' | 'rawOutput'> {
  const actualToolCalls =
    options.actualToolCalls ?? evalCase.mockToolCalls?.map((toolCall) => toolCall.name) ?? [];
  const rawOutput = options.rawOutput ?? evalCase.mockAssistantOutput;
  const jsonPayloads = options.jsonPayloads ?? evalCase.mockToolResults;

  if (evalCase.subjective) {
    return {
      verdict: 'skip',
      details: 'Subjective case - skipped in automated audit',
      actualToolCalls,
      rawOutput,
    };
  }

  if (options.checkToolCalls !== false && evalCase.expectedToolCalls?.length) {
    const missingTools = evalCase.expectedToolCalls.filter(
      (tool) => !actualToolCalls.includes(tool)
    );
    if (missingTools.length > 0) {
      return {
        verdict: 'fail',
        badCaseType: 'MISSING_TOOL',
        details: `Expected tools missing: ${missingTools.join(', ')}`,
        actualToolCalls,
        rawOutput,
      };
    }
  }

  if (options.checkToolCalls !== false && evalCase.forbiddenToolCalls?.length) {
    const forbiddenTools = evalCase.forbiddenToolCalls.filter((tool) =>
      actualToolCalls.includes(tool)
    );
    if (forbiddenTools.length > 0) {
      return {
        verdict: 'fail',
        badCaseType: 'REDUNDANT_TOOL',
        details: `Forbidden tools called: ${forbiddenTools.join(', ')}`,
        actualToolCalls,
        rawOutput,
      };
    }
  }

  if (evalCase.expectedJsonFields?.length) {
    if (!jsonPayloads) {
      return {
        verdict: 'fail',
        badCaseType: 'MISSING_FIELD',
        details: 'Expected JSON payloads were not provided',
        actualToolCalls,
        rawOutput,
      };
    }

    const jsonCheck = verifyJsonFields(jsonPayloads, evalCase.expectedJsonFields);
    if (!jsonCheck.ok) {
      return {
        verdict: 'fail',
        badCaseType: jsonCheck.details?.includes('valid JSON')
          ? 'JSON_PARSE_FAIL'
          : 'MISSING_FIELD',
        details: jsonCheck.details,
        actualToolCalls,
        rawOutput,
      };
    }
  }

  if (evalCase.expectedKeywords?.length) {
    const content = normalizeText(rawOutput);
    const missingKeywords = evalCase.expectedKeywords.filter(
      (keyword) => !content.includes(normalizeText(keyword))
    );
    if (missingKeywords.length > 0) {
      return {
        verdict: 'fail',
        badCaseType: 'IGNORED_CONTEXT',
        details: `Expected keywords missing: ${missingKeywords.join(', ')}`,
        actualToolCalls,
        rawOutput,
      };
    }
  }

  if (evalCase.forbiddenContent?.length) {
    const content = normalizeText(rawOutput);
    const forbidden = evalCase.forbiddenContent.filter((item) =>
      content.includes(normalizeText(item))
    );
    if (forbidden.length > 0) {
      return {
        verdict: 'fail',
        badCaseType: 'FAKE_DATA',
        details: `Forbidden content present: ${forbidden.join(', ')}`,
        actualToolCalls,
        rawOutput,
      };
    }
  }

  return {
    verdict: 'pass',
    actualToolCalls,
    rawOutput,
  };
}

export function runFixturesEval(cases: EvalCase[]): EvalResult[] {
  return cases.map((evalCase) => ({
    caseId: evalCase.id,
    mode: 'fixtures',
    timestamp: new Date().toISOString(),
    ...evaluateCase(evalCase),
  }));
}

async function request(
  url: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status?: number; text?: string; error?: string }> {
  try {
    const response = await fetch(url, init);
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      text,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function selectLiveCases(cases: EvalCase[], sampleSize: number): EvalCase[] {
  const ordered = [...cases].sort((left, right) => {
    const leftSupported = SUPPORTED_LIVE_CATEGORIES.has(left.category) ? 0 : 1;
    const rightSupported = SUPPORTED_LIVE_CATEGORIES.has(right.category) ? 0 : 1;
    return leftSupported - rightSupported;
  });

  return sampleSize > 0 ? ordered.slice(0, sampleSize) : ordered;
}

function resolveSchoolQuery(input: string): string | null {
  const knownSchools = ['Stanford', 'Harvard', ...HARVARD_NEED_BLIND_SCHOOLS];
  return (
    knownSchools.find((school) => normalizeText(input).includes(normalizeText(school))) ?? null
  );
}

function resolveRound(input: string): string | null {
  const upper = input.toUpperCase();
  if (upper.includes('SCEA')) return 'SCEA';
  if (upper.includes('REA')) return 'REA';
  if (upper.includes('ED2') || upper.includes('ED II') || upper.includes('ED II')) return 'ED2';
  if (upper.includes('ED1') || upper.includes('ED I')) return 'ED';
  if (upper.includes('ED')) return 'ED';
  if (upper.includes('EA')) return 'EA';
  if (upper.includes('RD')) return 'RD';
  return null;
}

function formatDateOutput(value: Date): string {
  const month = value.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const day = value.getUTCDate();
  return `${month} ${day} (${value.getUTCMonth() + 1}/${day}, ${value.getUTCMonth() + 1}月${day}日)`;
}

async function probeDeadlineCase(prisma: PrismaClient, evalCase: EvalCase): Promise<LiveProbe> {
  const schoolQuery = resolveSchoolQuery(evalCase.input);
  const round = resolveRound(evalCase.input);
  if (!schoolQuery || !round) {
    return {
      verdict: 'skip',
      details: 'Live probe only supports school+round deadline cases',
    };
  }

  const school = await prisma.school.findFirst({
    where: {
      OR: [
        { name: { contains: schoolQuery, mode: Prisma.QueryMode.insensitive } },
        { aliases: { has: schoolQuery } },
      ],
    },
    select: {
      name: true,
      metadata: true,
      deadlines: {
        where: {
          round: { in: [round, round === 'REA' ? 'SCEA' : round] },
          year: { gte: CURRENT_YEAR - 1 },
        },
        orderBy: [{ year: 'desc' }, { applicationDeadline: 'asc' }],
        take: 1,
        select: {
          applicationDeadline: true,
          round: true,
          year: true,
        },
      },
    },
  });

  const latestDeadline = school?.deadlines[0]?.applicationDeadline;
  if (!school || !latestDeadline) {
    return {
      verdict: 'fail',
      badCaseType: 'MISSING_FIELD',
      details: `Local school deadline data missing for ${schoolQuery} ${round}`,
      rawOutput: school ? `${school.name} is missing a structured ${round} deadline.` : undefined,
    };
  }

  const rawOutput = `${school.name} ${round} deadline in local school data is ${formatDateOutput(
    latestDeadline
  )}.`;
  const evaluated = evaluateCase(evalCase, {
    checkToolCalls: false,
    rawOutput,
    actualToolCalls: ['local_deadline_probe'],
  });

  return {
    verdict: evaluated.verdict,
    details: evaluated.details,
    badCaseType: evaluated.badCaseType,
    actualToolCalls: evaluated.actualToolCalls,
    rawOutput,
  };
}

async function probeInternationalCase(
  prisma: PrismaClient,
  evalCase: EvalCase
): Promise<LiveProbe> {
  const candidateNames = OFFICIAL_SCHOOL_TRUTH_OVERRIDES.filter(
    (record) => record.facts.intlAidPolicy === 'NEED_BLIND'
  ).map((record) => record.schoolName);

  const schools = await prisma.school.findMany({
    where: {
      OR: candidateNames.map((name) => ({
        name: {
          contains: name.replace('University', '').trim(),
          mode: Prisma.QueryMode.insensitive,
        },
      })),
    },
    select: {
      name: true,
      needBlindInternational: true,
    },
  });

  const localNeedBlind = schools
    .filter((school) => school.needBlindInternational)
    .map((school) => LIVE_SCHOOL_ALIASES[school.name] ?? school.name);

  const rawOutput = `Local school records currently mark these schools as international need-blind: ${localNeedBlind.join(
    ', '
  )}. Source set last refreshed ${OFFICIAL_SOURCE_RETRIEVED_AT}.`;
  const evaluated = evaluateCase(evalCase, {
    checkToolCalls: false,
    rawOutput,
    actualToolCalls: ['local_school_policy_probe'],
  });

  return {
    verdict: evaluated.verdict,
    details: evaluated.details,
    badCaseType: evaluated.badCaseType,
    actualToolCalls: evaluated.actualToolCalls,
    rawOutput,
  };
}

async function probeUnsupportedLiveCase(
  evalCase: EvalCase,
  options: Pick<EvalCliOptions, 'baseUrl' | 'token'>
): Promise<LiveProbe> {
  if (evalCase.category !== 'tool_routing') {
    return {
      verdict: 'skip',
      details: 'No deterministic live probe exists for this category',
    };
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  const response = await request(`${options.baseUrl}/ai-agent/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: evalCase.input,
      stream: false,
      locale: 'zh',
    }),
  });

  if (response.error) {
    return {
      verdict: 'skip',
      details: `Live agent endpoint unreachable: ${response.error}`,
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      verdict: 'skip',
      details: `Live agent routing probe blocked by auth (HTTP ${response.status})`,
    };
  }

  return {
    verdict: 'skip',
    details:
      'Live agent response does not expose tool-call traces, so routing assertions stay unverified',
    rawOutput: response.text,
  };
}

export async function runLiveEval(
  cases: EvalCase[],
  sampleSize: number,
  options: Pick<EvalCliOptions, 'baseUrl' | 'token'>
): Promise<EvalResult[]> {
  loadApiEnv();
  const sampled = selectLiveCases(cases, sampleSize);
  const results: EvalResult[] = [];
  const prisma = new PrismaClient();

  try {
    for (const evalCase of sampled) {
      const startedAt = Date.now();
      let probe: LiveProbe;

      if (evalCase.subjective) {
        probe = {
          verdict: 'skip',
          details: 'Subjective case - skipped in live audit',
        };
      } else if (evalCase.category === 'deadline_accuracy') {
        probe = await probeDeadlineCase(prisma, evalCase);
      } else if (evalCase.category === 'international_student') {
        probe = await probeInternationalCase(prisma, evalCase);
      } else {
        probe = await probeUnsupportedLiveCase(evalCase, options);
      }

      results.push({
        caseId: evalCase.id,
        mode: 'live',
        verdict: probe.verdict,
        badCaseType: probe.badCaseType,
        details: probe.details,
        actualToolCalls: probe.actualToolCalls,
        rawOutput: probe.rawOutput,
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      });
    }
  } finally {
    await prisma.$disconnect();
  }

  return results;
}

export function summarize(results: EvalResult[], dataset: EvalCase[]): EvalSummary {
  const passed = results.filter((result) => result.verdict === 'pass').length;
  const failed = results.filter((result) => result.verdict === 'fail').length;
  const skipped = results.filter((result) => result.verdict === 'skip').length;

  const byCategory = {} as Record<EvalCategory, { total: number; passed: number }>;
  const bySeverity = {} as Record<Severity, { total: number; passed: number }>;
  const badCaseBreakdown: Partial<Record<BadCaseType, number>> = {};

  for (const result of results) {
    const evalCase = dataset.find((item) => item.id === result.caseId);
    if (!evalCase) continue;

    if (!byCategory[evalCase.category]) {
      byCategory[evalCase.category] = { total: 0, passed: 0 };
    }
    byCategory[evalCase.category].total += 1;
    if (result.verdict === 'pass') byCategory[evalCase.category].passed += 1;

    if (!bySeverity[evalCase.severity]) {
      bySeverity[evalCase.severity] = { total: 0, passed: 0 };
    }
    bySeverity[evalCase.severity].total += 1;
    if (result.verdict === 'pass') bySeverity[evalCase.severity].passed += 1;

    if (result.badCaseType) {
      badCaseBreakdown[result.badCaseType] = (badCaseBreakdown[result.badCaseType] ?? 0) + 1;
    }
  }

  return {
    mode: results[0]?.mode ?? 'fixtures',
    totalCases: results.length,
    passed,
    failed,
    skipped,
    passRate: passed + failed > 0 ? passed / (passed + failed) : 0,
    byCategory,
    bySeverity,
    badCaseBreakdown,
    timestamp: new Date().toISOString(),
  };
}

export function printSummary(summary: EvalSummary): void {
  console.log('='.repeat(60));
  console.log(`Mode: ${summary.mode}`);
  console.log(
    `Results: ${summary.passed} passed / ${summary.failed} failed / ${summary.skipped} skipped`
  );
  console.log(`Pass rate: ${(summary.passRate * 100).toFixed(1)}% (excluding skipped)`);
  console.log('');

  console.log('By Category:');
  for (const [category, stats] of Object.entries(summary.byCategory)) {
    console.log(`  ${category}: ${stats.passed}/${stats.total}`);
  }

  console.log('');
  console.log('By Severity:');
  for (const [severity, stats] of Object.entries(summary.bySeverity)) {
    console.log(`  ${severity}: ${stats.passed}/${stats.total}`);
  }

  if (Object.keys(summary.badCaseBreakdown).length > 0) {
    console.log('');
    console.log('Bad Cases:');
    for (const [badCaseType, count] of Object.entries(summary.badCaseBreakdown)) {
      console.log(`  ${badCaseType}: ${count}`);
    }
  }

  console.log('='.repeat(60));
}

export function saveResults(
  results: EvalResult[],
  summary: EvalSummary,
  mode: EvalMode,
  outputDir?: string
): string {
  const resultsDir = outputDir ?? path.join(__dirname, 'results');
  fs.mkdirSync(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `agent-behavior-audit-${mode}-${timestamp}.json`;
  const fullPath = path.join(resultsDir, filename);

  fs.writeFileSync(fullPath, JSON.stringify({ summary, results }, null, 2));
  console.log(`\nResults saved to: ${fullPath}`);
  return fullPath;
}

function printVerboseResults(results: EvalResult[]): void {
  for (const result of results) {
    const icon = result.verdict === 'pass' ? 'PASS' : result.verdict === 'fail' ? 'FAIL' : 'SKIP';
    console.log(`  ${icon} ${result.caseId}: ${result.details ?? result.verdict}`);
  }
  console.log('');
}

function loadDataset(): EvalCase[] {
  const datasetPath = path.join(__dirname, 'dataset.json');
  return JSON.parse(fs.readFileSync(datasetPath, 'utf8')) as EvalCase[];
}

export async function runEval(
  partialOptions: Partial<EvalCliOptions> = {}
): Promise<EvalRunOutput> {
  const cliOptions = parseArgs([]);
  const options: EvalCliOptions = {
    ...cliOptions,
    ...partialOptions,
    mode: partialOptions.mode ?? cliOptions.mode,
    sample: partialOptions.sample ?? cliOptions.sample,
    verbose: partialOptions.verbose ?? cliOptions.verbose,
    baseUrl: partialOptions.baseUrl ?? cliOptions.baseUrl,
    token: partialOptions.token ?? cliOptions.token,
    outputDir: partialOptions.outputDir ?? cliOptions.outputDir,
  };

  const dataset = loadDataset();
  const results =
    options.mode === 'fixtures'
      ? runFixturesEval(dataset)
      : await runLiveEval(dataset, options.sample, options);
  const summary = summarize(results, dataset);
  const savedTo = saveResults(results, summary, options.mode, options.outputDir);

  return { results, summary, savedTo };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const dataset = loadDataset();

  console.log(`\nAI Agent behavior audit - mode: ${options.mode}, cases: ${dataset.length}\n`);

  const results =
    options.mode === 'fixtures'
      ? runFixturesEval(dataset)
      : await runLiveEval(dataset, options.sample, options);

  if (options.verbose) {
    printVerboseResults(results);
  }

  const summary = summarize(results, dataset);
  printSummary(summary);
  saveResults(results, summary, options.mode, options.outputDir);

  const criticalFails = results.filter((result) => {
    const evalCase = dataset.find((item) => item.id === result.caseId);
    return result.verdict === 'fail' && evalCase?.severity === 'critical';
  });

  if (criticalFails.length > 0) {
    console.log(`\n${criticalFails.length} critical case(s) failed`);
    process.exit(1);
  }
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  main().catch((error) => {
    console.error('[run-eval] failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
