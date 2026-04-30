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
  maxStages: number;
  /** Cap Tavily key pool size (plan: 15-key stop). */
  tavilyKeyLimit: number | null;
  /** Comma-separated school IDs — only these schools are scanned (chunk mode). */
  schoolIds: string[] | null;
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
    maxStages: Number(get('max-stages') ?? 1),
    tavilyKeyLimit: (() => {
      const v = get('tavily-key-limit');
      if (v == null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    })(),
    schoolIds: (() => {
      const v = get('school-ids');
      if (!v?.trim()) return null;
      return v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    })(),
  };
}

/** nameNorm values to skip (no C1 residency published — do not burn search quota). */
function loadKnownNoCdsNameNorms(): Set<string> {
  const set = new Set<string>();
  for (const base of [
    path.join(process.cwd(), 'scripts', 'cds-data', 'known-no-cds.json'),
    path.join(
      process.cwd(),
      'apps',
      'api',
      'scripts',
      'cds-data',
      'known-no-cds.json',
    ),
  ]) {
    try {
      if (!fs.existsSync(base)) continue;
      const raw = JSON.parse(fs.readFileSync(base, 'utf8')) as {
        schools?: { schoolNameNorm: string }[];
      };
      for (const row of raw.schools ?? []) {
        if (row.schoolNameNorm) set.add(row.schoolNameNorm.toLowerCase());
      }
      break;
    } catch {
      /* ignore */
    }
  }
  return set;
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

function fieldIsPermanentHeuristic(
  school: Record<string, unknown>,
  field: string,
) {
  const metadata = school.metadata as
    | {
        provenance?: Record<
          string,
          { source?: string; tier?: string; permanent?: boolean }
        >;
      }
    | null
    | undefined;
  const provenance = metadata?.provenance?.[field];
  return (
    provenance?.permanent === true ||
    provenance?.source === 'PERMANENT_HEURISTIC'
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

type TavilyKeyEntry = { apiKey: string };
type GoogleKeyEntry = { apiKey: string; cx: string };
interface KeyPool<T> {
  entries: T[];
  index: number;
  exhausted: Set<number>;
}

function loadTavilyPool(): KeyPool<TavilyKeyEntry> {
  const entries: TavilyKeyEntry[] = [];
  const single = process.env.TAVILY_API_KEY;
  if (single) entries.push({ apiKey: single });
  for (let n = 1; ; n++) {
    const v = process.env[`TAVILY_API_KEY_${n}`];
    if (!v) break;
    if (!entries.some((e) => e.apiKey === v)) entries.push({ apiKey: v });
  }
  return { entries, index: 0, exhausted: new Set() };
}

function loadGooglePool(): KeyPool<GoogleKeyEntry> {
  const entries: GoogleKeyEntry[] = [];
  const k0 =
    process.env.GOOGLE_SEARCH_API_KEY ?? process.env.GOOGLE_CSE_API_KEY;
  const cx0 = process.env.GOOGLE_SEARCH_ENGINE_ID ?? process.env.GOOGLE_CSE_CX;
  if (k0 && cx0) entries.push({ apiKey: k0, cx: cx0 });
  for (let n = 1; ; n++) {
    const k = process.env[`GOOGLE_CSE_API_KEY_${n}`];
    const cx = process.env[`GOOGLE_CSE_CX_${n}`];
    if (!k || !cx) break;
    if (!entries.some((e) => e.apiKey === k)) entries.push({ apiKey: k, cx });
  }
  return { entries, index: 0, exhausted: new Set() };
}

function createPoolRunner<T>(pool: KeyPool<T>, label: string) {
  return async (
    call: (entry: T) => Promise<Candidate[]>,
  ): Promise<{ results: Candidate[]; exhausted: boolean }> => {
    const total = pool.entries.length;
    if (pool.exhausted.size >= total) return { results: [], exhausted: true };

    let skipped = 0;
    while (pool.exhausted.has(pool.index) && skipped < total) {
      pool.index = (pool.index + 1) % total;
      skipped++;
    }

    const idx = pool.index;
    console.error(`[search] using ${label}[${idx + 1}/${total}]`);
    try {
      const results = await call(pool.entries[idx]);
      pool.index = (pool.index + 1) % total;
      return { results, exhausted: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        /failed (429|432|quota)/i.test(msg) ||
        /usage limit|exceeds.*plan|rate.?limit/i.test(msg)
      ) {
        console.error(
          `[search] ${label}[${idx + 1}/${total}] quota hit — marking exhausted`,
        );
        pool.exhausted.add(idx);
        pool.index = (pool.index + 1) % total;
        return { results: [], exhausted: pool.exhausted.size >= total };
      }
      throw err;
    }
  };
}

async function googleSearch(
  query: string,
  maxResults: number,
  entry: GoogleKeyEntry,
): Promise<Candidate[]> {
  const key = entry.apiKey;
  const cx = entry.cx;

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
  apiKey: string,
): Promise<Candidate[]> {
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
  const tavilyPool = loadTavilyPool();
  if (
    args.tavilyKeyLimit != null &&
    tavilyPool.entries.length > args.tavilyKeyLimit
  ) {
    tavilyPool.entries = tavilyPool.entries.slice(0, args.tavilyKeyLimit);
    console.error(
      `[pool] tavily keys capped to ${args.tavilyKeyLimit} via --tavily-key-limit`,
    );
  }
  const googlePool = loadGooglePool();
  const hasTavily = tavilyPool.entries.length > 0;
  const hasGoogle = googlePool.entries.length > 0;

  if (args.requireGoogle && !hasGoogle) {
    throw new Error(
      'Google CSE env missing. Set GOOGLE_CSE_API_KEY_1+GOOGLE_CSE_CX_1 (or legacy GOOGLE_CSE_API_KEY+GOOGLE_CSE_CX).',
    );
  }
  if (args.requireTavily && !hasTavily) {
    throw new Error(
      'Tavily env missing. Set TAVILY_API_KEY or TAVILY_API_KEY_1.',
    );
  }
  if (args.engine === 'google' && !hasGoogle) {
    throw new Error(
      '--engine google requested but no Google CSE env vars found.',
    );
  }
  if (args.engine === 'tavily' && !hasTavily) {
    throw new Error('--engine tavily requested but no TAVILY_API_KEY found.');
  }

  const engineLabel: 'tavily' | 'google-custom-search' | 'query-only' =
    args.engine === 'tavily'
      ? 'tavily'
      : args.engine === 'google'
        ? 'google-custom-search'
        : hasTavily
          ? 'tavily'
          : hasGoogle
            ? 'google-custom-search'
            : 'query-only';

  console.error(
    `[pool] tavily: ${tavilyPool.entries.length} key(s), google: ${googlePool.entries.length} key(s)`,
  );

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

  const knownNoCds = loadKnownNoCdsNameNorms();

  let targets = schools.filter((school) => {
    const record = school as Record<string, unknown>;
    if (knownNoCds.has(String(school.nameNorm).toLowerCase())) return false;
    // Skip schools we know don't publish CDS (saves quota + avoids hammering)
    if (fieldIsPermanentHeuristic(record, args.missingField)) return false;
    if (fieldIsMissing(record, args.missingField)) return true;
    // missing-only: still target heuristic-filled fields (need real CDS), not only NULLs
    if (args.missingOnly) return fieldIsHeuristic(record, args.missingField);
    return fieldIsHeuristic(record, args.missingField);
  });

  if (args.schoolIds?.length) {
    const byId = new Map(targets.map((s) => [s.id, s]));
    const ordered: typeof targets = [];
    for (const id of args.schoolIds) {
      const row = byId.get(id);
      if (row) ordered.push(row);
    }
    targets = ordered;
  }

  targets = targets.slice(0, args.limit);

  const runTavily = hasTavily ? createPoolRunner(tavilyPool, 'tavily') : null;
  const runGoogle = hasGoogle ? createPoolRunner(googlePool, 'google') : null;

  const results = [];
  const failures = [];

  // Build query stages per school. Smarter strategy:
  //  S1: site:{root} "common data set" cycle filetype:pdf  (most precise)
  //  S2: "{name}" inurl:cds OR inurl:institutional-research filetype:pdf
  //  S3: site:{root} "common data set" filetype:pdf  (no year, accept older)
  //  S4: "{name}" "common data set 2024-25" filetype:pdf  (no site restriction)
  function rootDomain(website: string | null): string | null {
    if (!website) return null;
    try {
      const host = new URL(website).hostname
        .toLowerCase()
        .replace(/^www\./, '');
      return host.split('.').slice(-2).join('.');
    } catch {
      return null;
    }
  }
  function buildStages(school: {
    name: string;
    website: string | null;
  }): string[] {
    const root = rootDomain(school.website);
    const stages: string[] = [];
    if (root) {
      stages.push(
        `site:${root} "common data set" "${args.cycleLabel}" filetype:pdf`,
      );
    }
    stages.push(
      `"${school.name}" "common data set" "${args.cycleLabel}" inurl:cds OR inurl:institutional-research filetype:pdf`,
    );
    if (root) {
      stages.push(`site:${root} "common data set" filetype:pdf`);
    }
    stages.push(
      `"${school.name}" "common data set ${args.cycleLabel}" filetype:pdf`,
    );
    return stages;
  }

  for (const school of targets) {
    if (
      args.engine === 'tavily' &&
      tavilyPool.exhausted.size >= tavilyPool.entries.length &&
      tavilyPool.entries.length > 0
    ) {
      console.error(
        '[search] all Tavily keys exhausted — stopping discover loop early',
      );
      break;
    }

    const stages =
      args.maxStages > 1
        ? buildStages(school)
        : [
            `site:edu "Common Data Set" "${args.cycleLabel}" "${school.name}" filetype:pdf`,
          ];
    let rawCandidates: Candidate[] = [];
    let queryUsed = stages[0];
    let stageHit = -1;
    let didSearch = false;

    try {
      const wantTavily =
        runTavily &&
        args.engine !== 'google' &&
        tavilyPool.exhausted.size < tavilyPool.entries.length;
      const wantGoogle =
        runGoogle &&
        args.engine !== 'tavily' &&
        googlePool.exhausted.size < googlePool.entries.length;

      const stageMax = Math.min(args.maxStages, stages.length);
      for (let s = 0; s < stageMax; s++) {
        const stageQuery = stages[s];

        if (wantTavily) {
          const out = await runTavily((e) =>
            tavilySearch(stageQuery, args.maxResults, e.apiKey),
          );
          if (out.exhausted && args.engine === 'tavily') {
            failures.push({
              schoolId: school.id,
              schoolName: school.name,
              query: stageQuery,
              error: 'All Tavily keys exhausted',
            });
            break;
          }
          // Pre-filter against school here so empty filtered → try next stage
          const filtered = out.results.filter((c) =>
            candidateMatchesSchool(c, {
              name: school.name,
              nameNorm: school.nameNorm,
              website: school.website,
            }),
          );
          if (filtered.length > 0) {
            rawCandidates = out.results;
            queryUsed = stageQuery;
            stageHit = s + 1;
            didSearch = true;
            break;
          }
          didSearch = true;
        } else if (wantGoogle) {
          const out = await runGoogle((e) =>
            googleSearch(stageQuery, args.maxResults, e),
          );
          const filtered = out.results.filter((c) =>
            candidateMatchesSchool(c, {
              name: school.name,
              nameNorm: school.nameNorm,
              website: school.website,
            }),
          );
          if (filtered.length > 0) {
            rawCandidates = out.results;
            queryUsed = stageQuery;
            stageHit = s + 1;
            didSearch = true;
            break;
          }
          didSearch = true;
        }
      }
    } catch (error) {
      failures.push({
        schoolId: school.id,
        schoolName: school.name,
        query: queryUsed,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
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
      query: queryUsed,
      stageHit,
      selectedUrl: filteredCandidates[0]?.url ?? null,
      candidates: filteredCandidates,
      rejectedCandidates: rejected.length > 0 ? rejected : undefined,
    });
    if (didSearch && args.delayMs > 0) await sleep(args.delayMs);
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
