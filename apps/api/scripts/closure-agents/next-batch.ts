#!/usr/bin/env tsx
/**
 * next-batch.ts — Dispatcher helper for closure pipeline Phase 3.
 *
 * Picks the next N US schools that are NOT yet closed on at least one of the
 * 7 prediction-critical fields, ranked by US News rank (lowest first).
 * Skips schools already in the ledger.
 *
 * Output: JSON to stdout + human summary to stderr.
 *
 * Ledger file: apps/api/scripts/closure-agents/ledger.json
 *   { processedSchools: { "<id>": { name, status, processedAt, batchId } } }
 *
 * Usage:
 *   tsx scripts/closure-agents/next-batch.ts [--size 3] [--skip 0]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { buildNormalizedSchoolProvenance } from '../../src/modules/school/school-provenance.helpers';
import { toSchoolFieldSource } from '@study-abroad/shared/utils';

const prisma = new PrismaClient();

const LEDGER_PATH = path.join(
  '/Users/yitianwu/Documents/study-abroad-platform/.claude/worktrees/zealous-nash-0332e6/apps/api/scripts/closure-agents',
  'ledger.json',
);

const PREDICTION_FIELDS = [
  'acceptanceRate',
  'sat25',
  'sat75',
  'intlAcceptanceRate',
  'oosAcceptanceRate',
  'edAcceptanceRate',
  'eaAcceptanceRate',
] as const;

const CLOSURE_TIERS = new Set([
  'OFFICIAL',
  'PARTNER',
  'UNAVAILABLE',
  'SCRAPED',
]);

interface LedgerEntry {
  name: string;
  status: 'PROCESSED' | 'FAILED' | 'PARTIAL';
  processedAt: string;
  batchId?: string;
  fieldsClosedDelta?: number;
  notes?: string;
}

interface Ledger {
  startedAt: string;
  processedSchools: Record<string, LedgerEntry>;
}

function loadLedger(): Ledger {
  if (!fs.existsSync(LEDGER_PATH)) {
    return { startedAt: new Date().toISOString(), processedSchools: {} };
  }
  return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf-8'));
}

function saveLedger(ledger: Ledger) {
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    size: parseInt(get('size') ?? '3', 10),
    skip: parseInt(get('skip') ?? '0', 10),
    markBatch: get('mark-batch'),
    recordSchool: get('record'),
    recordStatus: get('status') as
      | 'PROCESSED'
      | 'FAILED'
      | 'PARTIAL'
      | undefined,
    recordNotes: get('notes'),
  };
}

function countOpenFields(school: any, provenance: any): number {
  let open = 0;
  for (const f of PREDICTION_FIELDS) {
    if (f === 'oosAcceptanceRate' && school.isPrivate !== false) continue;
    if (
      (f === 'edAcceptanceRate' || f === 'eaAcceptanceRate') &&
      !school.hasEarlyDecision &&
      school[f] == null &&
      !provenance[f]
    )
      continue;
    const fp = provenance[f];
    const tier = fp ? toSchoolFieldSource(fp)?.tier : null;
    if (!(tier && CLOSURE_TIERS.has(tier))) open += 1;
  }
  return open;
}

async function main() {
  const opts = parseArgs();
  const ledger = loadLedger();

  // record mode: mark a school in the ledger
  if (opts.recordSchool && opts.recordStatus) {
    ledger.processedSchools[opts.recordSchool] = {
      name: opts.recordSchool, // caller passes name
      status: opts.recordStatus,
      processedAt: new Date().toISOString(),
      batchId: opts.markBatch,
      notes: opts.recordNotes,
    };
    saveLedger(ledger);
    console.error(
      `Ledger updated: ${opts.recordSchool} → ${opts.recordStatus}`,
    );
    return;
  }

  const schools = await prisma.school.findMany({
    where: {
      country: { in: ['US', 'United States', 'United States of America'] },
    },
    select: {
      id: true,
      name: true,
      usNewsRank: true,
      isPrivate: true,
      institutionType: true,
      hasEarlyDecision: true,
      acceptanceRate: true,
      sat25: true,
      sat75: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      metadata: true,
      dataReviewStatus: true,
    },
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
  });

  const candidates: Array<{
    id: string;
    name: string;
    rank: number | null;
    openFields: number;
    cdsUrl: string | null;
  }> = [];

  for (const s of schools) {
    if (
      s.institutionType === 'ART_DESIGN' ||
      s.institutionType === 'MUSIC_CONSERVATORY'
    )
      continue;
    if (s.dataReviewStatus === 'REJECTED') continue;
    if (ledger.processedSchools[s.id]) continue;
    const prov = buildNormalizedSchoolProvenance(s as any) as any;
    const openFields = countOpenFields(s, prov);
    if (openFields === 0) continue;
    // pull a CDS-like URL from any field's provenance for the agent to start with
    let cdsUrl: string | null = null;
    for (const f of PREDICTION_FIELDS) {
      const fp = prov[f];
      if (!fp) continue;
      const src = toSchoolFieldSource(fp);
      const u = src?.sourceUrl;
      if (
        u &&
        (u.toLowerCase().includes('cds') ||
          u.toLowerCase().includes('common-data-set') ||
          u.toLowerCase().endsWith('.pdf'))
      ) {
        cdsUrl = u;
        break;
      }
    }
    candidates.push({
      id: s.id,
      name: s.name,
      rank: s.usNewsRank,
      openFields,
      cdsUrl,
    });
  }

  // already sorted by rank from the query; take size after skip
  const batch = candidates.slice(opts.skip, opts.skip + opts.size);

  console.error(
    `Total candidates: ${candidates.length} | Processed in ledger: ${Object.keys(ledger.processedSchools).length} | Returning batch of ${batch.length}`,
  );
  console.error('');
  for (const b of batch) {
    console.error(
      `  rank ${String(b.rank ?? '—').padStart(4)} ${b.name.padEnd(45)} open=${b.openFields} cds=${b.cdsUrl ? 'HAS_URL' : 'NEEDS_DISCOVERY'}`,
    );
  }
  console.error('');

  console.log(JSON.stringify(batch, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
