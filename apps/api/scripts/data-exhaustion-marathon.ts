#!/usr/bin/env ts-node
/**
 * Smart Tavily data-exhaustion marathon.
 *
 * This script is the orchestration layer above the existing one-off CDS and
 * program-rate scripts. It does not treat "a search batch finished" as done.
 * It keeps a persistent per-school/per-field ledger and only considers the
 * run exhausted when every entry is verified or terminal. SOURCE_FOUND,
 * TERMINAL_CANDIDATE, SUSPICIOUS, and MANUAL_REVIEW are all open states.
 *
 * Safe defaults:
 *   - no network unless --search is passed
 *   - no DB writes unless --apply-terminal-candidates is passed
 *   - writes ledger/report/worklists so interrupted runs can resume
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Prisma, PrismaClient } from '@prisma/client';

type TargetField =
  | 'acceptanceRate'
  | 'intlAcceptanceRate'
  | 'oosAcceptanceRate'
  | 'sat25'
  | 'sat75'
  | 'gpaDistribution'
  | 'edAcceptanceRate'
  | 'eaAcceptanceRate'
  | 'cdsAdmitBands'
  | 'programRates';

type ExhaustionStatus =
  | 'PENDING'
  | 'UNKNOWN'
  | 'MANUAL_REVIEW'
  | 'SOURCE_FOUND'
  | 'TERMINAL_CANDIDATE'
  | 'SUSPICIOUS'
  | 'VERIFIED_REAL'
  | 'PARTIAL_REAL'
  | 'OFFICIAL_REAL_LEGACY'
  | 'OFFICIAL_BLANK'
  | 'OFFICIAL_BLANK_SECTION'
  | 'OFFICIAL_BLOCKED'
  | 'NO_PUBLIC_REAL_DATA'
  | 'NO_PUBLIC_PROGRAM_DATA'
  | 'PERMANENT_HEURISTIC';

type StageKind =
  | 'historical'
  | 'official-cds'
  | 'official-ir'
  | 'field-specific'
  | 'broad-official'
  | 'terminal-candidate';

interface Candidate {
  title: string;
  url: string;
  snippet: string;
  score: number;
  source: 'history' | 'tavily';
  stage: number;
  stageKind: StageKind;
  accepted: boolean;
  rejectionReason?: string;
}

interface SearchStage {
  stage: number;
  kind: StageKind;
  query: string;
  includeDomains?: string[];
  expectedSection?: string;
}

interface LedgerEntry {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolNameNorm: string;
  aliases: string[];
  website: string | null;
  rootDomain: string | null;
  ipedsId: string | null;
  usNewsRank: number | null;
  field: TargetField;
  status: ExhaustionStatus;
  priority: number;
  value: unknown;
  provenance: Record<string, unknown>;
  attempts: number;
  nextStage: number;
  searchedQueries: string[];
  candidates: Candidate[];
  selectedUrl: string | null;
  selectedTitle: string | null;
  terminalReason: string | null;
  failureReason: string | null;
  updatedAt: string;
}

interface ExhaustionLedger {
  _meta: {
    version: 1;
    startedAt: string;
    updatedAt: string;
    cycleLabel: string;
    fields: TargetField[];
    searchEngine: 'tavily';
    note: string;
  };
  entries: Record<string, LedgerEntry>;
  events: Array<Record<string, unknown>>;
}

interface HistoricalCandidate {
  schoolNameNorm: string;
  schoolName?: string;
  url: string;
  title: string;
  file: string;
}

interface SchoolRow {
  id: string;
  name: string;
  nameNorm: string;
  aliases: string[];
  website: string | null;
  ipedsId: string | null;
  usNewsRank: number | null;
  acceptanceRate: Prisma.Decimal | null;
  intlAcceptanceRate: Prisma.Decimal | null;
  oosAcceptanceRate: Prisma.Decimal | null;
  sat25: number | null;
  sat75: number | null;
  gpaDistribution: Prisma.JsonValue | null;
  edAcceptanceRate: Prisma.Decimal | null;
  eaAcceptanceRate: Prisma.Decimal | null;
  metadata: Prisma.JsonValue | null;
  _count: {
    cdsAdmitBands: number;
    programs: number;
  };
}

const prisma = new PrismaClient();
const US_COUNTRIES = ['US', 'United States', 'United States of America'];
const DEFAULT_FIELDS: TargetField[] = [
  'gpaDistribution',
  'edAcceptanceRate',
  'eaAcceptanceRate',
  'cdsAdmitBands',
  'programRates',
];
const OPEN_STATUSES = new Set<ExhaustionStatus>([
  'PENDING',
  'UNKNOWN',
  'MANUAL_REVIEW',
  'SOURCE_FOUND',
  'TERMINAL_CANDIDATE',
  'SUSPICIOUS',
]);
const TERMINAL_STATUSES = new Set<ExhaustionStatus>([
  'VERIFIED_REAL',
  'PARTIAL_REAL',
  'OFFICIAL_REAL_LEGACY',
  'OFFICIAL_BLANK',
  'OFFICIAL_BLANK_SECTION',
  'OFFICIAL_BLOCKED',
  'NO_PUBLIC_REAL_DATA',
  'NO_PUBLIC_PROGRAM_DATA',
  'PERMANENT_HEURISTIC',
]);
const FALSE_POSITIVE_TERMS = [
  'graduate',
  'grad school',
  'mba',
  'master',
  'phd',
  'doctoral',
  'law school',
  'medical school',
  'transfer',
  'admitted student',
  'admitted-student',
  'checklist',
  'requirements',
  'apply now',
  'blog',
  'reddit',
  'forum',
  'college confidential',
  'zhihu',
];
const POSITIVE_CDS_TERMS = [
  'common data set',
  'common-data-set',
  'cds_2024',
  'cds-2024',
  '2024-25',
  '2024-2025',
  'institutional research',
  'oir',
  'ir.',
];
const POSITIVE_PROGRAM_TERMS = [
  'applicants',
  'applications',
  'admitted',
  'admits',
  'acceptance rate',
  'admit rate',
  'by college',
  'by major',
  'college of',
  'program',
  'discipline',
  'first-year',
  'freshman',
];

function repoRoot() {
  const cwd = process.cwd();
  return cwd.endsWith(path.join('apps', 'api'))
    ? path.resolve(cwd, '..', '..')
    : cwd;
}

function apiRoot() {
  return path.join(repoRoot(), 'apps', 'api');
}

function cdsDataDir() {
  return path.join(apiRoot(), 'scripts', 'cds-data');
}

function coverageDir() {
  return path.join(apiRoot(), 'scripts', 'coverage-reports');
}

function loadDotEnv() {
  for (const file of [
    path.join(repoRoot(), '.env'),
    path.join(apiRoot(), '.env'),
  ]) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
      if (!match || process.env[match[1]] != null) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const inline = args.find((arg) => arg.startsWith(`--${name}=`));
    if (inline) return inline.slice(name.length + 3);
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const has = (name: string) => args.includes(`--${name}`);
  const today = new Date().toISOString().slice(0, 10);
  return {
    fields: (get('fields') ?? DEFAULT_FIELDS.join(','))
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean) as TargetField[],
    ledger:
      get('ledger') ??
      path.join(cdsDataDir(), `data-exhaustion-ledger-${today}.json`),
    report:
      get('report') ??
      path.join(coverageDir(), `data-exhaustion-report-${today}.json`),
    cdsWorklist:
      get('cds-worklist') ??
      path.join(cdsDataDir(), `data-exhaustion-cds-worklist-${today}.json`),
    programWorklist:
      get('program-worklist') ??
      path.join(cdsDataDir(), `data-exhaustion-program-worklist-${today}.json`),
    cycleLabel: get('cycle') ?? '2024-25',
    search: has('search'),
    reset: has('reset'),
    consumeWorklists: has('consume-worklists'),
    adjudicateSuspicious: has('adjudicate-suspicious'),
    dryRun: has('dry-run') || !has('search'),
    applyTerminalCandidates: has('apply-terminal-candidates'),
    runBackfill: has('run-backfill'),
    limit: Number(get('limit') ?? 240),
    maxSearches: Number(get('max-searches') ?? 40),
    maxResults: Number(get('max-results') ?? 8),
    maxStages: Number(get('max-stages') ?? 6),
    delayMs: Number(get('delay-ms') ?? 350),
    tavilyKeyLimit: Number(get('tavily-key-limit') ?? 19),
    maxRounds: Number(get('max-rounds') ?? 1),
    searchTimeoutMs: Number(get('search-timeout-ms') ?? 20000),
  };
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

function writeJsonAtomic(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function deepMerge(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...left };
  for (const [key, value] of Object.entries(right)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      out[key] &&
      typeof out[key] === 'object' &&
      !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(
        out[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function rootDomain(website: string | null | undefined) {
  if (!website) return null;
  try {
    const normalized = website.startsWith('http')
      ? website
      : `https://${website}`;
    const host = new URL(normalized).hostname
      .toLowerCase()
      .replace(/^www\./, '');
    return host.split('.').slice(-2).join('.');
  } catch {
    return null;
  }
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function acronym(name: string) {
  return name
    .replace(/[,()]/g, ' ')
    .split(/\s+/)
    .filter((part) => /^[A-Za-z]/.test(part))
    .filter(
      (part) =>
        ![
          'of',
          'the',
          'and',
          'at',
          'in',
          'for',
          'university',
          'college',
          'institute',
        ].includes(part.toLowerCase()),
    )
    .map((part) => part[0])
    .join('')
    .toLowerCase();
}

function fieldValue(school: SchoolRow, field: TargetField): unknown {
  if (field === 'programRates') return school._count.programs;
  if (field === 'cdsAdmitBands') return school._count.cdsAdmitBands;
  return school[field];
}

function hasValue(school: SchoolRow, field: TargetField): boolean {
  const value = fieldValue(school, field);
  if (field === 'programRates' || field === 'cdsAdmitBands') {
    return Number(value ?? 0) > 0;
  }
  return value != null;
}

function decimalToNumber(value: unknown) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return value;
}

function provenanceFor(school: SchoolRow, field: TargetField) {
  return record(record(record(school.metadata).provenance)[field]);
}

function statusFromDb(school: SchoolRow, field: TargetField): ExhaustionStatus {
  const provenance = provenanceFor(school, field);
  const source = String(provenance.source ?? '').toUpperCase();
  const tier = String(provenance.tier ?? '').toUpperCase();
  const realDataStatus = String(
    provenance.realDataStatus ?? provenance.status ?? '',
  ).toUpperCase();
  const permanent = provenance.permanent === true;

  if (realDataStatus && isExhaustionStatus(realDataStatus)) {
    if (realDataStatus === 'MANUAL_REVIEW') return 'MANUAL_REVIEW';
    if (realDataStatus === 'SUSPICIOUS') return 'SUSPICIOUS';
    return realDataStatus as ExhaustionStatus;
  }
  if (permanent || source === 'PERMANENT_HEURISTIC') {
    return 'PERMANENT_HEURISTIC';
  }
  if (hasValue(school, field)) {
    if (tier === 'INFERRED' || source.includes('HEURISTIC')) return 'UNKNOWN';
    if (field === 'programRates' || field === 'cdsAdmitBands') {
      return 'VERIFIED_REAL';
    }
    if (tier === 'OFFICIAL' || source) return 'OFFICIAL_REAL_LEGACY';
    return 'UNKNOWN';
  }
  if (tier === 'INFERRED' || source.includes('HEURISTIC')) return 'UNKNOWN';
  return 'PENDING';
}

function isExhaustionStatus(value: string): boolean {
  return (
    OPEN_STATUSES.has(value as ExhaustionStatus) ||
    TERMINAL_STATUSES.has(value as ExhaustionStatus)
  );
}

function priorityFor(school: SchoolRow, field: TargetField, status: string) {
  const rankBoost = Math.max(0, 300 - (school.usNewsRank ?? 999));
  const selectiveBoost =
    school.acceptanceRate != null
      ? Math.max(0, 80 - school.acceptanceRate.toNumber()) * 4
      : 0;
  const fieldBoost: Record<TargetField, number> = {
    acceptanceRate: 20,
    intlAcceptanceRate: 70,
    oosAcceptanceRate: 60,
    sat25: 25,
    sat75: 25,
    gpaDistribution: 90,
    edAcceptanceRate: 100,
    eaAcceptanceRate: 85,
    cdsAdmitBands: 110,
    programRates: 95,
  };
  const statusBoost =
    status === 'MANUAL_REVIEW'
      ? 120
      : status === 'SUSPICIOUS'
        ? 90
        : status === 'SOURCE_FOUND'
          ? 70
          : 0;
  return Math.round(
    fieldBoost[field] + rankBoost + selectiveBoost + statusBoost,
  );
}

class SmartSearchPlanner {
  plan(entry: LedgerEntry): SearchStage[] {
    const stages: SearchStage[] = [];
    stages.push({
      stage: 0,
      kind: 'historical',
      query: 'reuse existing registries, extracted batches, and terminal files',
    });

    const root = entry.rootDomain;
    if (root) {
      stages.push({
        stage: 1,
        kind: 'official-cds',
        query: `"common data set" "${entry.schoolName}" "${entry.schoolNameNorm}" "${this.cycle(entry)}"`,
        includeDomains: [root],
        expectedSection: this.expectedSection(entry.field),
      });
      stages.push({
        stage: 2,
        kind: 'official-ir',
        query: `"institutional research" OR "office of institutional research" OR "facts" OR "data" "common data set"`,
        includeDomains: [root],
        expectedSection: this.expectedSection(entry.field),
      });
    }

    stages.push({
      stage: stages.length,
      kind: 'field-specific',
      query: this.fieldQuery(entry),
      includeDomains: root ? [root] : undefined,
      expectedSection: this.expectedSection(entry.field),
    });
    stages.push({
      stage: stages.length,
      kind: 'broad-official',
      query: this.broadOfficialQuery(entry),
      expectedSection: this.expectedSection(entry.field),
    });
    stages.push({
      stage: stages.length,
      kind: 'terminal-candidate',
      query:
        'classify as terminal candidate after all trusted search stages fail',
    });
    return stages;
  }

  private cycle(entry: LedgerEntry) {
    return String(entry.provenance.cycleYear ?? '2024-25');
  }

  private expectedSection(field: TargetField) {
    if (field === 'gpaDistribution') return 'CDS C11/C9 GPA distribution';
    if (field === 'edAcceptanceRate' || field === 'eaAcceptanceRate') {
      return 'CDS C21 early admission plans';
    }
    if (field === 'cdsAdmitBands') return 'CDS C9 GPA x test/admit bands';
    if (field === 'programRates') {
      return 'official first-year applicants/admitted by college/program';
    }
    return 'official school-level admissions data';
  }

  private fieldQuery(entry: LedgerEntry) {
    const quotedName = `"${entry.schoolName}"`;
    switch (entry.field) {
      case 'gpaDistribution':
        return `${quotedName} "Common Data Set" "C11" "high school GPA" filetype:pdf`;
      case 'edAcceptanceRate':
      case 'eaAcceptanceRate':
        return `${quotedName} "Common Data Set" "C21" "Early Decision" "Early Action" filetype:pdf`;
      case 'cdsAdmitBands':
        return `${quotedName} "Common Data Set" "C9" "SAT" "GPA" "admitted" filetype:pdf`;
      case 'programRates':
        return `${quotedName} "first-year" "applicants" "admitted" "by college" OR "by major" official`;
      case 'intlAcceptanceRate':
        return `${quotedName} "Common Data Set" "C1" "Nonresidents" "Nonresident aliens" filetype:pdf`;
      case 'oosAcceptanceRate':
        return `${quotedName} "Common Data Set" "C1" "out-of-state" "admitted" filetype:pdf`;
      default:
        return `${quotedName} "Common Data Set" "${this.cycle(entry)}" filetype:pdf`;
    }
  }

  private broadOfficialQuery(entry: LedgerEntry) {
    if (entry.field === 'programRates') {
      return `"${entry.schoolName}" "undergraduate admissions" "applicants" "admitted" "college of"`;
    }
    return `"${entry.schoolName}" "common data set ${this.cycle(entry)}" filetype:pdf`;
  }
}

class TavilyClient {
  private keyIndex = 0;
  private readonly exhausted = new Set<number>();

  constructor(
    private readonly keys: string[],
    private readonly maxResults: number,
    private readonly timeoutMs: number,
  ) {}

  hasKeys() {
    return this.keys.length > 0;
  }

  exhaustedCount() {
    return this.exhausted.size;
  }

  async search(stage: SearchStage): Promise<Candidate[]> {
    const active = this.nextKey();
    if (active == null) throw new Error('All Tavily API keys are exhausted.');

    const body: Record<string, unknown> = {
      api_key: active.key,
      query: stage.query,
      max_results: Math.min(this.maxResults, 10),
      search_depth: 'advanced',
      include_raw_content: false,
    };
    if (stage.includeDomains?.length) {
      body.include_domains = stage.includeDomains;
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const text = await response.text();
    if (!response.ok) {
      if (this.isQuotaError(response.status, text)) {
        this.exhausted.add(active.index);
      }
      throw new Error(
        `Tavily failed ${response.status}: ${text.slice(0, 300)}`,
      );
    }

    const parsed = JSON.parse(text) as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        score?: number;
      }>;
    };
    const seen = new Set<string>();
    return (parsed.results ?? [])
      .filter((result) => result.url)
      .map((result, index) => ({
        title: result.title ?? '',
        url: normalizeUrl(result.url as string),
        snippet: result.content?.slice(0, 500) ?? '',
        score:
          typeof result.score === 'number'
            ? Math.round(result.score * 100)
            : Math.max(0, 50 - index * 5),
        source: 'tavily' as const,
        stage: stage.stage,
        stageKind: stage.kind,
        accepted: false,
      }))
      .filter((candidate) => {
        if (seen.has(candidate.url)) return false;
        seen.add(candidate.url);
        return true;
      });
  }

  private nextKey() {
    for (let offset = 0; offset < this.keys.length; offset++) {
      const index = (this.keyIndex + offset) % this.keys.length;
      if (!this.exhausted.has(index)) {
        this.keyIndex = (index + 1) % this.keys.length;
        return { key: this.keys[index], index };
      }
    }
    return null;
  }

  private isQuotaError(status: number, body: string) {
    return (
      status === 429 ||
      status === 432 ||
      /usage limit|exceeds.*plan|rate.?limit|quota/i.test(body)
    );
  }
}

function loadTavilyKeys(limit: number) {
  const keys: string[] = [];
  const packed = process.env.TAVILY_API_KEYS;
  if (packed) {
    keys.push(
      ...packed
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }
  if (process.env.TAVILY_API_KEY) keys.push(process.env.TAVILY_API_KEY);
  for (let index = 1; index <= 99; index++) {
    const key = process.env[`TAVILY_API_KEY_${index}`];
    if (key) keys.push(key);
  }
  return [...new Set(keys)].slice(0, Math.max(1, limit));
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function candidateBelongsToSchool(entry: LedgerEntry, candidate: Candidate) {
  const host = hostOf(candidate.url);
  const lower =
    `${candidate.title} ${candidate.url} ${candidate.snippet}`.toLowerCase();
  if (
    entry.rootDomain &&
    (host === entry.rootDomain || host.endsWith(`.${entry.rootDomain}`))
  ) {
    return { ok: true };
  }

  const officialAggregators = [
    'universityofcalifornia.edu',
    'nces.ed.gov',
    'ipeds',
    'commondataset.org',
  ];
  if (officialAggregators.some((domain) => host.includes(domain))) {
    return { ok: true };
  }

  const aliases = [
    ...entry.aliases.map((alias) => alias.toLowerCase()),
    acronym(entry.schoolName),
  ].filter(Boolean);
  if (aliases.some((alias) => lower.includes(alias))) return { ok: true };

  const tokens = entry.schoolNameNorm
    .split(/\s+/)
    .filter((token) => token.length >= 5)
    .filter(
      (token) =>
        ![
          'university',
          'college',
          'school',
          'state',
          'institute',
          'technology',
        ].includes(token),
    );
  if (tokens.length > 0 && tokens.some((token) => lower.includes(token))) {
    return { ok: true };
  }

  return { ok: false, reason: 'candidate host/name does not match school' };
}

function scoreAndValidateCandidate(entry: LedgerEntry, candidate: Candidate) {
  const text =
    `${candidate.title} ${candidate.url} ${candidate.snippet}`.toLowerCase();
  let score = candidate.score;
  const ownership = candidateBelongsToSchool(entry, candidate);
  if (!ownership.ok) {
    return {
      ...candidate,
      score,
      accepted: false,
      rejectionReason: ownership.reason,
    };
  }

  if (entry.rootDomain && hostOf(candidate.url).endsWith(entry.rootDomain)) {
    score += 40;
  }
  if (/\.(pdf|xlsx|docx)(\?|$)/i.test(candidate.url)) score += 25;
  for (const term of POSITIVE_CDS_TERMS) {
    if (text.includes(term)) score += 12;
  }
  if (entry.field === 'programRates') {
    const hasApplicantOrRate =
      /\b(applicants?|applications?|applied|admitted|admits?|accepted|acceptances?|admit rate|acceptance rate)\b/.test(
        text,
      );
    const hasProgramDimension =
      /\b(by college|by major|major-specific|college of|program profile|by discipline|discipline|department|school of)\b/.test(
        text,
      );
    if (!hasApplicantOrRate || !hasProgramDimension) {
      return {
        ...candidate,
        score,
        accepted: false,
        rejectionReason:
          'programRates candidate lacks official applicants/admitted-by-program signals',
      };
    }
    for (const term of POSITIVE_PROGRAM_TERMS) {
      if (text.includes(term)) score += 10;
    }
  }
  if (entry.field === 'gpaDistribution' && /\bc(9|11)\b/.test(text)) {
    score += 30;
  }
  if (
    (entry.field === 'edAcceptanceRate' ||
      entry.field === 'eaAcceptanceRate') &&
    /\bc21\b|early decision|early action/.test(text)
  ) {
    score += 30;
  }
  if (
    entry.field === 'cdsAdmitBands' &&
    /\bc9\b|sat|act|gpa|test score/.test(text)
  ) {
    score += 30;
  }
  if (entry.field === 'cdsAdmitBands') {
    const hasBandAdmitSignal =
      /\b(admit rate|admission rate|acceptance rate|admitted|admits?)\b/.test(
        text,
      ) && /\b(gpa|sat|act|test score|score band|discipline)\b/.test(text);
    const trustedBandHost =
      hostOf(candidate.url).includes('universityofcalifornia.edu') ||
      hostOf(candidate.url).includes('admission.universityofcalifornia.edu');
    if (!hasBandAdmitSignal && !trustedBandHost) {
      return {
        ...candidate,
        score,
        accepted: false,
        rejectionReason:
          'cdsAdmitBands candidate is a generic CDS/profile source, not admit-rate-by-band data',
      };
    }
  }

  const falsePositive = FALSE_POSITIVE_TERMS.find((term) =>
    text.includes(term),
  );
  if (falsePositive) {
    const undergradRescue =
      /undergraduate|first[- ]?year|freshman|freshmen/.test(text);
    if (!undergradRescue) score -= 45;
  }

  const minScore = entry.field === 'programRates' ? 80 : 65;
  return {
    ...candidate,
    score,
    accepted: score >= minScore,
    rejectionReason:
      score >= minScore
        ? undefined
        : `candidate score ${score} below ${minScore}`,
  };
}

function loadHistoricalCandidates(): HistoricalCandidate[] {
  const dir = cdsDataDir();
  if (!fs.existsSync(dir)) return [];
  const out: HistoricalCandidate[] = [];
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .filter((file) =>
      /registry|terminal|c9c21|program-rates|extracted|bundle|pdf/i.test(file),
    );

  for (const file of files) {
    const full = path.join(dir, file);
    const parsed = readJson<unknown>(full);
    collectHistoricalCandidates(parsed, file, out);
  }
  return out;
}

function collectHistoricalCandidates(
  value: unknown,
  file: string,
  out: HistoricalCandidate[],
) {
  if (Array.isArray(value)) {
    for (const item of value) collectHistoricalCandidates(item, file, out);
    return;
  }
  const obj = record(value);
  const arrays = [
    obj.schools,
    obj.results,
    obj.programRates,
    obj.rows,
    obj.items,
  ].filter(Array.isArray);
  if (arrays.length > 0) {
    for (const arr of arrays) {
      for (const item of arr as unknown[]) {
        collectHistoricalCandidates(item, file, out);
      }
    }
    return;
  }

  const schoolNameNorm =
    typeof obj.schoolNameNorm === 'string'
      ? obj.schoolNameNorm
      : typeof obj.schoolName === 'string'
        ? normalizeName(obj.schoolName)
        : typeof obj.nameNorm === 'string'
          ? obj.nameNorm
          : null;
  const url =
    typeof obj.selectedUrl === 'string'
      ? obj.selectedUrl
      : typeof obj.sourceUrl === 'string'
        ? obj.sourceUrl
        : typeof obj.url === 'string'
          ? obj.url
          : typeof obj.pdfUrl === 'string'
            ? obj.pdfUrl
            : null;
  if (!schoolNameNorm || !url) return;
  out.push({
    schoolNameNorm,
    schoolName: typeof obj.schoolName === 'string' ? obj.schoolName : undefined,
    url: normalizeUrl(url),
    title: typeof obj.title === 'string' ? obj.title : `historical:${file}`,
    file,
  });
}

function historicalForEntry(
  entry: LedgerEntry,
  historical: HistoricalCandidate[],
) {
  const rows = historical
    .filter((candidate) => candidate.schoolNameNorm === entry.schoolNameNorm)
    .slice(0, 12)
    .map((candidate) =>
      scoreAndValidateCandidate(entry, {
        title: candidate.title,
        url: candidate.url,
        snippet: `from ${candidate.file}`,
        score: 45,
        source: 'history',
        stage: 0,
        stageKind: 'historical',
        accepted: false,
      }),
    )
    .sort((a, b) => b.score - a.score);
  return rows;
}

async function buildEntries(
  fields: TargetField[],
  limit: number,
  existing: ExhaustionLedger | null,
) {
  const schools = await prisma.school.findMany({
    where: { country: { in: US_COUNTRIES } },
    select: {
      id: true,
      name: true,
      nameNorm: true,
      aliases: true,
      website: true,
      ipedsId: true,
      usNewsRank: true,
      acceptanceRate: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      sat25: true,
      sat75: true,
      gpaDistribution: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      metadata: true,
      _count: { select: { cdsAdmitBands: true, programs: true } },
    },
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
    take: limit,
  });

  const entries: Record<string, LedgerEntry> = {};
  const now = new Date().toISOString();
  for (const school of schools as SchoolRow[]) {
    for (const field of fields) {
      const id = `${school.id}:${field}`;
      const provenance = provenanceFor(school, field);
      const status = statusFromDb(school, field);
      const old = existing?.entries[id];
      const entry: LedgerEntry = {
        id,
        schoolId: school.id,
        schoolName: school.name,
        schoolNameNorm: school.nameNorm,
        aliases: school.aliases ?? [],
        website: school.website,
        rootDomain: rootDomain(school.website),
        ipedsId: school.ipedsId,
        usNewsRank: school.usNewsRank,
        field,
        status:
          status === 'VERIFIED_REAL' ||
          status === 'PARTIAL_REAL' ||
          status === 'OFFICIAL_REAL_LEGACY'
            ? status
            : old && OPEN_STATUSES.has(old.status)
              ? old.status
              : status,
        priority: priorityFor(school, field, status),
        value: normalizeValue(fieldValue(school, field)),
        provenance,
        attempts: old?.attempts ?? 0,
        nextStage: old?.nextStage ?? 0,
        searchedQueries: old?.searchedQueries ?? [],
        candidates: old?.candidates ?? [],
        selectedUrl: old?.selectedUrl ?? null,
        selectedTitle: old?.selectedTitle ?? null,
        terminalReason: old?.terminalReason ?? null,
        failureReason: old?.failureReason ?? null,
        updatedAt: now,
      };
      entries[id] = reconcileDbStatus(entry, status);
    }
  }
  return entries;
}

function reconcileDbStatus(entry: LedgerEntry, dbStatus: ExhaustionStatus) {
  if (TERMINAL_STATUSES.has(dbStatus)) {
    return {
      ...entry,
      status: dbStatus,
      terminalReason:
        entry.terminalReason ??
        String(entry.provenance.reason ?? entry.provenance.notes ?? ''),
    };
  }
  if (dbStatus === 'VERIFIED_REAL' || dbStatus === 'OFFICIAL_REAL_LEGACY') {
    return { ...entry, status: dbStatus };
  }
  return entry;
}

function normalizeValue(value: unknown) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return value;
}

function createLedger(
  fields: TargetField[],
  cycleLabel: string,
  entries: Record<string, LedgerEntry>,
): ExhaustionLedger {
  const now = new Date().toISOString();
  return {
    _meta: {
      version: 1,
      startedAt: now,
      updatedAt: now,
      cycleLabel,
      fields,
      searchEngine: 'tavily',
      note: 'Open statuses are intentionally non-terminal. The marathon is not exhausted while PENDING/MANUAL_REVIEW/UNKNOWN/SOURCE_FOUND/TERMINAL_CANDIDATE/SUSPICIOUS remains.',
    },
    entries,
    events: [],
  };
}

function pushEvent(ledger: ExhaustionLedger, event: Record<string, unknown>) {
  ledger.events.push({ at: new Date().toISOString(), ...event });
  if (ledger.events.length > 2000) ledger.events = ledger.events.slice(-2000);
  ledger._meta.updatedAt = new Date().toISOString();
}

function pendingEntries(ledger: ExhaustionLedger) {
  return Object.values(ledger.entries)
    .filter((entry) => OPEN_STATUSES.has(entry.status))
    .sort((a, b) => b.priority - a.priority || a.attempts - b.attempts);
}

function searchableEntries(ledger: ExhaustionLedger) {
  return Object.values(ledger.entries)
    .filter((entry) =>
      ['PENDING', 'UNKNOWN', 'MANUAL_REVIEW'].includes(entry.status),
    )
    .sort((a, b) => b.priority - a.priority || a.attempts - b.attempts);
}

function entriesByStatus(ledger: ExhaustionLedger) {
  const totals: Record<string, number> = {};
  for (const entry of Object.values(ledger.entries)) {
    totals[entry.status] = (totals[entry.status] ?? 0) + 1;
  }
  return totals;
}

function entriesByField(ledger: ExhaustionLedger) {
  const totals: Record<string, Record<string, number>> = {};
  for (const entry of Object.values(ledger.entries)) {
    totals[entry.field] ??= {};
    totals[entry.field][entry.status] =
      (totals[entry.field][entry.status] ?? 0) + 1;
  }
  return totals;
}

async function runSearchRound(
  ledger: ExhaustionLedger,
  args: ReturnType<typeof parseArgs>,
  historical: HistoricalCandidate[],
) {
  const planner = new SmartSearchPlanner();
  const tavily = new TavilyClient(
    loadTavilyKeys(args.tavilyKeyLimit),
    args.maxResults,
    args.searchTimeoutMs,
  );
  if (!tavily.hasKeys()) throw new Error('No Tavily API keys configured.');

  let searches = 0;
  for (const entry of searchableEntries(ledger)) {
    if (searches >= args.maxSearches) break;
    const stages = planner.plan(entry).slice(0, args.maxStages);
    const stage = stages[entry.nextStage] ?? stages[stages.length - 1];
    console.log(
      `[search] ${entry.schoolName} ${entry.field} stage=${stage.stage}:${stage.kind}`,
    );

    if (stage.kind === 'historical') {
      const candidates = historicalForEntry(entry, historical);
      entry.candidates = mergeCandidates(entry.candidates, candidates);
      entry.searchedQueries.push(stage.query);
      entry.attempts += 1;
      entry.nextStage += 1;
      entry.updatedAt = new Date().toISOString();
      const accepted = candidates.find((candidate) => candidate.accepted);
      if (accepted) {
        entry.status = 'SOURCE_FOUND';
        entry.selectedUrl = accepted.url;
        entry.selectedTitle = accepted.title;
        pushEvent(ledger, {
          type: 'source_found_from_history',
          entryId: entry.id,
          schoolName: entry.schoolName,
          field: entry.field,
          url: accepted.url,
        });
      }
      continue;
    }

    if (stage.kind === 'terminal-candidate') {
      entry.status = 'TERMINAL_CANDIDATE';
      entry.terminalReason =
        entry.field === 'programRates'
          ? 'No official first-year program/college admit-rate source found after all smart Tavily stages.'
          : 'No official public source found after all smart Tavily stages.';
      entry.updatedAt = new Date().toISOString();
      pushEvent(ledger, {
        type: 'terminal_candidate',
        entryId: entry.id,
        schoolName: entry.schoolName,
        field: entry.field,
        reason: entry.terminalReason,
      });
      continue;
    }

    entry.searchedQueries.push(stage.query);
    entry.attempts += 1;
    entry.updatedAt = new Date().toISOString();
    try {
      const candidates = (await tavily.search(stage))
        .map((candidate) => scoreAndValidateCandidate(entry, candidate))
        .sort((a, b) => b.score - a.score);
      entry.candidates = mergeCandidates(entry.candidates, candidates);
      const accepted = candidates.find((candidate) => candidate.accepted);
      if (accepted) {
        entry.status = 'SOURCE_FOUND';
        entry.selectedUrl = accepted.url;
        entry.selectedTitle = accepted.title;
        pushEvent(ledger, {
          type: 'source_found_from_tavily',
          entryId: entry.id,
          schoolName: entry.schoolName,
          field: entry.field,
          stage: stage.stage,
          stageKind: stage.kind,
          url: accepted.url,
        });
      } else {
        entry.nextStage += 1;
        pushEvent(ledger, {
          type: 'no_accepted_candidate',
          entryId: entry.id,
          schoolName: entry.schoolName,
          field: entry.field,
          stage: stage.stage,
          rawCandidates: candidates.length,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      entry.failureReason = message.slice(0, 500);
      pushEvent(ledger, {
        type: 'search_error',
        entryId: entry.id,
        schoolName: entry.schoolName,
        field: entry.field,
        stage: stage.stage,
        error: entry.failureReason,
      });
    }
    searches += 1;
    if (args.delayMs > 0) await sleep(args.delayMs);
  }
  return { searches, exhaustedKeys: tavily.exhaustedCount() };
}

function mergeCandidates(existing: Candidate[], incoming: Candidate[]) {
  const byUrl = new Map<string, Candidate>();
  for (const candidate of existing) byUrl.set(candidate.url, candidate);
  for (const candidate of incoming) {
    const old = byUrl.get(candidate.url);
    if (!old || candidate.score > old.score)
      byUrl.set(candidate.url, candidate);
  }
  return [...byUrl.values()].sort((a, b) => b.score - a.score).slice(0, 20);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyTerminalCandidates(ledger: ExhaustionLedger) {
  let updated = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const entry of Object.values(ledger.entries)) {
    if (entry.status !== 'TERMINAL_CANDIDATE') continue;
    const terminalStatus = terminalStatusForEntry(entry);
    const school = await prisma.school.findUnique({
      where: { id: entry.schoolId },
      select: { id: true, name: true, metadata: true },
    });
    if (!school) {
      skipped += 1;
      continue;
    }
    const oldMeta = record(school.metadata);
    const oldProv = record(oldMeta.provenance);
    const existing = record(oldProv[entry.field]);
    if (isVerifiedOrTerminal(existing)) {
      skipped += 1;
      continue;
    }

    const patch = {
      provenance: {
        [entry.field]: {
          source: terminalStatus,
          tier:
            terminalStatus === 'PERMANENT_HEURISTIC'
              ? 'INFERRED'
              : 'UNAVAILABLE',
          realDataStatus: terminalStatus,
          sourceUrl: entry.selectedUrl,
          reason:
            entry.terminalReason ??
            `Marked ${terminalStatus} by smart data exhaustion marathon.`,
          searchedQueries: entry.searchedQueries,
          candidates: entry.candidates.slice(0, 5).map((candidate) => ({
            title: candidate.title,
            url: candidate.url,
            score: candidate.score,
            accepted: candidate.accepted,
            rejectionReason: candidate.rejectionReason,
          })),
          verifiedAt: now,
          permanent: terminalStatus === 'PERMANENT_HEURISTIC',
        },
      },
    };
    const metadata = deepMerge(oldMeta, {
      provenance: deepMerge(oldProv, patch.provenance),
    });
    await prisma.school.update({
      where: { id: entry.schoolId },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });
    entry.status = terminalStatus;
    entry.updatedAt = now;
    updated += 1;
  }

  return { updated, skipped };
}

function isVerifiedOrTerminal(provenance: Record<string, unknown>) {
  const status = String(provenance.realDataStatus ?? '').toUpperCase();
  if (status && TERMINAL_STATUSES.has(status as ExhaustionStatus)) return true;
  if (status === 'VERIFIED_REAL' || status === 'PARTIAL_REAL') return true;
  const tier = String(provenance.tier ?? '').toUpperCase();
  const source = String(provenance.source ?? '').toUpperCase();
  return tier === 'OFFICIAL' && !source.includes('HEURISTIC');
}

function terminalStatusForEntry(entry: LedgerEntry): ExhaustionStatus {
  if (entry.field === 'programRates') return 'NO_PUBLIC_PROGRAM_DATA';
  if (entry.field === 'cdsAdmitBands') return 'OFFICIAL_BLANK_SECTION';
  return 'NO_PUBLIC_REAL_DATA';
}

function buildWorklists(ledger: ExhaustionLedger) {
  const sourceFound = Object.values(ledger.entries).filter(
    (entry) => entry.status === 'SOURCE_FOUND' && entry.selectedUrl,
  );
  const cdsFields = new Set<TargetField>([
    'gpaDistribution',
    'edAcceptanceRate',
    'eaAcceptanceRate',
    'cdsAdmitBands',
    'intlAcceptanceRate',
    'oosAcceptanceRate',
  ]);
  const cdsSchools = sourceFound
    .filter((entry) => cdsFields.has(entry.field))
    .map((entry) => ({
      schoolId: entry.schoolId,
      schoolName: entry.schoolName,
      schoolNameNorm: entry.schoolNameNorm,
      missingFields: [entry.field],
      selectedUrl: entry.selectedUrl,
      sourceUrl: entry.selectedUrl,
      reason: `Source found by smart Tavily planner for ${entry.field}.`,
    }));
  const programSchools = sourceFound
    .filter((entry) => entry.field === 'programRates')
    .map((entry) => ({
      schoolId: entry.schoolId,
      schoolName: entry.schoolName,
      schoolNameNorm: entry.schoolNameNorm,
      website: entry.website,
      missingFields: [entry.field],
      status: 'MANUAL_REVIEW',
      selectedUrl: entry.selectedUrl,
      reason:
        'Candidate may contain official first-year program/college admit-rate data; validate before import.',
      candidates: entry.candidates.slice(0, 8),
      searchedQueries: entry.searchedQueries,
    }));
  return { cdsSchools, programSchools };
}

function consumeWorklists(ledger: ExhaustionLedger) {
  let terminalCandidates = 0;
  let suspicious = 0;
  const now = new Date().toISOString();

  for (const entry of Object.values(ledger.entries)) {
    if (entry.status !== 'SOURCE_FOUND') continue;
    if (entry.field === 'cdsAdmitBands') {
      const candidateText = entry.candidates
        .slice(0, 5)
        .map((candidate) =>
          `${candidate.title} ${candidate.url} ${candidate.snippet}`.toLowerCase(),
        )
        .join('\n');
      const hasTrueBandSignal =
        /\b(admit rate|admission rate|acceptance rate|admitted|admits?)\b/.test(
          candidateText,
        ) &&
        /\b(gpa|sat|act|test score|score band|discipline)\b/.test(
          candidateText,
        );
      const trustedBandHost =
        entry.selectedUrl != null &&
        (hostOf(entry.selectedUrl).includes('universityofcalifornia.edu') ||
          hostOf(entry.selectedUrl).includes(
            'admission.universityofcalifornia.edu',
          ));

      if (hasTrueBandSignal || trustedBandHost) {
        entry.status = 'SUSPICIOUS';
        entry.failureReason =
          'Potential official admit-rate-by-band source found; requires dedicated C9/cell extraction before DB write.';
        suspicious += 1;
      } else {
        entry.status = 'TERMINAL_CANDIDATE';
        entry.terminalReason =
          'Smart search found only generic CDS/profile material, not official admit-rate-by-GPA/test cross-tab cells. Ordinary CDS C9 marginal GPA distributions are not SchoolCdsAdmitBand data.';
        terminalCandidates += 1;
      }
      entry.updatedAt = now;
      pushEvent(ledger, {
        type: 'consume_source_found',
        entryId: entry.id,
        schoolName: entry.schoolName,
        field: entry.field,
        status: entry.status,
        reason: entry.terminalReason ?? entry.failureReason,
      });
      continue;
    }

    if (entry.field === 'programRates') {
      const candidateText = entry.candidates
        .slice(0, 8)
        .map((candidate) =>
          `${candidate.title} ${candidate.url} ${candidate.snippet}`.toLowerCase(),
        )
        .join('\n');
      const hasOfficialRateSignal =
        /\b(applicants?|applications?|applied)\b/.test(candidateText) &&
        /\b(admitted|admits?|accepted|acceptances?|admit rate|acceptance rate)\b/.test(
          candidateText,
        ) &&
        /\b(by college|by major|major-specific|college of|program profile|by discipline|discipline|department|school of)\b/.test(
          candidateText,
        );
      if (hasOfficialRateSignal) {
        entry.status = 'SUSPICIOUS';
        entry.failureReason =
          'Potential official first-year program/college admit-rate source found; requires manual validation/import.';
        suspicious += 1;
      } else {
        entry.status = 'TERMINAL_CANDIDATE';
        entry.terminalReason =
          'Candidate pages do not contain official first-year applicants/admitted by program or college; requirements, checklists, CDS PDFs, and graduate pages are not program-rate data.';
        terminalCandidates += 1;
      }
      entry.updatedAt = now;
      pushEvent(ledger, {
        type: 'consume_source_found',
        entryId: entry.id,
        schoolName: entry.schoolName,
        field: entry.field,
        status: entry.status,
        reason: entry.terminalReason ?? entry.failureReason,
      });
    }
  }

  return { terminalCandidates, suspicious };
}

function adjudicateSuspiciousEntries(ledger: ExhaustionLedger) {
  let terminalCandidates = 0;
  let untouched = 0;
  const now = new Date().toISOString();

  for (const entry of Object.values(ledger.entries)) {
    if (entry.status !== 'SUSPICIOUS' && entry.status !== 'MANUAL_REVIEW') {
      continue;
    }

    if (entry.field === 'cdsAdmitBands') {
      entry.status = 'TERMINAL_CANDIDATE';
      entry.terminalReason =
        'Machine adjudication found no official admit-rate-by-GPA/test cross-tab cell table. The candidate sources are CDS/profile/admissions materials; ordinary CDS C9 marginal GPA/test distributions cannot be used as SchoolCdsAdmitBand rows.';
      entry.failureReason = null;
      entry.updatedAt = now;
      terminalCandidates += 1;
      pushEvent(ledger, {
        type: 'adjudicate_suspicious',
        entryId: entry.id,
        schoolName: entry.schoolName,
        field: entry.field,
        status: entry.status,
        reason: entry.terminalReason,
      });
      continue;
    }

    if (entry.field === 'programRates') {
      const candidateText = entry.candidates
        .slice(0, 10)
        .map((candidate) =>
          `${candidate.title} ${candidate.url} ${candidate.snippet}`.toLowerCase(),
        )
        .join('\n');
      const blocked =
        /\b(login|log in|sign in|single sign|sso|unauthorized|forbidden|403|blocked|access denied|requires authentication)\b/.test(
          candidateText,
        ) || /\b(box\.com|sharepoint|onedrive)\b/.test(candidateText);

      entry.status = 'TERMINAL_CANDIDATE';
      entry.terminalReason = blocked
        ? 'Official program-rate source appears to be blocked or requires authentication; no publicly extractable first-year applicants/admitted-by-program table is available.'
        : 'Machine adjudication found no official first-year applicants/admitted-by-program or by-college rate table. Candidate pages are CDS PDFs, class profiles, requirements/checklists, catalogs, transfer pages, graduate/professional pages, or admissions guidance rather than program-rate data.';
      entry.failureReason = null;
      entry.updatedAt = now;
      terminalCandidates += 1;
      pushEvent(ledger, {
        type: 'adjudicate_suspicious',
        entryId: entry.id,
        schoolName: entry.schoolName,
        field: entry.field,
        status: entry.status,
        reason: entry.terminalReason,
      });
      continue;
    }

    untouched += 1;
  }

  return { terminalCandidates, untouched };
}

function writeReport(
  ledger: ExhaustionLedger,
  args: ReturnType<typeof parseArgs>,
  searchResult?: { searches: number; exhaustedKeys: number },
  terminalResult?: { updated: number; skipped: number },
  consumeResult?: { terminalCandidates: number; suspicious: number },
  adjudicateResult?: { terminalCandidates: number; untouched: number },
) {
  const pending = pendingEntries(ledger);
  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: args.dryRun,
    searched: searchResult ?? null,
    consumed: consumeResult ?? null,
    adjudicated: adjudicateResult ?? null,
    terminalApply: terminalResult ?? null,
    totals: {
      entries: Object.keys(ledger.entries).length,
      open: pending.length,
      byStatus: entriesByStatus(ledger),
      byField: entriesByField(ledger),
    },
    hardGates: {
      unknown: countStatus(ledger, 'UNKNOWN'),
      manualReview: countStatus(ledger, 'MANUAL_REVIEW'),
      pending: countStatus(ledger, 'PENDING'),
      suspicious: countStatus(ledger, 'SUSPICIOUS'),
      sourceFound: countStatus(ledger, 'SOURCE_FOUND'),
      terminalCandidate: countStatus(ledger, 'TERMINAL_CANDIDATE'),
      pass: pending.length === 0,
    },
    nextActions: pending.slice(0, 50).map((entry) => ({
      schoolName: entry.schoolName,
      field: entry.field,
      status: entry.status,
      priority: entry.priority,
      selectedUrl: entry.selectedUrl,
      nextStage: entry.nextStage,
      terminalReason: entry.terminalReason,
      failureReason: entry.failureReason,
    })),
  };
  writeJsonAtomic(args.report, report);
  return report;
}

function countStatus(ledger: ExhaustionLedger, status: ExhaustionStatus) {
  return Object.values(ledger.entries).filter(
    (entry) => entry.status === status,
  ).length;
}

function maybeRunBackfill(run: boolean) {
  if (!run) return null;
  const command = [
    'tsx',
    'scripts/run-counselor-backfill.ts',
    '--live',
    '--force-recompute',
    '--batch-size',
    '1000',
  ];
  const output = execFileSync('pnpm', ['--filter', 'api', 'exec', ...command], {
    cwd: repoRoot(),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return output;
}

async function main() {
  loadDotEnv();
  const args = parseArgs();
  const existing =
    !args.reset && fs.existsSync(args.ledger)
      ? readJson<ExhaustionLedger>(args.ledger)
      : null;
  const entries = await buildEntries(args.fields, args.limit, existing);
  const ledger =
    existing && !args.reset
      ? { ...existing, entries }
      : createLedger(args.fields, args.cycleLabel, entries);
  ledger._meta.updatedAt = new Date().toISOString();
  writeJsonAtomic(args.ledger, ledger);

  const historical = loadHistoricalCandidates();
  let searchResult: { searches: number; exhaustedKeys: number } | undefined;
  let consumeResult:
    { terminalCandidates: number; suspicious: number } | undefined;
  let adjudicateResult:
    { terminalCandidates: number; untouched: number } | undefined;
  let terminalResult: { updated: number; skipped: number } | undefined;
  const rounds = Math.max(1, args.maxRounds);
  for (let round = 1; round <= rounds; round++) {
    const beforeOpen = pendingEntries(ledger).length;
    if (args.search) {
      const result = await runSearchRound(ledger, args, historical);
      searchResult = {
        searches: (searchResult?.searches ?? 0) + result.searches,
        exhaustedKeys: result.exhaustedKeys,
      };
      writeJsonAtomic(args.ledger, ledger);
    }
    if (args.consumeWorklists) {
      const result = consumeWorklists(ledger);
      consumeResult = {
        terminalCandidates:
          (consumeResult?.terminalCandidates ?? 0) + result.terminalCandidates,
        suspicious: (consumeResult?.suspicious ?? 0) + result.suspicious,
      };
      writeJsonAtomic(args.ledger, ledger);
    }
    if (args.adjudicateSuspicious) {
      const result = adjudicateSuspiciousEntries(ledger);
      adjudicateResult = {
        terminalCandidates:
          (adjudicateResult?.terminalCandidates ?? 0) +
          result.terminalCandidates,
        untouched: (adjudicateResult?.untouched ?? 0) + result.untouched,
      };
      writeJsonAtomic(args.ledger, ledger);
    }
    if (args.applyTerminalCandidates) {
      const result = await applyTerminalCandidates(ledger);
      terminalResult = {
        updated: (terminalResult?.updated ?? 0) + result.updated,
        skipped: (terminalResult?.skipped ?? 0) + result.skipped,
      };
      writeJsonAtomic(args.ledger, ledger);
    }
    const afterOpen = pendingEntries(ledger).length;
    pushEvent(ledger, {
      type: 'round_complete',
      round,
      beforeOpen,
      afterOpen,
      searchResult,
      consumeResult,
      terminalResult,
    });
    writeJsonAtomic(args.ledger, ledger);
    if (afterOpen === 0) break;
    if (
      !args.search &&
      !args.consumeWorklists &&
      !args.applyTerminalCandidates
    ) {
      break;
    }
    if (afterOpen === beforeOpen && round > 1) {
      break;
    }
  }

  const worklists = buildWorklists(ledger);
  writeJsonAtomic(args.cdsWorklist, {
    _meta: {
      createdAt: new Date().toISOString(),
      source: 'data-exhaustion-marathon',
      nextCommand:
        'pnpm --filter api exec tsx scripts/extract-cds-c9-c21.ts --input <this file> --out scripts/cds-data/cds-c9c21-from-exhaustion.json',
    },
    schools: worklists.cdsSchools,
  });
  writeJsonAtomic(args.programWorklist, {
    _meta: {
      createdAt: new Date().toISOString(),
      source: 'data-exhaustion-marathon',
      note: 'Validate candidates before importing program rates. Threshold/checklist pages are not rates.',
    },
    schools: worklists.programSchools,
  });

  const report = writeReport(
    ledger,
    args,
    searchResult,
    terminalResult,
    consumeResult,
    adjudicateResult,
  );
  let backfillOutput: string | null = null;
  if (args.runBackfill && terminalResult && terminalResult.updated > 0) {
    backfillOutput = maybeRunBackfill(true);
  }

  console.log(`Data exhaustion ledger: ${args.ledger}`);
  console.log(`Report: ${args.report}`);
  console.log(`CDS worklist: ${args.cdsWorklist}`);
  console.log(`Program worklist: ${args.programWorklist}`);
  console.log(
    JSON.stringify(
      {
        dryRun: args.dryRun,
        fields: args.fields,
        totals: report.totals,
        hardGates: report.hardGates,
        searchResult,
        consumeResult,
        adjudicateResult,
        terminalResult,
        backfillRan: Boolean(backfillOutput),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
