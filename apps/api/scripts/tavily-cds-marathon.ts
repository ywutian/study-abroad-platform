#!/usr/bin/env ts-node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

type SearchStatus =
  | 'PENDING'
  | 'URL_FOUND'
  | 'NO_PUBLIC_REAL_DATA'
  | 'OFFICIAL_BLOCKED'
  | 'OFFICIAL_BLANK'
  | 'MANUAL_REVIEW'
  | 'PERMANENT_HEURISTIC';

type KeyStatus = 'ACTIVE' | 'EXHAUSTED' | 'RATE_LIMITED';

interface TavilyKeyLedger {
  name: string;
  status: KeyStatus;
  calls: number;
  quotaErrors: number;
  successes: number;
  lastStatus?: number;
  lastUsedAt?: string;
  exhaustedAt?: string;
  lastError?: string;
}

interface SchoolLedger {
  schoolId: string;
  schoolName: string;
  schoolNameNorm: string;
  usNewsRank: number | null;
  website: string | null;
  missingFields: string[];
  status: SearchStatus;
  priority: number;
  nextStage: number;
  attempts: number;
  selectedUrl?: string | null;
  selectedTitle?: string | null;
  selectedStage?: number | null;
  lastQuery?: string;
  lastError?: string;
  reason?: string;
  updatedAt: string;
}

interface MarathonLedger {
  _meta: {
    version: 1;
    startedAt: string;
    updatedAt: string;
    targetExhaustedKeys: number;
    cycleLabel: string;
    fields: string[];
  };
  keys: Record<string, TavilyKeyLedger>;
  schools: Record<string, SchoolLedger>;
  events: Array<Record<string, unknown>>;
}

interface Candidate {
  title: string;
  url: string;
  snippet?: string;
  score: number;
}

const prisma = new PrismaClient();
const US_COUNTRIES = ['US', 'United States', 'United States of America'];
const TERMINAL = new Set<SearchStatus>([
  'URL_FOUND',
  'NO_PUBLIC_REAL_DATA',
  'OFFICIAL_BLOCKED',
  'OFFICIAL_BLANK',
  'MANUAL_REVIEW',
  'PERMANENT_HEURISTIC',
]);

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
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const has = (name: string) => args.includes(`--${name}`);
  const today = new Date().toISOString().slice(0, 10);
  return {
    ledger:
      get('ledger') ??
      path.join(cdsDataDir(), `tavily-marathon-ledger-${today}.json`),
    registry:
      get('registry') ??
      path.join(cdsDataDir(), `tavily-marathon-registry-${today}.json`),
    cycleLabel: get('cycle') ?? '2024-25',
    fields: (get('fields') ?? 'intlAcceptanceRate,oosAcceptanceRate')
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean),
    targetExhaustedKeys: Number(get('target-exhausted-keys') ?? 15),
    maxStages: Number(get('max-stages') ?? 5),
    maxResults: Number(get('max-results') ?? 8),
    limit: Number(get('limit') ?? 240),
    delayMs: Number(get('delay-ms') ?? 250),
    dryRun: has('dry-run'),
    reset: has('reset'),
  };
}

function loadTavilyKeys(targetCount: number) {
  const keys: Array<{ name: string; apiKey: string }> = [];
  const packed = process.env.TAVILY_API_KEYS;
  if (packed) {
    for (const [idx, apiKey] of packed
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .entries()) {
      keys.push({ name: `TAVILY_API_KEYS_${idx + 1}`, apiKey });
    }
  }
  const single = process.env.TAVILY_API_KEY;
  if (single) keys.push({ name: 'TAVILY_API_KEY', apiKey: single });
  for (let n = 1; n <= 99; n++) {
    const apiKey = process.env[`TAVILY_API_KEY_${n}`];
    if (!apiKey) continue;
    if (!keys.some((k) => k.apiKey === apiKey)) {
      keys.push({ name: `TAVILY_API_KEY_${n}`, apiKey });
    }
  }
  return keys.slice(0, targetCount);
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

function isHeuristic(metadata: unknown, field: string) {
  const meta = record(metadata);
  const provenance = record(record(meta.provenance)[field]);
  const source = String(provenance.source ?? '').toUpperCase();
  const tier = String(provenance.tier ?? '').toUpperCase();
  return tier === 'INFERRED' || source.includes('HEURISTIC');
}

function isPermanent(metadata: unknown, field: string) {
  const meta = record(metadata);
  const provenance = record(record(meta.provenance)[field]);
  return (
    provenance.permanent === true ||
    provenance.source === 'PERMANENT_HEURISTIC' ||
    provenance.realDataStatus === 'NO_PUBLIC_REAL_DATA'
  );
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
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
        ].includes(part.toLowerCase()),
    )
    .map((part) => part[0])
    .join('')
    .toLowerCase();
}

function aliasesFor(schoolNameNorm: string) {
  const explicit: Record<string, string[]> = {
    'florida state university': ['fsu'],
    'rensselaer polytechnic institute': ['rpi', 'rensselaer'],
    'north dakota state university': ['ndsu'],
    'central michigan university': ['cmich', 'centralmichigan'],
    'carnegie mellon university': ['cmu', 'carnegiemellon'],
    'indiana university-purdue university indianapolis': [
      'iupui',
      'indianapolis.iu',
    ],
    'california state university, fullerton': ['fullerton', 'csuf'],
    'california state university, northridge': ['northridge', 'csun'],
    'california state university, sacramento': ['csus', 'sacramento'],
    'california polytechnic state university, san luis obispo': [
      'calpoly',
      'cal-poly',
    ],
    'south dakota state university': ['sdstate'],
  };
  return explicit[schoolNameNorm] ?? [];
}

function scoreCandidate(candidate: Candidate) {
  const haystack =
    `${candidate.title} ${candidate.url} ${candidate.snippet ?? ''}`.toLowerCase();
  let score = candidate.score;
  if (haystack.includes('common data set')) score += 50;
  if (/\bcds\b/.test(haystack)) score += 20;
  if (haystack.includes('2024-25') || haystack.includes('2024-2025')) {
    score += 30;
  }
  if (/\.(pdf|xlsx|docx)(\?|$)/i.test(candidate.url)) score += 25;
  if (haystack.includes('institutional research')) score += 10;
  if (haystack.includes('factbook') || haystack.includes('class profile')) {
    score += 8;
  }
  return score;
}

function candidateMatchesSchool(
  candidate: Candidate,
  school: { name: string; nameNorm: string; website: string | null },
) {
  const candidateText = `${candidate.title} ${candidate.url}`.toLowerCase();
  try {
    const host = new URL(candidate.url).hostname
      .toLowerCase()
      .replace(/^www\./, '');
    const root = rootDomain(school.website);
    if (root && (host === root || host.endsWith(`.${root}`))) return true;
  } catch {
    return false;
  }

  for (const alias of [...aliasesFor(school.nameNorm), acronym(school.name)]) {
    if (alias && candidateText.includes(alias)) return true;
  }

  const tokens = school.nameNorm
    .replace(/[^a-z0-9 ]+/g, ' ')
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
  return (
    tokens.length > 0 && tokens.some((token) => candidateText.includes(token))
  );
}

function buildStages(school: SchoolLedger, cycleLabel: string) {
  const root = rootDomain(school.website);
  const stages: Array<{ query: string; includeDomains?: string[] }> = [];
  if (root) {
    stages.push({
      query: `"common data set" "${cycleLabel}"`,
      includeDomains: [root],
    });
    stages.push({
      query: `"CDS" "C1" "in-state" "out-of-state" "international"`,
      includeDomains: [root],
    });
    stages.push({
      query: `"common data set" "xlsx" OR "docx" OR "html"`,
      includeDomains: [root],
    });
  }
  stages.push({
    query: `"${school.schoolName}" "Common Data Set" "${cycleLabel}" filetype:pdf`,
  });
  stages.push({
    query: `"${school.schoolName}" "first-year profile" "international" "admitted"`,
  });
  stages.push({
    query: `"${school.schoolName}" "resident" "nonresident" "admitted" "Fall 2024"`,
  });
  return stages;
}

async function tavilySearch(
  apiKey: string,
  query: string,
  maxResults: number,
  includeDomains?: string[],
) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: Math.min(maxResults, 10),
      search_depth: 'advanced',
      include_raw_content: false,
      include_domains: includeDomains,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    const err = new Error(
      `Tavily failed ${response.status}: ${text.slice(0, 300)}`,
    );
    (err as any).status = response.status;
    throw err;
  }
  const body = JSON.parse(text) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      score?: number;
    }>;
  };
  const seen = new Set<string>();
  return (body.results ?? [])
    .filter((item) => item.url)
    .map((item, idx) => ({
      title: item.title ?? '',
      url: normalizeUrl(item.url as string),
      snippet: item.content?.slice(0, 240),
      score:
        typeof item.score === 'number'
          ? Math.round(item.score * 100)
          : Math.max(0, 50 - idx * 5),
    }))
    .filter((candidate) => {
      if (seen.has(candidate.url)) return false;
      seen.add(candidate.url);
      return true;
    })
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate),
    }))
    .sort((a, b) => b.score - a.score);
}

function isQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /failed (429|432)|usage limit|exceeds.*plan|rate.?limit|quota/i.test(
    message,
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildInitialSchoolLedger(fields: string[], limit: number) {
  const schools = await prisma.school.findMany({
    where: { country: { in: US_COUNTRIES } },
    select: {
      id: true,
      name: true,
      nameNorm: true,
      usNewsRank: true,
      website: true,
      metadata: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
    },
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
  });

  return schools
    .map((school) => {
      const missingFields = fields.filter((field) => {
        if (isPermanent(school.metadata, field)) return false;
        const value = (school as any)[field];
        return value == null || isHeuristic(school.metadata, field);
      });
      if (missingFields.length === 0) return null;
      const rank = school.usNewsRank ?? 999;
      const priority =
        missingFields.length * 1000 +
        Math.max(0, 300 - rank) +
        (school.website ? 25 : 0);
      return {
        schoolId: school.id,
        schoolName: school.name,
        schoolNameNorm: school.nameNorm,
        usNewsRank: school.usNewsRank,
        website: school.website,
        missingFields,
        status: 'PENDING' as SearchStatus,
        priority,
        nextStage: 0,
        attempts: 0,
        updatedAt: new Date().toISOString(),
      };
    })
    .filter((row): row is SchoolLedger => row != null)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

function createLedger(
  keys: Array<{ name: string; apiKey: string }>,
  schools: SchoolLedger[],
  targetExhaustedKeys: number,
  cycleLabel: string,
  fields: string[],
): MarathonLedger {
  return {
    _meta: {
      version: 1,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetExhaustedKeys,
      cycleLabel,
      fields,
    },
    keys: Object.fromEntries(
      keys.map((key) => [
        key.name,
        {
          name: key.name,
          status: 'ACTIVE' as KeyStatus,
          calls: 0,
          quotaErrors: 0,
          successes: 0,
        },
      ]),
    ),
    schools: Object.fromEntries(
      schools.map((school) => [school.schoolId, school]),
    ),
    events: [],
  };
}

function nextActiveKey(
  keys: Array<{ name: string; apiKey: string }>,
  ledger: MarathonLedger,
  lastIndex: number,
) {
  for (let offset = 0; offset < keys.length; offset++) {
    const idx = (lastIndex + offset) % keys.length;
    const state = ledger.keys[keys[idx].name];
    if (state?.status === 'ACTIVE') return { key: keys[idx], index: idx };
  }
  return null;
}

function pendingSchools(ledger: MarathonLedger) {
  return Object.values(ledger.schools)
    .filter((school) => !TERMINAL.has(school.status))
    .sort((a, b) => b.priority - a.priority || a.attempts - b.attempts);
}

function exhaustedCount(ledger: MarathonLedger) {
  return Object.values(ledger.keys).filter((key) => key.status === 'EXHAUSTED')
    .length;
}

function pushEvent(ledger: MarathonLedger, event: Record<string, unknown>) {
  ledger.events.push({ at: new Date().toISOString(), ...event });
  if (ledger.events.length > 1000) ledger.events = ledger.events.slice(-1000);
  ledger._meta.updatedAt = new Date().toISOString();
}

async function main() {
  loadDotEnv();
  const args = parseArgs();
  const keys = loadTavilyKeys(args.targetExhaustedKeys);
  if (keys.length === 0) throw new Error('No Tavily keys found in env.');

  const initialSchools = await buildInitialSchoolLedger(
    args.fields,
    args.limit,
  );
  const ledger =
    !args.reset && readJson<MarathonLedger>(args.ledger)
      ? (readJson<MarathonLedger>(args.ledger) as MarathonLedger)
      : createLedger(
          keys,
          initialSchools,
          args.targetExhaustedKeys,
          args.cycleLabel,
          args.fields,
        );

  for (const school of initialSchools) {
    ledger.schools[school.schoolId] ??= school;
  }
  for (const key of keys) {
    ledger.keys[key.name] ??= {
      name: key.name,
      status: 'ACTIVE',
      calls: 0,
      quotaErrors: 0,
      successes: 0,
    };
  }
  writeJsonAtomic(args.ledger, ledger);

  console.log(
    `Tavily CDS marathon: schools=${Object.keys(ledger.schools).length} keys=${keys.length} targetExhausted=${args.targetExhaustedKeys} dryRun=${args.dryRun}`,
  );
  if (args.dryRun) {
    console.log('Top pending schools:');
    for (const school of pendingSchools(ledger).slice(0, 20)) {
      console.log(
        `  ${school.usNewsRank ?? '-'} ${school.schoolName} fields=${school.missingFields.join(',')}`,
      );
    }
    return;
  }

  let keyIndex = 0;
  while (
    exhaustedCount(ledger) < args.targetExhaustedKeys &&
    pendingSchools(ledger).length > 0
  ) {
    const school = pendingSchools(ledger)[0];
    const stages = buildStages(school, args.cycleLabel);
    if (school.nextStage >= Math.min(args.maxStages, stages.length)) {
      school.status = 'NO_PUBLIC_REAL_DATA';
      school.reason = 'No official candidate found after all Tavily stages.';
      school.updatedAt = new Date().toISOString();
      pushEvent(ledger, {
        type: 'school_terminal',
        schoolName: school.schoolName,
        status: school.status,
      });
      writeJsonAtomic(args.ledger, ledger);
      continue;
    }

    const active = nextActiveKey(keys, ledger, keyIndex);
    if (!active) break;
    keyIndex = (active.index + 1) % keys.length;
    const keyState = ledger.keys[active.key.name];
    const stage = stages[school.nextStage];
    school.lastQuery = stage.query;
    school.attempts += 1;
    school.updatedAt = new Date().toISOString();
    keyState.calls += 1;
    keyState.lastUsedAt = new Date().toISOString();

    try {
      const candidates = await tavilySearch(
        active.key.apiKey,
        stage.query,
        args.maxResults,
        stage.includeDomains,
      );
      const filtered = candidates.filter((candidate) =>
        candidateMatchesSchool(candidate, {
          name: school.schoolName,
          nameNorm: school.schoolNameNorm,
          website: school.website,
        }),
      );
      if (filtered.length > 0) {
        school.status = 'URL_FOUND';
        school.selectedUrl = filtered[0].url;
        school.selectedTitle = filtered[0].title;
        school.selectedStage = school.nextStage + 1;
        keyState.successes += 1;
        pushEvent(ledger, {
          type: 'url_found',
          schoolName: school.schoolName,
          key: active.key.name,
          stage: school.selectedStage,
          url: school.selectedUrl,
        });
      } else {
        school.nextStage += 1;
        pushEvent(ledger, {
          type: 'no_candidate',
          schoolName: school.schoolName,
          key: active.key.name,
          stage: school.nextStage,
          rawCandidates: candidates.length,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      school.lastError = message;
      keyState.lastError = message;
      if (isQuotaError(error)) {
        keyState.status = 'EXHAUSTED';
        keyState.quotaErrors += 1;
        keyState.exhaustedAt = new Date().toISOString();
        pushEvent(ledger, {
          type: 'key_exhausted',
          key: active.key.name,
          schoolName: school.schoolName,
          error: message.slice(0, 240),
        });
      } else {
        school.status = 'MANUAL_REVIEW';
        school.reason = `Search failed: ${message.slice(0, 240)}`;
        pushEvent(ledger, {
          type: 'search_error',
          schoolName: school.schoolName,
          key: active.key.name,
          error: message.slice(0, 240),
        });
      }
    }

    writeJsonAtomic(args.ledger, ledger);
    if (args.delayMs > 0) await sleep(args.delayMs);
  }

  const found = Object.values(ledger.schools)
    .filter((school) => school.status === 'URL_FOUND')
    .map((school) => ({
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      schoolNameNorm: school.schoolNameNorm,
      usNewsRank: school.usNewsRank,
      missingFields: school.missingFields,
      selectedUrl: school.selectedUrl,
      selectedTitle: school.selectedTitle,
      selectedStage: school.selectedStage,
      query: school.lastQuery,
    }));
  const registry = {
    _meta: {
      generatedAt: new Date().toISOString(),
      source: 'tavily-cds-marathon',
      ledger: args.ledger,
      selectedUrls: found.length,
      exhaustedKeys: exhaustedCount(ledger),
      pendingSchools: pendingSchools(ledger).length,
    },
    schools: found,
  };
  writeJsonAtomic(args.registry, registry);
  console.log(
    `Done. exhaustedKeys=${exhaustedCount(ledger)} selectedUrls=${found.length} pending=${pendingSchools(ledger).length}`,
  );
  console.log(`Ledger: ${args.ledger}`);
  console.log(`Registry: ${args.registry}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
