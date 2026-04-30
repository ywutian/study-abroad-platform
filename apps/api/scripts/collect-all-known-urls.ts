#!/usr/bin/env ts-node
/**
 * Collect all known CDS PDF URLs from registry files into one merged registry,
 * deduplicated by schoolNameNorm. Output is ready for re-extract pass.
 *
 * Filters:
 *  - Skip PERMANENT_HEURISTIC schools
 *  - Skip schools where we already have gpaDistribution AND intl real
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
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(t);
      if (!m || process.env[m[1]] != null) continue;
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}
loadDotEnv();
const prisma = new PrismaClient();

interface RegistryRow {
  schoolNameNorm: string;
  schoolName?: string;
  selectedUrl?: string | null;
  sourceUrl?: string | null;
  candidates?: Array<{ url: string }>;
  usNewsRank?: number | null;
}

const CDS_DATA_DIR = path.join(process.cwd(), 'scripts/cds-data');

function collectFromFile(
  filePath: string,
): Array<{ schoolNameNorm: string; url: string }> {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const out: Array<{ schoolNameNorm: string; url: string }> = [];
    const rows: RegistryRow[] = Array.isArray(data)
      ? data
      : (data.schools ?? []);
    for (const row of rows) {
      const url = row.selectedUrl || row.sourceUrl;
      if (!row.schoolNameNorm || !url) continue;
      out.push({ schoolNameNorm: row.schoolNameNorm, url });
      // Also collect candidates for backup
      if (row.candidates) {
        for (const c of row.candidates) {
          if (c.url)
            out.push({ schoolNameNorm: row.schoolNameNorm, url: c.url });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function main() {
  // Find all registry/extracted files
  const allFiles = fs
    .readdirSync(CDS_DATA_DIR)
    .filter((f) => f.startsWith('cds-') && f.endsWith('.json'))
    .map((f) => path.join(CDS_DATA_DIR, f));

  // Best URL per school (prefer schools' own .edu domain)
  const bestUrl = new Map<
    string,
    { url: string; score: number; schoolName?: string }
  >();
  for (const fp of allFiles) {
    for (const entry of collectFromFile(fp)) {
      const key = entry.schoolNameNorm;
      let score = 0;
      const urlLower = entry.url.toLowerCase();
      if (urlLower.endsWith('.pdf')) score += 50;
      if (urlLower.includes('.edu')) score += 30;
      if (
        urlLower.includes('2024-25') ||
        urlLower.includes('2024-2025') ||
        urlLower.includes('2024_2025')
      )
        score += 25;
      if (urlLower.includes('2023-24') || urlLower.includes('2023-2024'))
        score += 10;
      if (urlLower.includes('common') || urlLower.includes('cds')) score += 15;

      const existing = bestUrl.get(key);
      if (!existing || existing.score < score) {
        bestUrl.set(key, { url: entry.url, score });
      }
    }
  }

  // Cross-reference with DB to skip schools where data is already complete
  const usSchools = await prisma.school.findMany({
    where: {
      country: { in: ['US', 'United States', 'United States of America'] },
    },
    select: {
      id: true,
      name: true,
      nameNorm: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      gpaDistribution: true,
      metadata: true,
    },
  });
  const dbByNorm = new Map(usSchools.map((s) => [s.nameNorm, s]));

  const targets: Array<{
    schoolNameNorm: string;
    schoolName: string;
    selectedUrl: string;
  }> = [];
  for (const [norm, info] of bestUrl.entries()) {
    const db = dbByNorm.get(norm);
    if (!db) continue;
    const meta = (db.metadata as any) ?? {};
    const intlProv = meta.provenance?.intlAcceptanceRate;
    const oosProv = meta.provenance?.oosAcceptanceRate;
    // Skip permanent
    if (intlProv?.permanent || oosProv?.permanent) continue;
    // Include if any data is missing or heuristic
    const intlIsHeur =
      !db.intlAcceptanceRate ||
      intlProv?.tier === 'INFERRED' ||
      (typeof intlProv?.source === 'string' &&
        intlProv.source.toUpperCase().includes('HEURISTIC'));
    const oosIsHeur =
      !db.oosAcceptanceRate ||
      oosProv?.tier === 'INFERRED' ||
      (typeof oosProv?.source === 'string' &&
        oosProv.source.toUpperCase().includes('HEURISTIC'));
    const noGpa = !db.gpaDistribution;
    if (intlIsHeur || oosIsHeur || noGpa) {
      targets.push({
        schoolNameNorm: norm,
        schoolName: db.name,
        selectedUrl: info.url,
      });
    }
  }

  const out = {
    _meta: {
      generatedAt: new Date().toISOString(),
      source:
        'collect-all-known-urls.ts: dedup of all registry/extracted files',
      totalSchools: bestUrl.size,
      qualifyingTargets: targets.length,
    },
    schools: targets,
  };
  const outPath = path.join(
    CDS_DATA_DIR,
    'cds-known-urls-bundle-2026-04-28.json',
  );
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Total unique schools across all files: ${bestUrl.size}`);
  console.log(
    `Targets needing re-extract (incomplete data): ${targets.length}`,
  );
  console.log(`Output: ${outPath}`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
