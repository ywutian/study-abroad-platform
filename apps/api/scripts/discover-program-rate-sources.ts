#!/usr/bin/env ts-node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Candidate {
  title: string;
  url: string;
  snippet: string;
  score: number;
  heuristicScore: number;
}

interface LedgerSchool {
  schoolId: string;
  schoolName: string;
  schoolNameNorm: string;
  website: string | null;
  usNewsRank: number | null;
  missingFields: string[];
  status: 'MANUAL_REVIEW' | 'NO_PUBLIC_PROGRAM_DATA' | 'OFFICIAL_BLOCKED';
  selectedUrl: string | null;
  reason: string;
  candidates: Candidate[];
  searchedQueries: string[];
}

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
  return {
    limit: Number(get('limit') ?? '9999'),
    delayMs: Number(get('delay-ms') ?? '350'),
    maxResults: Number(get('max-results') ?? '5'),
    out:
      get('out') ??
      'scripts/cds-data/program-rates-terminal-official-search-2026-04-30.json',
  };
}

function tavilyKeys() {
  const keys: string[] = [];
  if (process.env.TAVILY_API_KEY) keys.push(process.env.TAVILY_API_KEY);
  for (let i = 1; i <= 50; i++) {
    const key = process.env[`TAVILY_API_KEY_${i}`];
    if (key) keys.push(key);
  }
  return [...new Set(keys)];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function officialRoot(website: string | null) {
  if (!website) return null;
  try {
    return new URL(website).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasProgramTerminal(metadata: unknown) {
  if (!isRecord(metadata) || !isRecord(metadata.provenance)) return false;
  const entry = metadata.provenance.programRates;
  if (!isRecord(entry)) return false;
  const status =
    typeof entry.realDataStatus === 'string'
      ? entry.realDataStatus.toUpperCase()
      : '';
  return [
    'VERIFIED_REAL',
    'OFFICIAL_REAL_LEGACY',
    'NO_PUBLIC_PROGRAM_DATA',
    'OFFICIAL_BLOCKED',
    'MANUAL_REVIEW',
  ].includes(status);
}

function scoreCandidate(title: string, url: string, snippet: string) {
  const haystack = `${title} ${url} ${snippet}`.toLowerCase();
  let score = 0;
  if (/\b(applicants?|applications?|applied)\b/.test(haystack)) score += 2;
  if (
    /\b(admitted|admits?|accepted|acceptances?|admit rate|acceptance rate)\b/.test(
      haystack,
    )
  ) {
    score += 2;
  }
  if (/\b(first[- ]?year|freshman|freshmen|incoming)\b/.test(haystack))
    score += 1;
  if (
    /\b(by college|college of|by major|major|program|discipline|department|school of)\b/.test(
      haystack,
    )
  ) {
    score += 2;
  }
  if (
    /\b(transfer|graduate|mba|master|phd|law school|medical school)\b/.test(
      haystack,
    )
  ) {
    score -= 2;
  }
  if (
    /\b(profile|factbook|dashboard|data|statistics|stats|admissions)\b/.test(
      haystack,
    )
  ) {
    score += 1;
  }
  return score;
}

function hasProgramRateSignals(candidate: Candidate) {
  const haystack =
    `${candidate.title} ${candidate.url} ${candidate.snippet}`.toLowerCase();
  const hasApplicantSignal = /\b(applicants?|applications?|applied)\b/.test(
    haystack,
  );
  const hasAdmitSignal =
    /\b(admitted|admits?|accepted|acceptances?|admit rate|acceptance rate)\b/.test(
      haystack,
    );
  const hasProgramSignal =
    /\b(by college|by major|major-specific|college of|program profile|by discipline|discipline|department)\b/.test(
      haystack,
    );
  const isMostlyGraduate =
    /\b(graduate|mba|master'?s|phd|doctoral|law school|medical school)\b/.test(
      haystack,
    ) && !/\b(first[- ]?year|freshman|freshmen|undergraduate)\b/.test(haystack);
  return (
    hasApplicantSignal &&
    hasAdmitSignal &&
    hasProgramSignal &&
    !isMostlyGraduate &&
    candidate.heuristicScore >= 5
  );
}

async function tavilySearch(
  apiKey: string,
  query: string,
  maxResults: number,
  includeDomain?: string,
): Promise<Candidate[]> {
  const body: Record<string, unknown> = {
    api_key: apiKey,
    query,
    max_results: maxResults,
    search_depth: 'advanced',
  };
  if (includeDomain) body.include_domains = [includeDomain];
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Tavily ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      score?: number;
    }>;
  };
  return (data.results ?? [])
    .filter((result) => result.url)
    .map((result, index) => {
      const title = result.title ?? '';
      const url = result.url ?? '';
      const snippet = result.content?.slice(0, 500) ?? '';
      return {
        title,
        url,
        snippet,
        score:
          typeof result.score === 'number' ? result.score : 1 / (index + 1),
        heuristicScore: scoreCandidate(title, url, snippet),
      };
    })
    .sort((a, b) => b.heuristicScore - a.heuristicScore || b.score - a.score);
}

function queriesFor(name: string, root: string | null) {
  const site = root ? `site:${root} ` : '';
  return [
    `${site}"first-year" "applicants" "admitted" "by college"`,
    `${site}"admit rate" "by major" "first-year"`,
    `${site}"admissions" "applications" "admitted" "college of"`,
    `"${name}" "first-year" "applicants" "admitted" "by college" official`,
  ];
}

async function main() {
  loadDotEnv();
  const args = parseArgs();
  const keys = tavilyKeys();
  if (keys.length === 0) {
    throw new Error('No Tavily API keys configured.');
  }

  const schools = await prisma.school.findMany({
    where: { programs: { none: {} } },
    select: {
      id: true,
      name: true,
      nameNorm: true,
      website: true,
      usNewsRank: true,
      metadata: true,
    },
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
    take: args.limit,
  });
  const targets = schools.filter(
    (school) => !hasProgramTerminal(school.metadata),
  );
  const ledger: LedgerSchool[] = [];
  let keyIndex = 0;

  for (const [index, school] of targets.entries()) {
    const root = officialRoot(school.website);
    const searchedQueries = queriesFor(school.name, root);
    const candidatesByUrl = new Map<string, Candidate>();
    for (const query of searchedQueries) {
      const key = keys[keyIndex++ % keys.length];
      try {
        const candidates = await tavilySearch(
          key,
          query,
          args.maxResults,
          root ?? undefined,
        );
        for (const candidate of candidates) {
          candidatesByUrl.set(candidate.url, candidate);
        }
      } catch (error) {
        console.warn(
          `[${index + 1}/${targets.length}] ${school.name}: ${query} -> ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      await sleep(args.delayMs);
    }

    const candidates = [...candidatesByUrl.values()]
      .filter(hasProgramRateSignals)
      .sort((a, b) => b.heuristicScore - a.heuristicScore || b.score - a.score)
      .slice(0, 5);

    const status =
      candidates.length > 0 ? 'MANUAL_REVIEW' : 'NO_PUBLIC_PROGRAM_DATA';
    ledger.push({
      schoolId: school.id,
      schoolName: school.name,
      schoolNameNorm: school.nameNorm,
      website: school.website,
      usNewsRank: school.usNewsRank,
      missingFields: ['programRates'],
      status,
      selectedUrl: candidates[0]?.url ?? school.website ?? null,
      reason:
        status === 'MANUAL_REVIEW'
          ? 'Official-domain search found candidate pages that may contain program/college admit-rate data; requires manual validation before import.'
          : 'Official-domain Tavily search did not find public first-year program/major admit-rate counts or rates.',
      candidates,
      searchedQueries,
    });
    console.log(
      `[${index + 1}/${targets.length}] ${school.name}: ${status} candidates=${candidates.length}`,
    );
  }

  const output = {
    _meta: {
      createdAt: new Date().toISOString(),
      field: 'programRates',
      searchedSchools: targets.length,
      searchEngine: 'tavily',
      terminalStatuses: ['NO_PUBLIC_PROGRAM_DATA', 'MANUAL_REVIEW'],
    },
    schools: ledger,
  };
  const out = path.isAbsolute(args.out)
    ? args.out
    : path.join(process.cwd(), args.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(output, null, 2));
  console.log(`Wrote ${out}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
