#!/usr/bin/env tsx
import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  OPEN_DATA_STATUSES,
  TERMINAL_DATA_STATUSES,
} from './lib/field-source-matrix';

type Bucket =
  | 'trusted'
  | 'secondary'
  | 'heuristic'
  | 'terminal'
  | 'legacy'
  | 'open'
  | 'missing';

type WorklistAction =
  | 'trusted-closed'
  | 'terminal-accepted'
  | 'source-candidate-review'
  | 'legacy-provenance-review'
  | 'heuristic-review'
  | 'terminal-review'
  | 'needs-source-search';

interface Args {
  out: string;
  fields: string[];
  limit: number;
  includeClosed: boolean;
  maxFileBytes: number;
}

interface CandidateEvidence {
  file: string;
  fields: string[];
  sourceUrl: string | null;
  status: string | null;
  reason: string | null;
}

interface WorklistRow {
  schoolId: string;
  schoolName: string;
  nameNorm: string;
  usNewsRank: number | null;
  field: string;
  value: unknown;
  bucket: Bucket;
  action: WorklistAction;
  status: string | null;
  source: string | null;
  sourceUrl: string | null;
  terminalReason: string | null;
  candidateEvidence: CandidateEvidence[];
}

const API_ROOT = detectApiRoot();
const DEFAULT_FIELDS = [
  'eaAcceptanceRate',
  'edAcceptanceRate',
  'intlAcceptanceRate',
  'oosAcceptanceRate',
  'sat25',
  'sat75',
  'act25',
  'act75',
  'gpaDistribution',
  'acceptanceRate',
];
const US_COUNTRIES = ['US', 'United States', 'United States of America'];
const EXTRA_TERMINAL_STATUSES = [
  'TERMINAL',
  'UPSTREAM_NOT_PUBLISHED',
  'PRIVATE_SCHOOL_TERMINAL',
  'OFFICIAL_BLANK_FIELD',
  'OFFICIAL_BLANK',
  'NO_PUBLIC_REAL_DATA',
];

function detectApiRoot() {
  if (path.basename(process.cwd()) === 'api') return process.cwd();
  const candidate = path.join(process.cwd(), 'apps', 'api');
  if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  return process.cwd();
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback?: string) => {
    const inline = argv.find((arg) => arg.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1);
    const index = argv.indexOf(name);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fields = (get('--fields', DEFAULT_FIELDS.join(',')) ?? '')
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);
  return {
    out: path.resolve(
      API_ROOT,
      get(
        '--out',
        path.join(
          API_ROOT,
          'scripts',
          'closure-reports',
          `school-anchor-worklist-${stamp}.json`,
        ),
      )!,
    ),
    fields,
    limit: Number(get('--limit', '500')),
    includeClosed: argv.includes('--include-closed'),
    maxFileBytes: Number(get('--max-file-bytes', `${15 * 1024 * 1024}`)),
  };
}

async function main() {
  const args = parseArgs();
  const prisma = new PrismaClient();
  try {
    const candidateIndex = buildCandidateIndex(args);
    const schools = await prisma.school.findMany({
      where: { country: { in: US_COUNTRIES } },
      orderBy: [
        { usNewsRank: { sort: 'asc', nulls: 'last' } },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        nameNorm: true,
        usNewsRank: true,
        metadata: true,
        acceptanceRate: true,
        intlAcceptanceRate: true,
        oosAcceptanceRate: true,
        edAcceptanceRate: true,
        eaAcceptanceRate: true,
        transferAcceptanceRate: true,
        sat25: true,
        sat75: true,
        act25: true,
        act75: true,
        gpaDistribution: true,
      },
    });

    const rows: WorklistRow[] = [];
    for (const school of schools) {
      const nameNorm = normalizeName(school.nameNorm || school.name);
      for (const field of args.fields) {
        const provenance = fieldProvenance(school.metadata, field);
        const value = normalizeValue(
          (school as Record<string, unknown>)[field],
        );
        const status = statusFromProvenance(provenance);
        const bucket = classify(value, status);
        const candidates = (candidateIndex.get(nameNorm) ?? []).filter(
          (candidate) =>
            candidate.fields.includes(field) ||
            candidate.fields.some((candidateField) =>
              fieldsRelated(candidateField, field),
            ),
        );
        const action = chooseAction(bucket, provenance, candidates);
        if (!args.includeClosed && action === 'trusted-closed') continue;
        if (!args.includeClosed && action === 'terminal-accepted') continue;
        rows.push({
          schoolId: school.id,
          schoolName: school.name,
          nameNorm,
          usNewsRank: school.usNewsRank,
          field,
          value,
          bucket,
          action,
          status,
          source: stringOrNull(provenance.source),
          sourceUrl: stringOrNull(provenance.sourceUrl),
          terminalReason:
            stringOrNull(provenance.reason) ??
            stringOrNull(provenance.terminalReason),
          candidateEvidence: candidates.slice(0, 5),
        });
      }
    }

    const limitedRows = rows.slice(0, args.limit);
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only',
      fields: args.fields,
      limits: {
        requested: args.limit,
        emittedRows: limitedRows.length,
        totalOpenRows: rows.length,
      },
      summary: {
        byAction: countBy(rows, (row) => row.action),
        byField: summarizeByField(rows),
        candidateEvidenceRows: rows.filter(
          (row) => row.candidateEvidence.length > 0,
        ).length,
      },
      nextCampaigns: rankCampaigns(rows),
      rows: limitedRows,
    };
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`School anchor closure worklist: ${args.out}`);
    console.log(
      `Rows: ${limitedRows.length}/${rows.length}; candidateEvidenceRows=${report.summary.candidateEvidenceRows}`,
    );
    for (const campaign of report.nextCampaigns.slice(0, 5)) {
      console.log(
        `- ${campaign.field}: ${campaign.action} count=${campaign.count}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

function buildCandidateIndex(args: Args) {
  const index = new Map<string, CandidateEvidence[]>();
  const roots = [
    path.join(API_ROOT, 'scripts', 'cds-data'),
    path.join(API_ROOT, 'scripts', 'data'),
    path.join(API_ROOT, 'scripts', 'closure-reports'),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const file of walkFiles(root)) {
      if (path.extname(file).toLowerCase() !== '.json') continue;
      const stat = fs.statSync(file);
      if (stat.size > args.maxFileBytes) continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
        for (const record of extractCandidateRecords(parsed)) {
          const schoolName = extractSchoolName(record);
          if (!schoolName) continue;
          const fields = inferFields(record, file, args.fields);
          if (fields.length === 0) continue;
          const key = normalizeName(schoolName);
          const candidate: CandidateEvidence = {
            file: path.relative(API_ROOT, file),
            fields,
            sourceUrl: firstString(record, [
              'sourceUrl',
              'selectedUrl',
              'url',
              'sourceURL',
              'source',
            ]),
            status: firstString(record, [
              'status',
              'realDataStatus',
              'reviewStatus',
            ]),
            reason: firstString(record, ['reason', 'notes', 'terminalReason']),
          };
          const list = index.get(key) ?? [];
          if (
            !list.some(
              (existing) =>
                existing.file === candidate.file &&
                existing.fields.join(',') === candidate.fields.join(','),
            )
          ) {
            list.push(candidate);
          }
          index.set(key, list);
        }
      } catch {
        // This worklist should be resilient; malformed data files are handled by
        // the platform closure audit and do not block candidate indexing.
      }
    }
  }
  return index;
}

function extractCandidateRecords(value: unknown): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const visit = (item: unknown, depth: number) => {
    if (depth > 5 || !item || typeof item !== 'object') return;
    if (Array.isArray(item)) {
      for (const child of item) visit(child, depth + 1);
      return;
    }
    const record = item as Record<string, unknown>;
    if (extractSchoolName(record)) records.push(record);
    for (const key of ['schools', 'results', 'items', 'records', 'targets']) {
      const child = record[key];
      if (child) visit(child, depth + 1);
    }
  };
  visit(value, 0);
  return records;
}

function extractSchoolName(record: Record<string, unknown>) {
  return firstString(record, [
    'schoolNameNorm',
    'schoolName',
    'school',
    'nameNorm',
    'name',
    'institution',
  ]);
}

function inferFields(
  record: Record<string, unknown>,
  file: string,
  fields: string[],
) {
  const found = new Set<string>();
  const lowerFile = path.basename(file).toLowerCase();
  const missingFields = Array.isArray(record.missingFields)
    ? record.missingFields.map(String)
    : [];
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(record, field)) found.add(field);
    if (missingFields.includes(field)) found.add(field);
    if (fileHintsField(lowerFile, field)) found.add(field);
  }
  return [...found];
}

function fileHintsField(file: string, field: string) {
  if (field === 'intlAcceptanceRate') return /intl|international/.test(file);
  if (field === 'oosAcceptanceRate') return /oos|residency|resident/.test(file);
  if (field === 'edAcceptanceRate') return /\bed\b|c21|early/.test(file);
  if (field === 'eaAcceptanceRate') return /\bea\b|c21|early/.test(file);
  if (field === 'sat25' || field === 'sat75') return /sat|c9/.test(file);
  if (field === 'act25' || field === 'act75') return /act|c9/.test(file);
  if (field === 'gpaDistribution') return /gpa|c11/.test(file);
  if (field === 'acceptanceRate') return /c1|admit|accept/.test(file);
  return file.includes(field.toLowerCase());
}

function fieldsRelated(candidateField: string, targetField: string) {
  const groups = [
    ['sat25', 'sat75'],
    ['act25', 'act75'],
    ['edAcceptanceRate', 'eaAcceptanceRate'],
  ];
  return groups.some(
    (group) => group.includes(candidateField) && group.includes(targetField),
  );
}

function classify(value: unknown, status: string | null): Bucket {
  if (status && OPEN_DATA_STATUSES.includes(status as never)) return 'open';
  if (
    status &&
    (TERMINAL_DATA_STATUSES.includes(status as never) ||
      EXTRA_TERMINAL_STATUSES.includes(status))
  ) {
    return 'terminal';
  }
  const has = hasValue(value);
  if (has && status === 'VERIFIED_SECONDARY') return 'secondary';
  if (
    has &&
    (status === 'HEURISTIC_FILL' || status === 'PERMANENT_HEURISTIC')
  ) {
    return 'heuristic';
  }
  if (
    has &&
    (status === 'VERIFIED_REAL' || status === 'OFFICIAL_REAL_LEGACY')
  ) {
    return 'trusted';
  }
  if (has) return 'legacy';
  return 'missing';
}

function chooseAction(
  bucket: Bucket,
  provenance: Record<string, unknown>,
  candidates: CandidateEvidence[],
): WorklistAction {
  if (bucket === 'trusted' || bucket === 'secondary') return 'trusted-closed';
  if (bucket === 'terminal') return 'terminal-accepted';
  if (bucket === 'heuristic') return 'heuristic-review';
  const terminalish = [
    provenance.source,
    provenance.status,
    provenance.realDataStatus,
  ].some(
    (value) =>
      typeof value === 'string' &&
      (value.toUpperCase().includes('TERMINAL') ||
        value.toUpperCase().includes('UPSTREAM_NOT_PUBLISHED')),
  );
  if (terminalish) return 'terminal-review';
  if (candidates.length > 0) return 'source-candidate-review';
  if (bucket === 'legacy') return 'legacy-provenance-review';
  return 'needs-source-search';
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
      EXTRA_TERMINAL_STATUSES.includes(candidate) ||
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

function rankCampaigns(rows: WorklistRow[]) {
  const counts = new Map<
    string,
    { field: string; action: WorklistAction; count: number }
  >();
  for (const row of rows) {
    const key = `${row.field}:${row.action}`;
    const current = counts.get(key) ?? {
      field: row.field,
      action: row.action,
      count: 0,
    };
    current.count += 1;
    counts.set(key, current);
  }
  const actionWeight: Record<WorklistAction, number> = {
    'needs-source-search': 5,
    'source-candidate-review': 4,
    'legacy-provenance-review': 3,
    'heuristic-review': 3,
    'terminal-review': 2,
    'terminal-accepted': 0,
    'trusted-closed': 0,
  };
  return [...counts.values()]
    .map((item) => ({
      ...item,
      score: item.count * actionWeight[item.action],
    }))
    .sort((a, b) => b.score - a.score);
}

function summarizeByField(rows: WorklistRow[]) {
  const summary: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    summary[row.field] ??= {};
    summary[row.field][row.action] = (summary[row.field][row.action] ?? 0) + 1;
  }
  return summary;
}

function countBy<T>(rows: T[], getKey: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = getKey(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function fieldProvenance(metadata: unknown, field: string) {
  const meta = asRecord(metadata);
  const provenance = asRecord(meta.provenance);
  return asRecord(provenance[field]);
}

function normalizeValue(value: unknown) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return value ?? null;
}

function hasValue(value: unknown) {
  if (value == null) return false;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function walkFiles(root: string): string[] {
  const output: string[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) output.push(full);
    }
  };
  visit(root);
  return output;
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
