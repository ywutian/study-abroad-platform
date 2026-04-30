#!/usr/bin/env ts-node
/**
 * Probe IR (Institutional Research) domain patterns for CDS PDFs.
 *
 * Most US universities host CDS at predictable URL patterns under
 * ir/oir/ira/opa/institutional-research subdomains of their .edu root.
 *
 * For each target school missing intl data, we:
 *  1. Extract root domain from school.website (e.g., umich.edu)
 *  2. Generate ~12 candidate URLs from common patterns
 *  3. HEAD-request each candidate; first 200 application/pdf wins
 *  4. Write registry JSON compatible with extract-cds-c1.ts
 *
 * ZERO Tavily/Google quota cost. Costs only HEAD requests against .edu sites.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

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

loadDotEnv();
const prisma = new PrismaClient();

type Args = {
  limit: number;
  out: string;
  perRequestDelayMs: number;
  perHostDelayMs: number;
  timeoutMs: number;
  /** Max HEAD attempts per school (candidate list can be 500+). */
  maxCandidates: number;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const today = new Date().toISOString().slice(0, 10);
  return {
    limit: Number(get('limit') ?? 80),
    out:
      get('out') ??
      path.join(
        process.cwd(),
        'scripts/cds-data',
        `cds-pdf-registry-probed-${today}.json`,
      ),
    perRequestDelayMs: Number(get('per-request-delay-ms') ?? 100),
    perHostDelayMs: Number(get('per-host-delay-ms') ?? 250),
    timeoutMs: Number(get('timeout-ms') ?? 6000),
    maxCandidates: Number(get('max-candidates') ?? 80),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function rootDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    const host = new URL(website).hostname.toLowerCase().replace(/^www\./, '');
    return host.split('.').slice(-2).join('.');
  } catch {
    return null;
  }
}

/**
 * Generate ~50 candidate URL patterns per root domain. Order matters — most
 * common patterns first to short-circuit on early hits.
 *
 * Empirically observed working URLs we want to catch:
 *  - https://obp.umich.edu/wp-content/uploads/pubdata/cds/CDS_2024-25_UMAA.pdf
 *  - https://www.williams.edu/institutional-research/files/2025/05/CDS_2024_2025_Williams_V4.pdf
 *  - https://oir.brown.edu/sites/default/files/2025-08/CDS_2024-2025.pdf
 *  - https://ira.upenn.edu/penndata/common-data-set
 */
function generateCandidates(root: string, _name: string): string[] {
  const subdomains = [
    'ir',
    'oir',
    'ira',
    'oira',
    'opa',
    'opir',
    'irap',
    'ire',
    'oirpe',
    'irds',
    'oirap',
    'ipr',
    'institutional-research',
    'institutionalresearch',
  ];
  const fileNames = [
    'CDS_2024-2025.pdf',
    'CDS_2024-25.pdf',
    'cds_2024-2025.pdf',
    'cds_2024-25.pdf',
    'cds-2024-2025.pdf',
    'cds-2024-25.pdf',
    'CDS-2024-25.pdf',
    'CDS-2024-2025.pdf',
    `CDS_2024-2025_${root.split('.')[0].toUpperCase()}.pdf`, // e.g. CDS_2024-2025_BROWN.pdf
    'common-data-set-2024-2025.pdf',
    'common-data-set-2024-25.pdf',
    'CDS2024-2025.pdf',
    'CDS2024-25.pdf',
  ];
  const monthlyDirs = [
    '',
    '2025/04/',
    '2025/05/',
    '2025/06/',
    '2025/03/',
    '2025/02/',
    '2024/12/',
    '2024/11/',
    '2024/10/',
    '2025-04/',
    '2025-05/',
  ];

  const out = new Set<string>();

  // Pattern A: subdomain direct: https://{sub}.{root}/{file}
  for (const sub of subdomains.slice(0, 8)) {
    for (const file of fileNames.slice(0, 6)) {
      out.add(`https://${sub}.${root}/${file}`);
    }
  }

  // Pattern B: subdomain + Drupal-style sites path:
  //   https://{sub}.{root}/sites/default/files/{monthDir}{file}
  for (const sub of subdomains.slice(0, 6)) {
    for (const month of monthlyDirs.slice(0, 8)) {
      for (const file of fileNames.slice(0, 4)) {
        out.add(`https://${sub}.${root}/sites/default/files/${month}${file}`);
      }
    }
  }

  // Pattern C: subdomain + WordPress-style uploads:
  //   https://{sub}.{root}/wp-content/uploads/{monthDir}{file}
  for (const sub of subdomains.slice(0, 6)) {
    for (const month of monthlyDirs.slice(0, 6)) {
      for (const file of fileNames.slice(0, 4)) {
        out.add(`https://${sub}.${root}/wp-content/uploads/${month}${file}`);
      }
    }
  }

  // Pattern D: bare root + ir paths
  for (const file of fileNames.slice(0, 4)) {
    out.add(`https://${root}/cds/${file}`);
    out.add(`https://www.${root}/cds/${file}`);
    out.add(`https://www.${root}/institutional-research/files/2025/05/${file}`);
    out.add(`https://www.${root}/institutional-research/files/2025/04/${file}`);
    out.add(`https://www.${root}/institutional-research/${file}`);
    out.add(`https://www.${root}/about/institutional-research/${file}`);
  }

  return Array.from(out);
}

/**
 * Hard-coded skip list: schools we have empirically confirmed don't publish
 * CDS C1 with residency breakdown (from Tavily attempts that returned 0 hits
 * for valid CDS URLs). Saves probe time + avoids hammering their servers.
 */
const KNOWN_NO_CDS_PUBLISHED = new Set([
  // Art / music / niche schools
  'rhode island school of design',
  'the juilliard school',
  'berklee college of music',
  'cooper union',
  'pratt institute',
  'curtis institute of music',
  'school of the art institute of chicago',
  'manhattan school of music',
  'california institute of the arts',
  'new england conservatory',
  'maryland institute college of art',
  'california college of the arts',
  'artcenter college of design',
  'savannah college of art and design',
  'the new school',
  // LACs known to not publish C1 residency
  'olin college of engineering',
  'pomona college',
  'wellesley college',
  'amherst college',
  'swarthmore college',
  'carleton college',
  'claremont mckenna college',
  'vassar college',
  'davidson college',
  'washington and lee university',
  'colby college',
  'bates college',
]);

interface ProbeResult {
  url: string;
  status: number;
  contentType: string;
  ok: boolean;
}

async function probeUrl(url: string, timeoutMs: number): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (study-abroad-platform CDS-discovery; +https://github.com/ywutian/study-abroad-platform)',
      },
    });
    const contentType = res.headers.get('content-type') ?? '';
    return {
      url,
      status: res.status,
      contentType,
      ok: res.ok && contentType.toLowerCase().includes('pdf'),
    };
  } catch {
    return { url, status: 0, contentType: 'TIMEOUT', ok: false };
  } finally {
    clearTimeout(timer);
  }
}

function mergeKnownNoCdsFileIntoSkipSet(): void {
  const paths = [
    path.join(process.cwd(), 'scripts', 'cds-data', 'known-no-cds.json'),
    path.join(
      process.cwd(),
      'apps',
      'api',
      'scripts',
      'cds-data',
      'known-no-cds.json',
    ),
  ];
  for (const p of paths) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as {
        schools?: { schoolNameNorm: string }[];
      };
      for (const row of raw.schools ?? []) {
        if (row.schoolNameNorm)
          KNOWN_NO_CDS_PUBLISHED.add(row.schoolNameNorm.toLowerCase());
      }
      return;
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const args = parseArgs();
  mergeKnownNoCdsFileIntoSkipSet();

  const schools = await prisma.school.findMany({
    where: {
      country: { in: ['US', 'United States', 'United States of America'] },
    },
    select: {
      id: true,
      name: true,
      nameNorm: true,
      usNewsRank: true,
      website: true,
      metadata: true,
    },
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
  });

  // Filter to schools missing real intl data + has website + not in known-no-CDS skip list
  const targets = schools
    .filter((s) => {
      if (KNOWN_NO_CDS_PUBLISHED.has(s.nameNorm.toLowerCase())) return false;
      const meta = s.metadata as
        | { provenance?: Record<string, { source?: string; tier?: string }> }
        | null
        | undefined;
      const intlProv = meta?.provenance?.intlAcceptanceRate;
      const isHeuristic =
        intlProv?.tier === 'INFERRED' ||
        Boolean(intlProv?.source?.toUpperCase().includes('HEURISTIC'));
      return isHeuristic && s.website;
    })
    .slice(0, args.limit);

  console.log(`Probing ${targets.length} targets (limit ${args.limit}) ...`);
  const results: Array<{
    schoolId: string;
    schoolName: string;
    schoolNameNorm: string;
    usNewsRank: number | null;
    rootDomain: string;
    selectedUrl: string | null;
    probedCount: number;
    candidates: ProbeResult[];
  }> = [];
  let hits = 0;
  const lastHostHit = new Map<string, number>();

  for (const school of targets) {
    const root = rootDomain(school.website);
    if (!root) {
      results.push({
        schoolId: school.id,
        schoolName: school.name,
        schoolNameNorm: school.nameNorm,
        usNewsRank: school.usNewsRank,
        rootDomain: '',
        selectedUrl: null,
        probedCount: 0,
        candidates: [],
      });
      continue;
    }

    const candidates = generateCandidates(root, school.name);
    const probed: ProbeResult[] = [];
    let selected: string | null = null;

    for (const url of candidates.slice(0, args.maxCandidates)) {
      // Per-host throttle: if same host was hit within perHostDelayMs, sleep
      const host = new URL(url).hostname;
      const last = lastHostHit.get(host) ?? 0;
      const wait = Math.max(0, args.perHostDelayMs - (Date.now() - last));
      if (wait > 0) await sleep(wait);

      const probe = await probeUrl(url, args.timeoutMs);
      probed.push(probe);
      lastHostHit.set(host, Date.now());

      if (probe.ok) {
        selected = probe.url;
        break; // short-circuit on first hit
      }
      await sleep(args.perRequestDelayMs);
    }

    if (selected) hits += 1;
    results.push({
      schoolId: school.id,
      schoolName: school.name,
      schoolNameNorm: school.nameNorm,
      usNewsRank: school.usNewsRank,
      rootDomain: root,
      selectedUrl: selected,
      probedCount: probed.length,
      candidates: probed.filter((p) => p.status > 0).slice(0, 5),
    });

    if (results.length % 5 === 0) {
      process.stdout.write(
        `  ${results.length}/${targets.length} probed (${hits} hits)\r`,
      );
    }
  }

  // Output registry compatible with extract-cds-c1.ts
  const registry = {
    _meta: {
      generatedAt: new Date().toISOString(),
      source: 'ir-domain-probe',
      missingField: 'intlAcceptanceRate',
      cycleLabel: '2024-25',
      scannedSchools: results.length,
      selectedUrls: hits,
    },
    schools: results
      .filter((r) => r.selectedUrl)
      .map((r) => ({
        schoolId: r.schoolId,
        schoolName: r.schoolName,
        schoolNameNorm: r.schoolNameNorm,
        usNewsRank: r.usNewsRank,
        missingField: 'intlAcceptanceRate',
        selectedUrl: r.selectedUrl,
        candidates: [{ url: r.selectedUrl as string, score: 100 }],
        rootDomain: r.rootDomain,
      })),
    failures: results
      .filter((r) => !r.selectedUrl)
      .map((r) => ({
        schoolId: r.schoolId,
        schoolName: r.schoolName,
        rootDomain: r.rootDomain,
        probedCount: r.probedCount,
      })),
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(`\nDone. Hits: ${hits}/${results.length}. Output: ${args.out}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
