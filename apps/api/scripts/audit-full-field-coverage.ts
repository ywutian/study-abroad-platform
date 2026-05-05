#!/usr/bin/env tsx
import 'dotenv/config';

import { Prisma, PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import {
  FULL_FIELD_AUDIT_SPECS,
  OPEN_DATA_STATUSES,
  TERMINAL_DATA_STATUSES,
  type FullFieldAuditSpec,
} from './lib/field-source-matrix';

const prisma = new PrismaClient();
const US_COUNTRIES = ['US', 'United States', 'United States of America'];

type Bucket =
  | 'real'
  | 'secondary'
  | 'heuristic'
  | 'terminal'
  | 'legacyValue'
  | 'open'
  | 'missing';

interface FieldResult {
  field: string;
  value: unknown;
  bucket: Bucket;
  status: string | null;
  source: string | null;
  sourceUrl: string | null;
  verifiedAt: string | null;
  terminalReason: string | null;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback?: string) => {
    const idx = argv.indexOf(name);
    if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
    const inline = argv.find((arg) => arg.startsWith(`${name}=`));
    return inline ? inline.slice(name.length + 1) : fallback;
  };
  const requested = get('--fields');
  const fields = requested
    ? new Set(
        requested
          .split(',')
          .map((field) => field.trim())
          .filter(Boolean),
      )
    : null;
  return {
    out: get(
      '--out',
      path.join(
        process.cwd(),
        'scripts/coverage-reports',
        `full-field-coverage-${new Date().toISOString().slice(0, 10)}.json`,
      ),
    ),
    fields,
    allowLegacyValues: !argv.includes('--strict-provenance'),
  };
}

async function main() {
  const args = parseArgs();
  const specs = FULL_FIELD_AUDIT_SPECS.filter(
    (spec) => !args.fields || args.fields.has(spec.key),
  );
  const schools = await prisma.school.findMany({
    where: { country: { in: US_COUNTRIES } },
    orderBy: [{ usNewsRank: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      usNewsRank: true,
      metadata: true,
      acceptanceRate: true,
      intlAcceptanceRate: true,
      oosAcceptanceRate: true,
      transferAcceptanceRate: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      hasEarlyDecision: true,
      sat25: true,
      sat75: true,
      satAvg: true,
      satMath25: true,
      satMath75: true,
      satReading25: true,
      satReading75: true,
      act25: true,
      act75: true,
      actAvg: true,
      gpaDistribution: true,
      tuition: true,
      roomAndBoard: true,
      averageAidPackage: true,
      averageNetPrice: true,
      percentNeedMet: true,
      applicationFee: true,
      feeWaiverAvailable: true,
      acceptsCommonApp: true,
      acceptsCoalition: true,
      testOptional: true,
      testingPolicy: true,
      graduationRate: true,
      retentionRate: true,
      salary6YrPostGrad: true,
      avgSalary: true,
      loanDefaultRate: true,
      monthlyLoanPayment: true,
      totalEnrollment: true,
      studentFacultyRatio: true,
      intlStudentPct: true,
      countriesRepresented: true,
      studentOrgsCount: true,
      nicheOverallGrade: true,
      nicheSafetyGrade: true,
      nicheLifeGrade: true,
      nicheFoodGrade: true,
      description: true,
      descriptionZh: true,
      _count: {
        select: {
          cdsAdmitBands: true,
          programs: true,
          deadlines: true,
          essayPrompts: true,
          rankings: true,
          communityRatings: true,
          cases: true,
        },
      },
    },
  });

  const totals = Object.fromEntries(
    specs.map((spec) => [
      spec.key,
      {
        real: 0,
        secondary: 0,
        heuristic: 0,
        terminal: 0,
        legacyValue: 0,
        open: 0,
        missing: 0,
      },
    ]),
  ) as Record<string, Record<Bucket, number>>;

  const items = schools.map((school) => {
    const fields = specs.map((spec) => {
      const result = classifyField(school as Record<string, unknown>, spec, {
        allowLegacyValues: args.allowLegacyValues,
      });
      totals[spec.key][result.bucket] += 1;
      return result;
    });
    return {
      schoolId: school.id,
      schoolName: school.name,
      usNewsRank: school.usNewsRank,
      fields,
    };
  });

  const open = Object.values(totals).reduce(
    (sum, field) => sum + field.open + field.missing,
    0,
  );
  const report = {
    generatedAt: new Date().toISOString(),
    scope: 'us-undergraduate-full-field',
    hardGates: {
      pass: open === 0,
      open,
      fieldsWithOpen: Object.entries(totals)
        .filter(([, total]) => total.open + total.missing > 0)
        .map(([field, total]) => ({
          field,
          open: total.open,
          missing: total.missing,
        })),
    },
    totals: {
      schools: schools.length,
      fields: specs.length,
      byField: totals,
    },
    items,
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Full-field coverage: ${args.out}`);
  console.log(`Schools: ${schools.length}`);
  console.log(`Fields: ${specs.length}`);
  console.log(`Hard gates: ${report.hardGates.pass ? 'PASS' : 'FAIL'}`);
  for (const [field, total] of Object.entries(totals)) {
    console.log(
      `${field}: real=${total.real} secondary=${total.secondary} heuristic=${total.heuristic} terminal=${total.terminal} legacy=${total.legacyValue} open=${total.open} missing=${total.missing}`,
    );
  }

  if (!report.hardGates.pass) process.exitCode = 1;
}

function classifyField(
  school: Record<string, unknown>,
  spec: FullFieldAuditSpec,
  options: { allowLegacyValues: boolean },
): FieldResult {
  const provenance = fieldProvenance(school.metadata, spec.key);
  const rawStatus = statusFromProvenance(provenance);
  const value = valueFor(school, spec);
  const hasUsableValue = hasValue(value, spec);

  let bucket: Bucket = 'missing';
  if (rawStatus && OPEN_DATA_STATUSES.includes(rawStatus as never)) {
    bucket = 'open';
  } else if (rawStatus && TERMINAL_DATA_STATUSES.includes(rawStatus as never)) {
    bucket = 'terminal';
  } else if (hasUsableValue && rawStatus === 'VERIFIED_SECONDARY') {
    bucket = 'secondary';
  } else if (
    hasUsableValue &&
    (rawStatus === 'HEURISTIC_FILL' || rawStatus === 'PERMANENT_HEURISTIC')
  ) {
    bucket = 'heuristic';
  } else if (
    hasUsableValue &&
    (rawStatus === 'VERIFIED_REAL' || rawStatus === 'OFFICIAL_REAL_LEGACY')
  ) {
    bucket = 'real';
  } else if (hasUsableValue && options.allowLegacyValues) {
    bucket = 'legacyValue';
  } else if (spec.userGenerated && !hasUsableValue) {
    bucket = 'terminal';
  }

  return {
    field: spec.key,
    value,
    bucket,
    status: rawStatus,
    source: stringOrNull(provenance.source),
    sourceUrl: stringOrNull(provenance.sourceUrl),
    verifiedAt: stringOrNull(provenance.verifiedAt),
    terminalReason:
      stringOrNull(provenance.reason) ??
      stringOrNull(provenance.terminalReason),
  };
}

function valueFor(school: Record<string, unknown>, spec: FullFieldAuditSpec) {
  if (spec.kind === 'relation') {
    const counts = record(school._count);
    const key = spec.relationCount ?? spec.key;
    return typeof counts[key] === 'number' ? counts[key] : null;
  }
  const value = school[spec.key];
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return value ?? null;
}

function hasValue(value: unknown, spec: FullFieldAuditSpec) {
  if (value == null) return false;
  if (typeof value === 'number') {
    if (spec.kind === 'relation') return value > 0;
    return Number.isFinite(value);
  }
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string')
    return value.trim().length > 0 && value !== 'UNKNOWN';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.length > 0;
    return Object.keys(value as Record<string, unknown>).length > 0;
  }
  return true;
}

function statusFromProvenance(provenance: Record<string, unknown>) {
  const candidates = [
    provenance.realDataStatus,
    provenance.status,
    provenance.tier,
    provenance.source,
  ]
    .map((value) => (typeof value === 'string' ? value.toUpperCase() : null))
    .filter(Boolean) as string[];
  for (const candidate of candidates) {
    if (
      OPEN_DATA_STATUSES.includes(candidate as never) ||
      TERMINAL_DATA_STATUSES.includes(candidate as never) ||
      candidate === 'VERIFIED_REAL' ||
      candidate === 'VERIFIED_SECONDARY' ||
      candidate === 'OFFICIAL_REAL_LEGACY' ||
      candidate === 'HEURISTIC_FILL'
    ) {
      return candidate;
    }
    if (candidate.includes('HEURISTIC')) return 'HEURISTIC_FILL';
    if (candidate.includes('SECONDARY')) return 'VERIFIED_SECONDARY';
    if (
      candidate.includes('OFFICIAL') ||
      candidate.includes('CDS') ||
      candidate.includes('IPEDS') ||
      candidate.includes('SCORECARD')
    ) {
      return 'VERIFIED_REAL';
    }
  }
  return null;
}

function fieldProvenance(metadata: unknown, field: string) {
  const meta = record(metadata);
  const provenance = record(meta.provenance);
  return record(provenance[field]);
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' ? value : null;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
