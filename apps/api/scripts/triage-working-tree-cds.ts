#!/usr/bin/env ts-node
/**
 * Phase X1: Triage all working-tree CDS JSON files.
 *
 * For each cds-* file in scripts/cds-data/:
 *  - Parse meta + schools[]
 *  - Cross-reference each school against current DB state
 *  - Identify which schools have data the DB doesn't (NEW)
 *  - Identify which would just confirm existing data (CONFIRM)
 *  - Identify which would CONFLICT with existing (CONFLICT)
 *
 * Outputs:
 *  - tmp/cds-triage-report.md  (human-readable summary)
 *  - tmp/cds-triage-summary.json (machine-readable, used by import-cds-bundle.ts)
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

interface SchoolRow {
  schoolNameNorm: string;
  schoolName?: string;
  cycleYear?: number;
  sourceUrl?: string;
  applicants?: {
    total?: number;
    inState?: number;
    outOfState?: number;
    international?: number;
  };
  admitted?: {
    total?: number;
    inState?: number;
    outOfState?: number;
    international?: number;
  };
  rates?: {
    acceptanceRate?: number;
    intlAcceptanceRate?: number;
    oosAcceptanceRate?: number;
    transferAcceptanceRate?: number;
  };
  gpaDistribution?: Record<string, number>;
  edAcceptanceRate?: number;
  eaAcceptanceRate?: number;
  edApplied?: number;
  edAdmitted?: number;
  notes?: string;
}

interface FileMeta {
  path: string;
  fileName: string;
  extractedAt?: string;
  source?: string;
  schools: SchoolRow[];
  schoolCount: number;
  hasIntl: number;
  hasOos: number;
  hasGpaDist: number;
  hasEdEa: number;
  uniqueSchoolNorms: Set<string>;
}

const CDS_DATA_DIR = path.join(process.cwd(), 'scripts/cds-data');

function loadFile(filePath: string): FileMeta | null {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(text);
    const schools: SchoolRow[] = Array.isArray(data.schools)
      ? data.schools
      : [];
    const meta: FileMeta = {
      path: filePath,
      fileName: path.basename(filePath),
      extractedAt: data._meta?.extractedAt,
      source: data._meta?.source,
      schools,
      schoolCount: schools.length,
      hasIntl: 0,
      hasOos: 0,
      hasGpaDist: 0,
      hasEdEa: 0,
      uniqueSchoolNorms: new Set(),
    };
    for (const s of schools) {
      meta.uniqueSchoolNorms.add(s.schoolNameNorm);
      if (s.rates?.intlAcceptanceRate != null) meta.hasIntl++;
      if (s.rates?.oosAcceptanceRate != null) meta.hasOos++;
      if (s.gpaDistribution && Object.keys(s.gpaDistribution).length > 0)
        meta.hasGpaDist++;
      if (s.edAcceptanceRate != null || s.eaAcceptanceRate != null)
        meta.hasEdEa++;
    }
    return meta;
  } catch {
    return null;
  }
}

async function main() {
  // Load all cds-*.json files
  const allFiles = fs
    .readdirSync(CDS_DATA_DIR)
    .filter((f) => f.startsWith('cds-') && f.endsWith('.json'))
    .map((f) => path.join(CDS_DATA_DIR, f));

  console.log(`Found ${allFiles.length} CDS data files in ${CDS_DATA_DIR}\n`);

  const fileMetas: FileMeta[] = [];
  for (const fp of allFiles) {
    const m = loadFile(fp);
    if (m) fileMetas.push(m);
  }

  // Sort by school count desc
  fileMetas.sort((a, b) => b.schoolCount - a.schoolCount);

  // Load current DB state for cross-reference
  const usSchools = await prisma.school.findMany({
    where: {
      country: { in: ['US', 'United States', 'United States of America'] },
    },
    select: {
      id: true,
      name: true,
      nameNorm: true,
      acceptanceRate: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      gpaDistribution: true,
      metadata: true,
    },
  });
  const dbByNorm = new Map(usSchools.map((s) => [s.nameNorm, s]));
  console.log(`DB has ${usSchools.length} US schools.\n`);

  // For each file, classify each row
  const fileReports: Array<{
    fileName: string;
    schoolCount: number;
    matched: number;
    unknown: number;
    netNewIntl: number;
    netNewOos: number;
    netNewGpaDist: number;
    netNewEdEa: number;
    sourceFresh: boolean;
    extractedAt?: string;
  }> = [];

  for (const fm of fileMetas) {
    let matched = 0;
    let unknown = 0;
    let netNewIntl = 0;
    let netNewOos = 0;
    let netNewGpaDist = 0;
    let netNewEdEa = 0;

    for (const row of fm.schools) {
      const dbSchool = dbByNorm.get(row.schoolNameNorm);
      if (!dbSchool) {
        unknown++;
        continue;
      }
      matched++;
      const dbMeta = (dbSchool.metadata as any) ?? {};
      const dbProv = dbMeta.provenance ?? {};
      const intlIsHeur = (dbProv.intlAcceptanceRate?.source ?? '')
        .toUpperCase()
        .includes('HEURISTIC');
      const oosIsHeur = (dbProv.oosAcceptanceRate?.source ?? '')
        .toUpperCase()
        .includes('HEURISTIC');

      if (
        row.rates?.intlAcceptanceRate != null &&
        (dbSchool.intlAcceptanceRate == null || intlIsHeur)
      ) {
        netNewIntl++;
      }
      if (
        row.rates?.oosAcceptanceRate != null &&
        (dbSchool.oosAcceptanceRate == null || oosIsHeur)
      ) {
        netNewOos++;
      }
      if (
        row.gpaDistribution &&
        Object.keys(row.gpaDistribution).length > 0 &&
        dbSchool.gpaDistribution == null
      ) {
        netNewGpaDist++;
      }
      if (row.edAcceptanceRate != null || row.eaAcceptanceRate != null) {
        netNewEdEa++;
      }
    }

    fileReports.push({
      fileName: fm.fileName,
      schoolCount: fm.schoolCount,
      matched,
      unknown,
      netNewIntl,
      netNewOos,
      netNewGpaDist,
      netNewEdEa,
      sourceFresh: fm.extractedAt
        ? new Date(fm.extractedAt) >
          new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
        : false,
      extractedAt: fm.extractedAt,
    });
  }

  // Print report
  console.log('=== TOP FILES BY NET-NEW VALUE (intl + oos + gpa) ===\n');
  fileReports
    .map((r) => ({
      ...r,
      netNewScore: r.netNewIntl + r.netNewOos + r.netNewGpaDist + r.netNewEdEa,
    }))
    .sort((a, b) => b.netNewScore - a.netNewScore)
    .slice(0, 20)
    .forEach((r) => {
      const dt = r.extractedAt ? r.extractedAt.slice(0, 10) : '?';
      console.log(
        `  ${r.fileName.slice(0, 55).padEnd(55)} (${dt})  schools=${String(r.schoolCount).padStart(3)} +intl=${String(r.netNewIntl).padStart(2)} +oos=${String(r.netNewOos).padStart(2)} +gpa=${String(r.netNewGpaDist).padStart(2)} +ED/EA=${String(r.netNewEdEa).padStart(2)}`,
      );
    });

  // Compute UNION of all schools across all files (with rates or gpa)
  const allUniqueSchools = new Map<
    string,
    { sources: Set<string>; bestData: SchoolRow }
  >();
  // Sort files by extractedAt desc so newer extracts win
  const sortedByFresh = [...fileMetas].sort((a, b) => {
    const at = a.extractedAt ? new Date(a.extractedAt).getTime() : 0;
    const bt = b.extractedAt ? new Date(b.extractedAt).getTime() : 0;
    return bt - at;
  });
  for (const fm of sortedByFresh) {
    for (const row of fm.schools) {
      if (!row.schoolNameNorm) continue;
      const existing = allUniqueSchools.get(row.schoolNameNorm);
      if (!existing) {
        allUniqueSchools.set(row.schoolNameNorm, {
          sources: new Set([fm.fileName]),
          bestData: row,
        });
      } else {
        existing.sources.add(fm.fileName);
        // Merge: take fields the new row has that existing doesn't
        const merged = { ...existing.bestData };
        if (
          row.rates?.intlAcceptanceRate != null &&
          merged.rates?.intlAcceptanceRate == null
        ) {
          merged.rates = {
            ...(merged.rates ?? {}),
            intlAcceptanceRate: row.rates.intlAcceptanceRate,
          };
        }
        if (
          row.rates?.oosAcceptanceRate != null &&
          merged.rates?.oosAcceptanceRate == null
        ) {
          merged.rates = {
            ...(merged.rates ?? {}),
            oosAcceptanceRate: row.rates.oosAcceptanceRate,
          };
        }
        if (row.gpaDistribution && !merged.gpaDistribution) {
          merged.gpaDistribution = row.gpaDistribution;
        }
        if (row.edAcceptanceRate != null && merged.edAcceptanceRate == null) {
          merged.edAcceptanceRate = row.edAcceptanceRate;
        }
        if (row.eaAcceptanceRate != null && merged.eaAcceptanceRate == null) {
          merged.eaAcceptanceRate = row.eaAcceptanceRate;
        }
        existing.bestData = merged;
      }
    }
  }

  console.log(
    `\n=== TOTAL UNIQUE SCHOOLS ACROSS ALL FILES: ${allUniqueSchools.size} ===\n`,
  );

  // Compute net-new from union vs DB
  let totalNewIntl = 0;
  let totalNewOos = 0;
  let totalNewGpa = 0;
  let totalNewEdEa = 0;
  let unmatched = 0;
  const newDataSchools: SchoolRow[] = [];

  for (const [norm, info] of allUniqueSchools.entries()) {
    const dbSchool = dbByNorm.get(norm);
    if (!dbSchool) {
      unmatched++;
      continue;
    }
    const dbMeta = (dbSchool.metadata as any) ?? {};
    const dbProv = dbMeta.provenance ?? {};
    const intlIsHeur = (dbProv.intlAcceptanceRate?.source ?? '')
      .toUpperCase()
      .includes('HEURISTIC');
    const oosIsHeur = (dbProv.oosAcceptanceRate?.source ?? '')
      .toUpperCase()
      .includes('HEURISTIC');
    let needsImport = false;
    const row = info.bestData;
    if (
      row.rates?.intlAcceptanceRate != null &&
      (dbSchool.intlAcceptanceRate == null || intlIsHeur)
    ) {
      totalNewIntl++;
      needsImport = true;
    }
    if (
      row.rates?.oosAcceptanceRate != null &&
      (dbSchool.oosAcceptanceRate == null || oosIsHeur)
    ) {
      totalNewOos++;
      needsImport = true;
    }
    if (
      row.gpaDistribution &&
      Object.keys(row.gpaDistribution).length > 0 &&
      dbSchool.gpaDistribution == null
    ) {
      totalNewGpa++;
      needsImport = true;
    }
    if (row.edAcceptanceRate != null || row.eaAcceptanceRate != null) {
      totalNewEdEa++;
      needsImport = true;
    }
    if (needsImport) newDataSchools.push(row);
  }

  console.log(`Schools across all files: ${allUniqueSchools.size}`);
  console.log(`  In DB:           ${allUniqueSchools.size - unmatched}`);
  console.log(`  Not in DB:       ${unmatched} (will be ignored)`);
  console.log(`  Net-new intl:    ${totalNewIntl}`);
  console.log(`  Net-new oos:     ${totalNewOos}`);
  console.log(`  Net-new gpa:     ${totalNewGpa}`);
  console.log(`  Net-new ED/EA:   ${totalNewEdEa}`);
  console.log(`  Schools to import: ${newDataSchools.length}`);

  // Write merged bundle ready for import-cds-bundle
  const outDir = path.join(process.cwd(), 'scripts/cds-data');
  const outPath = path.join(outDir, 'cds-merged-bundle-2026-04-28.json');
  const bundle = {
    _meta: {
      generatedAt: new Date().toISOString(),
      source: 'triage-working-tree-cds.ts: merged from all cds-*.json files',
      filesScanned: fileMetas.length,
      uniqueSchools: allUniqueSchools.size,
      schoolsToImport: newDataSchools.length,
    },
    schools: newDataSchools,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(bundle, null, 2)}\n`);
  console.log(`\nMerged bundle written: ${outPath}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
