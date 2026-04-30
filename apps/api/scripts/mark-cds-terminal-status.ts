#!/usr/bin/env ts-node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type TerminalStatus =
  | 'OFFICIAL_BLANK'
  | 'OFFICIAL_BLOCKED'
  | 'NO_PUBLIC_REAL_DATA'
  | 'MANUAL_REVIEW'
  | 'PERMANENT_HEURISTIC';

const TERMINAL_STATUSES = new Set<TerminalStatus>([
  'OFFICIAL_BLANK',
  'OFFICIAL_BLOCKED',
  'NO_PUBLIC_REAL_DATA',
  'MANUAL_REVIEW',
  'PERMANENT_HEURISTIC',
]);

interface LedgerSchool {
  schoolId?: string;
  schoolName?: string;
  schoolNameNorm?: string;
  missingFields?: string[];
  status?: string;
  selectedUrl?: string | null;
  reason?: string;
  lastError?: string;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const has = (name: string) => args.includes(`--${name}`);
  return {
    input: get('input') ?? 'scripts/cds-data/tavily-marathon-ledger.json',
    live: has('live'),
    fields: (get('fields') ?? 'intlAcceptanceRate,oosAcceptanceRate')
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean),
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function deepMerge(
  base: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      out[key] &&
      typeof out[key] === 'object' &&
      !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(
        out[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}

function sourceFor(status: TerminalStatus) {
  if (status === 'PERMANENT_HEURISTIC') return 'PERMANENT_HEURISTIC';
  return status;
}

function tierFor(status: TerminalStatus) {
  if (status === 'PERMANENT_HEURISTIC') return 'INFERRED';
  return 'UNAVAILABLE';
}

function hasVerifiedOfficialValue(value: unknown): boolean {
  const entry = record(value);
  const tier =
    typeof entry.tier === 'string' ? entry.tier.trim().toUpperCase() : '';
  const status =
    typeof entry.realDataStatus === 'string'
      ? entry.realDataStatus.trim().toUpperCase()
      : '';
  const source =
    typeof entry.source === 'string' ? entry.source.trim().toUpperCase() : '';
  return (
    tier === 'OFFICIAL' ||
    tier === 'PARTNER' ||
    status === 'VERIFIED_REAL' ||
    status === 'PARTIAL_REAL' ||
    source.includes('COLLEGE_SCORECARD') ||
    source.includes('IPEDS') ||
    source.includes('CDS_OFFICIAL')
  );
}

async function main() {
  const args = parseArgs();
  const input = path.isAbsolute(args.input)
    ? args.input
    : path.join(process.cwd(), args.input);
  const raw = JSON.parse(fs.readFileSync(input, 'utf8')) as {
    schools?: Record<string, LedgerSchool> | LedgerSchool[];
  };
  const schools = Array.isArray(raw.schools)
    ? raw.schools
    : Object.values(raw.schools ?? {});
  const terminal = schools.filter((school) =>
    TERMINAL_STATUSES.has(school.status as TerminalStatus),
  );

  console.log(
    `[${args.live ? 'LIVE' : 'DRY-RUN'}] terminal schools=${terminal.length} from ${input}`,
  );

  const byId = new Map<string, LedgerSchool>();
  const norms: string[] = [];
  for (const school of terminal) {
    if (school.schoolId) byId.set(school.schoolId, school);
    else if (school.schoolNameNorm) norms.push(school.schoolNameNorm);
  }

  const whereOr = [
    byId.size > 0 ? { id: { in: [...byId.keys()] } } : null,
    norms.length > 0 ? { nameNorm: { in: norms } } : null,
  ].filter((clause): clause is NonNullable<typeof clause> => clause != null);
  const dbSchools = await prisma.school.findMany({
    where: whereOr.length > 0 ? { OR: whereOr } : { id: { in: [] } },
    select: { id: true, name: true, nameNorm: true, metadata: true },
  });

  let updated = 0;
  let skippedVerified = 0;
  for (const dbSchool of dbSchools) {
    const ledgerSchool =
      byId.get(dbSchool.id) ??
      terminal.find((school) => school.schoolNameNorm === dbSchool.nameNorm);
    if (!ledgerSchool) continue;
    const status = ledgerSchool.status as TerminalStatus;
    const fields =
      ledgerSchool.missingFields && ledgerSchool.missingFields.length > 0
        ? ledgerSchool.missingFields
        : args.fields;
    const oldMeta = record(dbSchool.metadata);
    const oldProv = record(oldMeta.provenance);
    const provPatch: Record<string, unknown> = {};
    const verifiedAt = new Date().toISOString();
    for (const field of fields) {
      if (hasVerifiedOfficialValue(oldProv[field])) {
        skippedVerified += 1;
        continue;
      }
      provPatch[field] = {
        source: sourceFor(status),
        tier: tierFor(status),
        fetchedAt: verifiedAt,
        realDataStatus: status,
        sourceUrl: ledgerSchool.selectedUrl ?? null,
        reason:
          ledgerSchool.reason ??
          ledgerSchool.lastError ??
          `Marked ${status} by CDS marathon terminal classifier.`,
        verifiedAt,
        permanent: status === 'PERMANENT_HEURISTIC',
      };
    }
    if (Object.keys(provPatch).length === 0) {
      console.log(`  ↷ ${dbSchool.name}: skipped existing verified values`);
      continue;
    }
    const metadata = deepMerge(oldMeta, {
      provenance: deepMerge(oldProv, provPatch),
    });
    if (args.live) {
      await prisma.school.update({
        where: { id: dbSchool.id },
        data: { metadata: metadata as Prisma.InputJsonValue },
      });
    }
    updated++;
    console.log(`  ${args.live ? '✓' : '·'} ${dbSchool.name}: ${status}`);
  }
  console.log(
    `Done. Updated=${updated} skippedVerifiedFields=${skippedVerified}`,
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
