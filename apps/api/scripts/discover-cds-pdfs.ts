#!/usr/bin/env ts-node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

type Args = {
  limit: number;
  out: string;
  missingField: string;
  cycleLabel: string;
  maxResults: number;
  delayMs: number;
  requireGoogle: boolean;
  requireTavily: boolean;
  engine: 'auto' | 'google' | 'tavily';
  missingOnly: boolean;
};

type Candidate = {
  title: string;
  url: string;
  snippet?: string;
  score: number;
};

const prisma = new PrismaClient();

function loadDotEnv() {
  for (const file of [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'apps/api/.env'),
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

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const has = (name: string) => args.includes(`--${name}`);
  const today = new Date().toISOString().slice(0, 10);
  return {
    limit: Number(get('limit') ?? 80),
    out:
      get('out') ??
      path.join(
        process.cwd(),
        'scripts/cds-data',
        `cds-pdf-registry-${today}.json`,
      ),
    missingField: get('missing-field') ?? 'intlAcceptanceRate',
    cycleLabel: get('cycle') ?? '2024-25',
    maxResults: Number(get('max-results') ?? 5),
    delayMs: Number(get('delay-ms') ?? 250),
    requireGoogle: has('require-google'),
    requireTavily: has('require-tavily'),
    engine: ((): 'auto' | 'google' | 'tavily' => {
      const value = (get('engine') ?? 'auto').toLowerCase();
      return value === 'google' || value === 'tavily' ? value : 'auto';
    })(),
    missingOnly: has('missing-only') || has('missing-fields-only'),
  };
}

function fieldIsMissing(school: Record<string, unknown>, field: string) {
  return school[field] == null;
}

function fieldIsHeuristic(school: Record<string, unknown>, field: string) {
  const metadata = school.metadata as
    | { provenance?: Record<string, { source?: string; tier?: string }> }
    | null
    | undefined;
  const provenance = metadata?.provenance?.[field];
  return (
    provenance?.tier === 'INFERRED' ||
    Boolean(provenance?.source?.toUpperCase().includes('HEURISTIC'))
  );
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

function scoreCandidate(item: {
  title?: string;
  link?: string;
  snippet?: string;
}) {
  const haystack =
    `${item.title ?? ''} ${item.link ?? ''} ${item.snippet ?? ''}`.toLowerCase();
  let score = 0;
  if ((item.link ?? '').toLowerCase().includes('.pdf')) score += 40;
  if (haystack.includes('common data set')) score += 35;
  if (haystack.includes('cds')) score += 10;
  if (haystack.includes('2024-25') || haystack.includes('2024-2025'))
    score += 20;
  if (haystack.includes('2023-24') || haystack.includes('2023-2024'))
    score += 8;
  if (
    haystack.includes('admission') ||
    haystack.includes('institutional research')
  )
    score += 5;
  return score;
}

/**
 * Strict school-match filter: the candidate URL or title MUST contain a token
 * from the school's name (or its host domain). This prevents Tavily from
 * returning Brown's CDS when querying for RISD, etc.
 *
 * Returns true if the candidate plausibly belongs to the queried school.
 */
function candidateMatchesSchool(
  candidate: { title?: string; url: string; snippet?: string },
  school: { name: string; nameNorm: string; website?: string | null },
): boolean {
  const stopwords = new Set([
    'university',
    'college',
    'institute',
    'school',
    'of',
    'the',
    'and',
    'for',
    'a',
    'an',
    'at',
    'in',
    'on',
    'state',
    'tech',
    'technology',
    'art',
    'arts',
    'music',
    'design',
  ]);
  const nameTokens = school.nameNorm
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !stopwords.has(t));
  const titleLower = (candidate.title ?? '').toLowerCase();
  const urlLower = candidate.url.toLowerCase();

  // 1. School name token MUST appear in URL (host or path), not just title.
  //    Title alone is unreliable because Tavily/Google may add the school name
  //    to titles via context, even when the document is from another school.
  const tokenMatch =
    nameTokens.length === 0 ||
    nameTokens.some((token) => urlLower.includes(token));
  if (!tokenMatch) return false;

  // 2. URL or TITLE (not snippet) must mention CDS / Common Data Set.
  //    Snippet is unreliable because Tavily fetches page content which may
  //    contain CDS mentions even on unrelated documents.
  const urlOrTitle = `${titleLower} ${urlLower}`;
  const cdsKeyword =
    urlOrTitle.includes('common data set') ||
    /\bcds\b/.test(urlOrTitle) ||
    /[\W_]cds[\W_]/.test(urlLower) ||
    /cds[-_ ]?\d{4}/.test(urlLower);
  if (!cdsKeyword) return false;

  // 3. URL host validation:
  //    - If school.website is set: URL host MUST share the same registered .edu
  //      domain as school.website (this rejects "Texas" → tamu.edu false matches)
  //    - If school.website is NULL: fall back to any .edu host (less strict)
  try {
    const urlHost = new URL(candidate.url).hostname.toLowerCase();

    // Allow well-known authoritative aggregators regardless of website
    if (
      urlHost.endsWith('commondataset.org') ||
      urlHost.endsWith('collegetransitions.com')
    ) {
      return true;
    }

    if (school.website) {
      try {
        const schoolHost = new URL(school.website).hostname
          .toLowerCase()
          .replace(/^www\./, '');
        // Extract registered domain (last 2 labels, e.g. "brown.edu")
        const schoolRoot = schoolHost.split('.').slice(-2).join('.');
        // Strict: URL host must end with school's registered domain
        return urlHost === schoolRoot || urlHost.endsWith('.' + schoolRoot);
      } catch {
        // Malformed school.website — fall through to .edu check
      }
    }

    // Fallback: school.website not set or malformed — accept any .edu host
    // (this is the looser path used only when we don't know the school's domain)
    return urlHost.endsWith('.edu');
  } catch {
    return false;
  }
}

async function googleSearch(
  query: string,
  maxResults: number,
): Promise<Candidate[]> {
  const key =
    process.env.GOOGLE_SEARCH_API_KEY ?? process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID ?? process.env.GOOGLE_CSE_CX;
  if (!key || !cx) return [];

  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    num: String(Math.min(maxResults, 10)),
  });
  const response = await fetch(
    `https://www.googleapis.com/customsearch/v1?${params}`,
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Google CSE failed ${response.status}: ${text.slice(0, 300)}`,
    );
  }
  const body = JSON.parse(text) as {
    items?: Array<{ title?: string; link?: string; snippet?: string }>;
  };
  const seen = new Set<string>();
  return (body.items ?? [])
    .filter((item) => item.link)
    .map((item) => ({
      title: item.title ?? '',
      url: normalizeUrl(item.link as string),
      snippet: item.snippet,
      score: scoreCandidate(item),
    }))
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .sort((a, b) => b.score - a.score);
}

async function tavilySearch(
  query: string,
  maxResults: number,
): Promise<Candidate[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: Math.min(maxResults, 10),
      search_depth: 'advanced',
      include_raw_content: false,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Tavily failed ${response.status}: ${text.slice(0, 300)}`);
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
      // Combine Tavily's relevance score with our heuristic CDS-keyword score
      score:
        scoreCandidate({
          title: item.title,
          link: item.url,
          snippet: item.content,
        }) +
        (typeof item.score === 'number'
          ? Math.round(item.score * 50)
          : Math.max(0, 30 - idx * 3)),
    }))
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .sort((a, b) => b.score - a.score);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  loadDotEnv();
  const args = parseArgs();
  const hasGoogle = Boolean(
    (process.env.GOOGLE_SEARCH_API_KEY ?? process.env.GOOGLE_CSE_API_KEY) &&
    (process.env.GOOGLE_SEARCH_ENGINE_ID ?? process.env.GOOGLE_CSE_CX),
  );
  const hasTavily = Boolean(process.env.TAVILY_API_KEY);
  if (args.requireGoogle && !hasGoogle) {
    throw new Error(
      'Google CSE env missing. Set GOOGLE_SEARCH_API_KEY/GOOGLE_SEARCH_ENGINE_ID or GOOGLE_CSE_API_KEY/GOOGLE_CSE_CX.',
    );
  }
  if (args.requireTavily && !hasTavily) {
    throw new Error('Tavily env missing. Set TAVILY_API_KEY.');
  }
  if (args.engine === 'google' && !hasGoogle) {
    throw new Error('--engine google requested but Google CSE env not set.');
  }
  if (args.engine === 'tavily' && !hasTavily) {
    throw new Error('--engine tavily requested but TAVILY_API_KEY not set.');
  }
  // Pick engine: explicit --engine wins; otherwise prefer Tavily (works in current env), fall back to Google.
  const useTavily =
    args.engine === 'tavily' || (args.engine === 'auto' && hasTavily);
  const useGoogle =
    args.engine === 'google' ||
    (args.engine === 'auto' && !useTavily && hasGoogle);
  const engineLabel: 'tavily' | 'google-custom-search' | 'query-only' =
    useTavily ? 'tavily' : useGoogle ? 'google-custom-search' : 'query-only';

  const schools = await prisma.school.findMany({
    where: {
      country: { in: ['US', 'United States', 'United States of America'] },
    },
    select: {
      id: true,
      name: true,
      nameNorm: true,
      usNewsRank: true,
      acceptanceRate: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      sat25: true,
      sat75: true,
      website: true,
      metadata: true,
    },
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
  });

  const targets = schools
    .filter((school) => {
      const record = school as Record<string, unknown>;
      if (fieldIsMissing(record, args.missingField)) return true;
      return !args.missingOnly && fieldIsHeuristic(record, args.missingField);
    })
    .slice(0, args.limit);

  const results = [];
  const failures = [];
  for (const school of targets) {
    const query = `site:edu "Common Data Set" "${args.cycleLabel}" "${school.name}" filetype:pdf`;
    let rawCandidates: Candidate[] = [];
    try {
      if (useTavily) {
        rawCandidates = await tavilySearch(query, args.maxResults);
      } else if (useGoogle) {
        rawCandidates = await googleSearch(query, args.maxResults);
      }
    } catch (error) {
      failures.push({
        schoolId: school.id,
        schoolName: school.name,
        query,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    // Strict school-match filter: drop candidates that don't plausibly belong
    // to this school (e.g., Tavily returning Brown's CDS for RISD).
    const filteredCandidates = rawCandidates.filter((candidate) =>
      candidateMatchesSchool(candidate, {
        name: school.name,
        nameNorm: school.nameNorm,
        website: school.website,
      }),
    );
    const rejected = rawCandidates
      .filter((c) => !filteredCandidates.includes(c))
      .map((c) => ({ url: c.url, title: c.title, score: c.score }));
    results.push({
      schoolId: school.id,
      schoolName: school.name,
      schoolNameNorm: school.nameNorm,
      usNewsRank: school.usNewsRank,
      missingField: args.missingField,
      query,
      selectedUrl: filteredCandidates[0]?.url ?? null,
      candidates: filteredCandidates,
      rejectedCandidates: rejected.length > 0 ? rejected : undefined,
    });
    if ((useTavily || useGoogle) && args.delayMs > 0) await sleep(args.delayMs);
  }

  const registry = {
    _meta: {
      generatedAt: new Date().toISOString(),
      source: engineLabel,
      missingField: args.missingField,
      cycleLabel: args.cycleLabel,
      scannedSchools: targets.length,
      selectedUrls: results.filter((row) => row.selectedUrl).length,
    },
    schools: results,
    failures,
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        out: args.out,
        source: registry._meta.source,
        scannedSchools: registry._meta.scannedSchools,
        selectedUrls: registry._meta.selectedUrls,
        failures: failures.length,
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
