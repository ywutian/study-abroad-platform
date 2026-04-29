#!/usr/bin/env tsx
/**
 * HEAD-probe ~30 known CDS URL patterns per school to find PDFs without
 * burning Tavily search quota. Patterns from GPT-5.4 + common university
 * Institutional Research office conventions.
 *
 * Reads schools from DB (top-100 by usNewsRank by default), uses school.website
 * to construct candidate URLs, HEAD-requests each, and writes hits to a
 * registry compatible with extract-cds-c1.ts / extract-cds-c9-c21.ts.
 *
 * Usage:
 *   npx tsx scripts/probe-cds-urls.ts \
 *     --out scripts/cds-data/cds-pdf-probed-2026-04-28.json \
 *     [--top-100-only] [--exclude-existing scripts/cds-data/cds-pdf-registry-recovered-2026-04-28.json]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

interface ProbedRow {
  schoolId: string;
  schoolName: string;
  schoolNameNorm: string;
  selectedUrl: string;
  sourceUrl: string;
  cycleYear: number;
  patternHit: string;
}

function args() {
  const a = process.argv.slice(2);
  const get = (n: string) => {
    const i = a.indexOf(`--${n}`);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const has = (n: string) => a.includes(`--${n}`);
  return {
    out: get('out') ?? 'scripts/cds-data/cds-pdf-probed.json',
    excludeFile: get('exclude-existing'),
    top100Only: has('top-100-only'),
    limit: Number(get('limit') ?? 200),
    concurrency: Number(get('concurrency') ?? 8),
  };
}

// ~30 candidate paths per school, ordered by likelihood of hitting
const PATH_TEMPLATES = [
  // ── Institutional Research conventions ──────────
  '/institutional-research/common-data-set-{cycleSpan}.pdf',
  '/institutionalresearch/common-data-set-{cycleSpan}.pdf',
  '/institutional-research/cds-{cycleSpan}.pdf',
  '/institutional-research/CDS_{cycleSpan}.pdf',
  '/institutional-research/CDS-{cycleSpan}.pdf',
  '/oir/common-data-set-{cycleSpan}.pdf',
  '/oir/cds-{cycleSpan}.pdf',
  '/oir/CDS_{cycleSpan}.pdf',
  '/ir/common-data-set-{cycleSpan}.pdf',
  '/ir/cds-{cycleSpan}.pdf',
  '/ir/CDS_{cycleSpan}.pdf',
  '/ira/cds-{cycleSpan}.pdf',
  '/ira/CDS_{cycleSpan}.pdf',
  '/institutional-effectiveness/common-data-set-{cycleSpan}.pdf',
  '/institutional-effectiveness/cds-{cycleSpan}.pdf',
  // ── Generic file repositories ──────────
  '/sites/default/files/{cycle}/common-data-set-{cycleSpan}.pdf',
  '/sites/default/files/{cycle}/cds-{cycleSpan}.pdf',
  '/sites/default/files/CDS_{cycleSpan}.pdf',
  '/files/{cycle}/common-data-set-{cycleSpan}.pdf',
  '/files/cds-{cycleSpan}.pdf',
  '/documents/common-data-set-{cycleSpan}.pdf',
  '/documents/cds-{cycleSpan}.pdf',
  // ── Factbook style ──────────
  '/factbook/common-data-set-{cycleSpan}.pdf',
  '/factbook/cds-{cycleSpan}.pdf',
  // ── Provost / planning offices ──────────
  '/provost/cds-{cycleSpan}.pdf',
  '/provost/common-data-set-{cycleSpan}.pdf',
  '/planning/cds-{cycleSpan}.pdf',
];

const SUBDOMAINS = ['', 'www.', 'ir.', 'oir.', 'ira.', 'analytics.', 'irds.'];

function buildCandidates(
  domain: string,
  cycleSpan: string,
  cycle: string,
): string[] {
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/^www\./, '');
  const urls = new Set<string>();
  for (const sub of SUBDOMAINS) {
    for (const tmpl of PATH_TEMPLATES) {
      const path = tmpl
        .replaceAll('{cycleSpan}', cycleSpan)
        .replaceAll('{cycle}', cycle);
      urls.add(`https://${sub}${cleanDomain}${path}`);
    }
  }
  return Array.from(urls);
}

const HEAD_TIMEOUT_MS = 6000;

async function probeUrl(
  url: string,
): Promise<{ ok: boolean; contentType?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
    const r = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; LumniDataBot/1.0; +https://lumni.app)',
      },
    });
    clearTimeout(timer);
    if (r.status !== 200) return { ok: false };
    const ct = r.headers.get('content-type') ?? '';
    if (!ct.toLowerCase().includes('pdf'))
      return { ok: false, contentType: ct };
    return { ok: true, contentType: ct };
  } catch {
    return { ok: false };
  }
}

async function probeSchool(
  school: {
    id: string;
    name: string;
    nameNorm: string;
    website: string | null;
  },
  cycles: Array<{ cycleSpan: string; cycle: string; cycleYear: number }>,
  concurrency: number,
): Promise<ProbedRow | null> {
  if (!school.website) return null;
  for (const cy of cycles) {
    const candidates = buildCandidates(school.website, cy.cycleSpan, cy.cycle);
    // Process in chunks of `concurrency` to keep request rate sane
    for (let i = 0; i < candidates.length; i += concurrency) {
      const chunk = candidates.slice(i, i + concurrency);
      const results = await Promise.all(
        chunk.map((u) => probeUrl(u).then((r) => ({ url: u, r }))),
      );
      const hit = results.find((x) => x.r.ok);
      if (hit) {
        return {
          schoolId: school.id,
          schoolName: school.name,
          schoolNameNorm: school.nameNorm,
          selectedUrl: hit.url,
          sourceUrl: hit.url,
          cycleYear: cy.cycleYear,
          patternHit: hit.url.replace(/^https?:\/\/[^/]+/, ''),
        };
      }
    }
  }
  return null;
}

async function main() {
  const a = args();
  const prisma = new PrismaClient();
  try {
    const where: any = {
      country: { in: ['US', 'United States', 'United States of America'] },
    };
    if (a.top100Only) where.usNewsRank = { gte: 1, lte: 100 };
    const schools = await prisma.school.findMany({
      where,
      select: {
        id: true,
        name: true,
        nameNorm: true,
        website: true,
        usNewsRank: true,
      },
      orderBy: { usNewsRank: 'asc' },
      take: a.limit,
    });

    // Exclude schools that already have a confirmed PDF URL
    const existing = new Set<string>();
    if (a.excludeFile && fs.existsSync(a.excludeFile)) {
      const ex = JSON.parse(fs.readFileSync(a.excludeFile, 'utf8'));
      for (const s of ex.schools ?? []) existing.add(s.schoolNameNorm);
    }
    const targets = schools.filter(
      (s) => !existing.has(s.nameNorm) && s.website,
    );
    console.log(
      `Probing ${targets.length} schools (excluded ${schools.length - targets.length})`,
    );

    const cycles = [
      { cycleSpan: '2024-2025', cycle: '2024', cycleYear: 2024 },
      { cycleSpan: '2024-25', cycle: '2024', cycleYear: 2024 },
      { cycleSpan: '2025-2026', cycle: '2025', cycleYear: 2025 },
      { cycleSpan: '2025-26', cycle: '2025', cycleYear: 2025 },
      { cycleSpan: '2023-2024', cycle: '2023', cycleYear: 2023 },
      { cycleSpan: '2023-24', cycle: '2023', cycleYear: 2023 },
    ];

    const results: ProbedRow[] = [];
    for (const s of targets) {
      const hit = await probeSchool(s, cycles, a.concurrency);
      if (hit) {
        results.push(hit);
        console.log(
          `HIT  ${s.name}: ${hit.patternHit} (cycle ${hit.cycleYear})`,
        );
      } else {
        console.log(`miss ${s.name}`);
      }
    }

    const out = {
      _meta: {
        generatedAt: new Date().toISOString(),
        source: 'HEAD-probe of ~30 institutional-research URL patterns',
        scanned: targets.length,
        hits: results.length,
      },
      schools: results,
    };
    fs.mkdirSync(path.dirname(a.out), { recursive: true });
    fs.writeFileSync(a.out, `${JSON.stringify(out, null, 2)}\n`);
    console.log(
      JSON.stringify(
        { out: a.out, scanned: targets.length, hits: results.length },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
