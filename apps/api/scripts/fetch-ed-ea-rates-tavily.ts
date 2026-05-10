#!/usr/bin/env tsx
/**
 * Intelligent ED/EA admit-rate sweep.
 *
 * CDS C21 is only one source. This script searches official admissions/news
 * pages and approved secondary aggregators, extracts ED/EA rates, validates
 * them against school-level admit rates, and writes both value + provenance.
 */
import 'dotenv/config';

import { Prisma, PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

type RoundField = 'edAcceptanceRate' | 'eaAcceptanceRate';
type SourceFamily = 'OFFICIAL_SCHOOL' | 'SECONDARY_AGGREGATOR';

interface Candidate {
  title: string;
  url: string;
  snippet: string;
  score: number;
  stage: number;
  sourceFamily: SourceFamily;
  accepted: boolean;
  rejectReason?: string;
}

interface ExtractedRoundRate {
  field: RoundField;
  rate: number;
  sourceUrl: string;
  sourceFamily: SourceFamily;
  title: string;
  formula?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface SearchPlan {
  stage: number;
  query: string;
  includeDomains?: string[];
  field: RoundField;
  expected: SourceFamily;
}

interface SchoolTarget {
  id: string;
  name: string;
  aliases: string[];
  website: string | null;
  rootDomain: string | null;
  acceptanceRate: number | null;
  edAcceptanceRate: number | null;
  eaAcceptanceRate: number | null;
  hasEarlyDecision: boolean | null;
  metadata: Prisma.JsonValue | null;
}

const NO_ED_NAME_PATTERNS = [
  /university of california/i,
  /\buc berkeley\b/i,
  /\bucla\b/i,
  /\buc davis\b/i,
  /\buc irvine\b/i,
  /\buc san diego\b/i,
  /\buc santa barbara\b/i,
  /\buc santa cruz\b/i,
  /\buc riverside\b/i,
  /\buc merced\b/i,
  /juilliard/i,
  /curtis institute/i,
  /california institute of the arts/i,
  /\bcalarts\b/i,
  /artcenter/i,
  /school of the art institute/i,
  /rhode island school of design/i,
];

const KNOWN_NO_PUBLIC_ROUND_RATE = [
  /harvard/i,
  /stanford/i,
  /princeton/i,
  /\bmit\b|massachusetts institute of technology/i,
  /yale/i,
  /university of chicago/i,
];

function loadDotEnv() {
  for (const file of [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'apps/api/.env'),
  ]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
      if (match && process.env[match[1]] == null) {
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
      }
    }
  }
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const has = (name: string) => argv.includes(`--${name}`);
  const get = (name: string, fallback?: string) => {
    const idx = argv.indexOf(`--${name}`);
    if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
    const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
    return inline ? inline.slice(name.length + 3) : fallback;
  };
  const fields = new Set(
    (get('fields', 'ed,ea') ?? 'ed,ea')
      .split(',')
      .map((v) => v.trim().toLowerCase()),
  );
  const namesRaw = get('names');
  const namePatterns = namesRaw
    ? namesRaw
        .split(',')
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    : null;
  return {
    dryRun: has('dry-run'),
    all: has('all'),
    overwriteExisting: has('overwrite-existing'),
    recheckTerminal: has('recheck-terminal'),
    applyTerminal: has('apply-terminal'),
    limit: Number(get('limit', '9999')),
    maxResults: Number(get('max-results', '6')),
    delayMs: Number(get('delay-ms', '350')),
    fieldEd: fields.has('ed') || fields.has('both'),
    fieldEa: fields.has('ea') || fields.has('both'),
    namePatterns,
    out:
      get('out') ??
      `apps/api/scripts/cds-data/ed-ea-tavily-results-${new Date().toISOString().slice(0, 10)}.json`,
  };
}

function tavilyKeys() {
  const keys: string[] = [];
  const packed = process.env.TAVILY_API_KEYS;
  if (packed)
    keys.push(
      ...packed
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean),
    );
  if (process.env.TAVILY_API_KEY) keys.push(process.env.TAVILY_API_KEY);
  for (let index = 1; index <= 99; index++) {
    const key = process.env[`TAVILY_API_KEY_${index}`];
    if (key) keys.push(key);
  }
  return [...new Set(keys)];
}

class TavilyRotator {
  private index = 0;
  private exhausted = new Set<number>();

  constructor(
    private readonly keys: string[],
    private readonly maxResults: number,
  ) {}

  async search(plan: SearchPlan): Promise<Candidate[]> {
    const key = this.nextKey();
    if (!key) return [];
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key.value,
        query: plan.query,
        include_domains: plan.includeDomains?.length
          ? plan.includeDomains
          : undefined,
        max_results: this.maxResults,
        search_depth: 'advanced',
        include_answer: false,
        include_raw_content: false,
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      if (
        res.status === 429 ||
        res.status === 432 ||
        /quota|limit|usage/i.test(body)
      ) {
        this.exhausted.add(key.index);
      } else {
        console.warn(`  Tavily ${res.status}: ${body.slice(0, 100)}`);
      }
      return [];
    }
    const parsed = JSON.parse(body) as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        score?: number;
      }>;
    };
    return (parsed.results ?? [])
      .filter((result) => result.url)
      .map((result, idx) => {
        const url = normalizeUrl(result.url ?? '');
        return {
          title: result.title ?? '',
          url,
          snippet: result.content?.slice(0, 1200) ?? '',
          score:
            typeof result.score === 'number'
              ? Math.round(result.score * 100)
              : Math.max(20, 80 - idx * 5),
          stage: plan.stage,
          sourceFamily: plan.expected,
          accepted: false,
        };
      });
  }

  private nextKey() {
    for (let offset = 0; offset < this.keys.length; offset++) {
      const idx = (this.index + offset) % this.keys.length;
      if (!this.exhausted.has(idx)) {
        this.index = (idx + 1) % this.keys.length;
        return { value: this.keys[idx], index: idx };
      }
    }
    return null;
  }
}

async function main() {
  loadDotEnv();
  const args = parseArgs();
  const keys = tavilyKeys();
  if (!keys.length) throw new Error('No Tavily keys configured.');

  const where: Prisma.SchoolWhereInput = {
    country: { in: ['US', 'United States'] },
  };
  if (args.namePatterns && args.namePatterns.length > 0) {
    where.OR = args.namePatterns.map((pattern) => ({
      name: { contains: pattern, mode: 'insensitive' as const },
    }));
  }
  const schools = await prisma.school.findMany({
    where,
    orderBy: [{ usNewsRank: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    take: args.limit,
    select: {
      id: true,
      name: true,
      aliases: true,
      website: true,
      acceptanceRate: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      hasEarlyDecision: true,
      metadata: true,
    },
  });

  const rotator = new TavilyRotator(keys, args.maxResults);
  const report = {
    _meta: {
      generatedAt: new Date().toISOString(),
      dryRun: args.dryRun,
      keys: keys.length,
    },
    schools: [] as Array<{
      school: string;
      extracted: ExtractedRoundRate[];
      terminal: Array<{ field: RoundField; reason: string }>;
      candidates: Candidate[];
      queries: SearchPlan[];
    }>,
    summary: { updated: 0, terminal: 0, notFound: 0, skipped: 0, errors: 0 },
  };

  for (const school of schools.map(normalizeSchool)) {
    const fields = fieldsForSchool(
      school,
      args.all,
      args.overwriteExisting,
      args.recheckTerminal,
      args.fieldEd,
      args.fieldEa,
    );
    if (!fields.length) {
      report.summary.skipped += 1;
      continue;
    }

    const terminal: Array<{ field: RoundField; reason: string }> = [];
    const extracted: ExtractedRoundRate[] = [];
    const candidates: Candidate[] = [];
    const queries: SearchPlan[] = [];

    for (const field of fields) {
      const terminalReason = terminalReasonBeforeSearch(school, field);
      if (terminalReason) {
        terminal.push({ field, reason: terminalReason });
        if (!args.dryRun && args.applyTerminal) {
          await writeRoundTerminal(school, field, terminalReason, [], []);
        }
        report.summary.terminal += 1;
        continue;
      }

      const plans = buildPlans(school, field);
      queries.push(...plans);
      let found: ExtractedRoundRate | null = null;
      for (const plan of plans) {
        const raw = await rotator.search(plan);
        const scored = scoreCandidates(school, field, raw);
        candidates.push(...scored);
        found = extractBestRate(school, field, scored);
        if (found) break;
        await sleep(args.delayMs);
      }

      if (found) {
        extracted.push(found);
        if (!args.dryRun) {
          await applyRoundRate(school, found, queries, candidates);
        }
        report.summary.updated += 1;
      } else {
        report.summary.notFound += 1;
        const reason =
          'Searched official admissions/news pages and approved secondary sources; no validated round admit rate found.';
        terminal.push({ field, reason });
        if (!args.dryRun && args.applyTerminal) {
          await writeRoundTerminal(school, field, reason, queries, candidates);
        }
      }
    }

    report.schools.push({
      school: school.name,
      extracted,
      terminal,
      candidates: candidates.sort((a, b) => b.score - a.score).slice(0, 10),
      queries,
    });
    console.log(
      `${school.name}: updated=${extracted.length} terminal=${terminal.length} candidates=${candidates.length}`,
    );
  }

  writeJson(args.out, report);
  console.log(`\nED/EA sweep report: ${args.out}`);
  console.log(report.summary);
}

function normalizeSchool(row: {
  id: string;
  name: string;
  aliases: string[];
  website: string | null;
  acceptanceRate: Prisma.Decimal | null;
  edAcceptanceRate: Prisma.Decimal | null;
  eaAcceptanceRate: Prisma.Decimal | null;
  hasEarlyDecision: boolean | null;
  metadata: Prisma.JsonValue | null;
}): SchoolTarget {
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases ?? [],
    website: row.website,
    rootDomain: rootDomain(row.website),
    acceptanceRate: decimal(row.acceptanceRate),
    edAcceptanceRate: decimal(row.edAcceptanceRate),
    eaAcceptanceRate: decimal(row.eaAcceptanceRate),
    hasEarlyDecision: row.hasEarlyDecision,
    metadata: row.metadata,
  };
}

function fieldsForSchool(
  school: SchoolTarget,
  all: boolean,
  overwriteExisting: boolean,
  recheckTerminal: boolean,
  includeEd: boolean,
  includeEa: boolean,
): RoundField[] {
  const fields: RoundField[] = [];
  const provenance = provenanceFor(school.metadata);
  if (
    includeEd &&
    !isTerminalRoundProvenance(provenance.edAcceptanceRate, recheckTerminal) &&
    (school.edAcceptanceRate == null || (all && overwriteExisting))
  )
    fields.push('edAcceptanceRate');
  if (
    includeEa &&
    !isTerminalRoundProvenance(provenance.eaAcceptanceRate, recheckTerminal) &&
    (school.eaAcceptanceRate == null || (all && overwriteExisting))
  )
    fields.push('eaAcceptanceRate');
  return fields;
}

function isTerminalRoundProvenance(value: unknown, recheckTerminal: boolean) {
  if (recheckTerminal || !isRecord(value)) return false;
  const status = String(value.realDataStatus ?? '').toUpperCase();
  const source = String(value.source ?? '').toUpperCase();
  return (
    source === 'TERMINAL' ||
    status === 'NO_PUBLIC_ROUND_RATE' ||
    status === 'OFFICIAL_BLANK_SECTION' ||
    status === 'OFFICIAL_BLOCKED' ||
    status === 'NOT_APPLICABLE'
  );
}

function provenanceFor(metadata: Prisma.JsonValue | null) {
  const record = asRecord(metadata);
  return asRecord(record?.provenance) ?? {};
}

function terminalReasonBeforeSearch(school: SchoolTarget, field: RoundField) {
  const name = school.name.toLowerCase();
  if (field === 'edAcceptanceRate') {
    if (school.hasEarlyDecision === false)
      return 'NOT_APPLICABLE: school has no Early Decision plan.';
    if (NO_ED_NAME_PATTERNS.some((pattern) => pattern.test(school.name))) {
      return 'NOT_APPLICABLE: school/program type does not offer Early Decision for freshman applicants.';
    }
  }
  if (KNOWN_NO_PUBLIC_ROUND_RATE.some((pattern) => pattern.test(name))) {
    return 'NO_PUBLIC_ROUND_RATE: school is known to withhold separate early-round admit rates.';
  }
  return null;
}

function buildPlans(school: SchoolTarget, field: RoundField): SearchPlan[] {
  const root = school.rootDomain ? [school.rootDomain] : undefined;
  const round =
    field === 'edAcceptanceRate' ? 'early decision' : 'early action';
  const short = field === 'edAcceptanceRate' ? 'ED' : 'EA';
  const plans: SearchPlan[] = [];
  if (root) {
    plans.push({
      stage: 1,
      field,
      expected: 'OFFICIAL_SCHOOL',
      includeDomains: root,
      query: `"${school.name}" "${round}" "acceptance rate" "class of 2030"`,
    });
    plans.push({
      stage: 2,
      field,
      expected: 'OFFICIAL_SCHOOL',
      includeDomains: root,
      query: `"${school.name}" "${round}" admitted applicants applications class profile`,
    });
  }
  plans.push({
    stage: 3,
    field,
    expected: 'OFFICIAL_SCHOOL',
    query: `"${school.name}" "${round}" "acceptance rate" OR "${short} acceptance rate" "class of 2029"`,
  });
  plans.push({
    stage: 4,
    field,
    expected: 'SECONDARY_AGGREGATOR',
    includeDomains: ['collegetransitions.com'],
    query: `"${school.name}" "${round}" "acceptance rate" CollegeTransitions`,
  });
  return plans;
}

function scoreCandidates(
  school: SchoolTarget,
  field: RoundField,
  candidates: Candidate[],
) {
  return candidates.map((candidate) => {
    const haystack =
      `${candidate.title} ${candidate.url} ${candidate.snippet}`.toLowerCase();
    let score = candidate.score;
    const host = hostOf(candidate.url);
    const official =
      school.rootDomain &&
      (host === school.rootDomain || host.endsWith(`.${school.rootDomain}`));
    const approvedSecondary = host.endsWith('collegetransitions.com');
    const sourceFamily: SourceFamily = official
      ? 'OFFICIAL_SCHOOL'
      : 'SECONDARY_AGGREGATOR';
    if (!official && !approvedSecondary) {
      return {
        ...candidate,
        sourceFamily,
        score: Math.max(0, score - 80),
        accepted: false,
        rejectReason: 'not official school domain or approved secondary source',
      };
    }
    if (official) score += 35;
    if (approvedSecondary) score += 12;
    if (
      /admission|admissions|news|ir|oir|institutional|profile|class/.test(
        haystack,
      )
    )
      score += 10;
    if (
      /acceptance rate|admit rate|admitted|applicants|applications/.test(
        haystack,
      )
    )
      score += 20;
    if (
      field === 'edAcceptanceRate' &&
      /early decision|\bed\s?(?:i|ii|1|2)?\b/.test(haystack)
    )
      score += 20;
    if (
      field === 'eaAcceptanceRate' &&
      /early action|\bea\b|\brea\b|\bscea\b/.test(haystack)
    )
      score += 20;
    if (
      /graduate|mba|law school|medical school|transfer|waitlist|checklist|requirements|reddit|college confidential/.test(
        haystack,
      )
    ) {
      score -= 55;
    }
    const accepted = score >= 75;
    return {
      ...candidate,
      sourceFamily,
      score,
      accepted,
      rejectReason: accepted ? undefined : 'below ED/EA trust threshold',
    };
  });
}

function extractBestRate(
  school: SchoolTarget,
  field: RoundField,
  candidates: Candidate[],
): ExtractedRoundRate | null {
  const accepted = candidates
    .filter((candidate) => candidate.accepted)
    .sort((a, b) => b.score - a.score);
  for (const candidate of accepted) {
    if (
      field === 'eaAcceptanceRate' &&
      candidate.sourceFamily === 'SECONDARY_AGGREGATOR' &&
      !/\bearly\s+action\b|\bEA\s+acceptance\b|\bEA\s+admit/i.test(
        `${candidate.title}\n${candidate.snippet}`,
      )
    ) {
      candidate.rejectReason =
        'secondary source did not explicitly publish an Early Action admit rate';
      candidate.accepted = false;
      continue;
    }
    const extracted = extractRoundRateFromText(
      field,
      `${candidate.title}\n${candidate.snippet}`,
    );
    if (!extracted) continue;
    const valid = validateRoundRate(
      field,
      extracted.rate,
      school.acceptanceRate,
    );
    if (!valid.ok) {
      candidate.rejectReason = valid.reason;
      candidate.accepted = false;
      continue;
    }
    return {
      field,
      rate: extracted.rate,
      sourceUrl: candidate.url,
      sourceFamily: candidate.sourceFamily,
      title: candidate.title,
      formula: extracted.formula,
      confidence:
        candidate.sourceFamily === 'OFFICIAL_SCHOOL' ? 'HIGH' : 'MEDIUM',
    };
  }
  return null;
}

function extractRoundRateFromText(field: RoundField, text: string) {
  const round =
    field === 'edAcceptanceRate'
      ? String.raw`(?:early[\s-]?decision|\bED\s?(?:I|II|1|2)?\b)`
      : String.raw`(?:early[\s-]?action|\bEA\b|\bREA\b|\bSCEA\b)`;
  const patterns = [
    new RegExp(
      `${round}[^.]{0,140}?(?:acceptance\\s+rate|admit\\s+rate|admitted|accepted)[^.]{0,80}?(\\d{1,2}(?:\\.\\d+)?)\\s*%`,
      'i',
    ),
    new RegExp(
      `(\\d{1,2}(?:\\.\\d+)?)\\s*%[^.]{0,140}?(?:acceptance\\s+rate|admit\\s+rate|admitted|accepted)[^.]{0,80}?${round}`,
      'i',
    ),
    new RegExp(
      `${round}[^.]{0,120}?(?:admitted|accepted)[^.]{0,80}?(\\d{1,2}(?:\\.\\d+)?)\\s*%`,
      'i',
    ),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match)
      return {
        rate: Number(match[1]),
        formula: 'rate extracted from published percent',
      };
  }

  const numbers = extractAppliedAdmitted(field, text);
  if (numbers && numbers.applied > 0 && numbers.admitted > 0) {
    const rate = Math.round((numbers.admitted / numbers.applied) * 10000) / 100;
    return {
      rate,
      formula: `${numbers.admitted}/${numbers.applied}*100=${rate}%`,
    };
  }
  return null;
}

function extractAppliedAdmitted(field: RoundField, text: string) {
  const round =
    field === 'edAcceptanceRate'
      ? /early[\s-]?decision|\bED\s?(?:I|II|1|2)?\b/i
      : /early[\s-]?action|\bEA\b|\bREA\b|\bSCEA\b/i;
  const normalized = text.replace(/,/g, '');
  for (const match of normalized.matchAll(new RegExp(round, 'gi'))) {
    const start = Math.max(0, match.index - 250);
    const end = Math.min(normalized.length, match.index + 500);
    const window = normalized.slice(start, end);
    const applied =
      window.match(
        /(\d{3,6})\s+(?:students\s+)?(?:applied|applications|applicants)/i,
      ) ??
      window.match(/(?:applied|applications|applicants)[^0-9]{0,40}(\d{3,6})/i);
    const admitted =
      window.match(
        /(\d{2,6})\s+(?:students\s+)?(?:admitted|accepted|admits)/i,
      ) ?? window.match(/(?:admitted|accepted|admits)[^0-9]{0,40}(\d{2,6})/i);
    if (applied && admitted) {
      return { applied: Number(applied[1]), admitted: Number(admitted[1]) };
    }
  }
  return null;
}

function validateRoundRate(
  field: RoundField,
  rate: number,
  overall: number | null,
) {
  if (!Number.isFinite(rate) || rate < 1 || rate > 95) {
    return { ok: false, reason: `invalid range ${rate}` };
  }
  if (field === 'edAcceptanceRate' && overall != null && rate < overall * 0.9) {
    return {
      ok: false,
      reason: `ED rate ${rate}% is implausibly below overall ${overall}%`,
    };
  }
  return { ok: true };
}

async function applyRoundRate(
  school: SchoolTarget,
  extracted: ExtractedRoundRate,
  queries: SearchPlan[],
  candidates: Candidate[],
) {
  const metricKey =
    extracted.field === 'edAcceptanceRate'
      ? 'ed_acceptance_rate'
      : 'ea_acceptance_rate';
  await prisma.$transaction([
    prisma.school.update({
      where: { id: school.id },
      data: {
        [extracted.field]: new Prisma.Decimal(extracted.rate),
        metadata: await mergedMetadata(school.id, {
          provenance: {
            [extracted.field]: provenancePayload(
              extracted,
              queries,
              candidates,
            ),
          },
        }),
      } as Prisma.SchoolUpdateInput,
    }),
    prisma.schoolMetric.upsert({
      where: {
        schoolId_year_metricKey: {
          schoolId: school.id,
          year: 2026,
          metricKey,
        },
      },
      create: {
        schoolId: school.id,
        year: 2026,
        metricKey,
        value: new Prisma.Decimal(extracted.rate),
      },
      update: {
        value: new Prisma.Decimal(extracted.rate),
      },
    }),
  ]);
}

async function writeRoundTerminal(
  school: SchoolTarget,
  field: RoundField,
  reason: string,
  queries: SearchPlan[],
  candidates: Candidate[],
) {
  await prisma.school.update({
    where: { id: school.id },
    data: {
      metadata: await mergedMetadata(school.id, {
        provenance: {
          [field]: {
            realDataStatus: 'NO_PUBLIC_ROUND_RATE',
            source: 'TERMINAL',
            reason,
            searchedQueries: toJsonValue(queries),
            candidates: toJsonValue(candidates.slice(0, 10)),
            verifiedAt: new Date().toISOString(),
            generatedBy: 'fetch-ed-ea-rates-tavily',
          },
        },
      }),
    },
  });
}

function provenancePayload(
  extracted: ExtractedRoundRate,
  queries: SearchPlan[],
  candidates: Candidate[],
): Prisma.JsonObject {
  return {
    realDataStatus:
      extracted.sourceFamily === 'SECONDARY_AGGREGATOR'
        ? 'VERIFIED_SECONDARY'
        : 'VERIFIED_REAL',
    source: extracted.sourceFamily,
    sourceUrl: extracted.sourceUrl,
    value: extracted.rate,
    confidence: extracted.confidence,
    formula: extracted.formula,
    searchedQueries: toJsonValue(queries),
    candidates: toJsonValue(candidates.slice(0, 10)),
    verifiedAt: new Date().toISOString(),
    generatedBy: 'fetch-ed-ea-rates-tavily',
  };
}

function toJsonValue(value: unknown): Prisma.JsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
}

async function mergedMetadata(schoolId: string, patch: Prisma.JsonObject) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { metadata: true },
  });
  return deepMerge(asRecord(school?.metadata) ?? {}, patch);
}

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Prisma.JsonObject {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (isRecord(out[key]) && isRecord(value))
      out[key] = deepMerge(out[key] as Record<string, unknown>, value);
    else out[key] = value;
  }
  return out as Prisma.JsonObject;
}

function rootDomain(website: string | null) {
  if (!website) return null;
  try {
    const host = new URL(website).hostname.replace(/^www\./, '').toLowerCase();
    const parts = host.split('.');
    return parts.length > 2 ? parts.slice(-2).join('.') : host;
  } catch {
    return null;
  }
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
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

function decimal(value: Prisma.Decimal | null) {
  return value == null ? null : value.toNumber();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown) {
  return isRecord(value) ? value : null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeJson(file: string, value: unknown) {
  const full = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(value, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
