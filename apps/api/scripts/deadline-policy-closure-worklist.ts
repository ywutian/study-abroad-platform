#!/usr/bin/env tsx
import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

type Severity = 'critical' | 'warning' | 'info';
type Bucket =
  | 'trusted-usable'
  | 'missing-provenance'
  | 'stale'
  | 'conflict'
  | 'needs-review'
  | 'terminal';
type WorklistAction =
  | 'trusted-closed'
  | 'terminal-accepted'
  | 'source-evidence-review'
  | 'refresh-deadline'
  | 'review-deadline-conflict'
  | 'review-policy-evidence'
  | 'refresh-policy-evidence'
  | 'policy-source-review'
  | 'policy-quality-review';

interface Args {
  out: string;
  limit: number;
  includeClosed: boolean;
  applicationYear: number;
  staleDays: number;
  policyQualityThreshold: number;
}

interface WorklistRow {
  id: string;
  kind: 'deadline' | 'policy_evidence';
  schoolId: string;
  schoolName: string;
  usNewsRank: number | null;
  gap: string;
  bucket: Bucket;
  action: WorklistAction;
  severity: Severity;
  route: string;
  details: Record<string, unknown>;
}

const API_ROOT = detectApiRoot();
const DAY_MS = 24 * 60 * 60 * 1000;
const TENTATIVE_SOURCE_MARKER = 'TENTATIVE_BASED_ON_PRIOR_YEAR';

function detectApiRoot() {
  if (path.basename(process.cwd()) === 'api') return process.cwd();
  const candidate = path.join(process.cwd(), 'apps', 'api');
  if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  return process.cwd();
}

function resolveApplicationYear(now = new Date()): number {
  return now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
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
  return {
    out: path.resolve(
      API_ROOT,
      get(
        '--out',
        path.join(
          API_ROOT,
          'scripts',
          'closure-reports',
          `deadline-policy-worklist-${stamp}.json`,
        ),
      )!,
    ),
    limit: Number(get('--limit', '500')),
    includeClosed: argv.includes('--include-closed'),
    applicationYear: Number(
      get('--application-year', `${resolveApplicationYear()}`),
    ),
    staleDays: Number(get('--stale-days', '365')),
    policyQualityThreshold: Number(get('--policy-quality-threshold', '3')),
  };
}

async function main() {
  const args = parseArgs();
  const now = new Date();
  const staleCutoff = now.getTime() - args.staleDays * DAY_MS;
  const prisma = new PrismaClient();
  try {
    const [deadlines, policyEvidence] = await Promise.all([
      prisma.schoolDeadline.findMany({
        where: { year: args.applicationYear },
        orderBy: [
          { applicationDeadline: 'asc' },
          { school: { usNewsRank: { sort: 'asc', nulls: 'last' } } },
          { school: { name: 'asc' } },
        ],
        select: {
          id: true,
          schoolId: true,
          year: true,
          round: true,
          applicationDeadline: true,
          financialAidDeadline: true,
          decisionDate: true,
          source: true,
          notes: true,
          updatedAt: true,
          school: {
            select: { name: true, usNewsRank: true, website: true },
          },
        },
      }),
      prisma.schoolPolicyEvidence.findMany({
        orderBy: [
          { status: 'asc' },
          { school: { usNewsRank: { sort: 'asc', nulls: 'last' } } },
          { updatedAt: 'asc' },
        ],
        select: {
          id: true,
          schoolId: true,
          policyDimension: true,
          policyValue: true,
          sourceName: true,
          sourceUrl: true,
          sourcePublishedAt: true,
          sourceQuality: true,
          status: true,
          reviewedAt: true,
          reviewedBy: true,
          expiresAt: true,
          notes: true,
          updatedAt: true,
          school: {
            select: { name: true, usNewsRank: true, website: true },
          },
        },
      }),
    ]);

    const rows = [
      ...deadlines.flatMap((deadline) =>
        classifyDeadline(deadline, staleCutoff),
      ),
      ...policyEvidence.flatMap((evidence) =>
        classifyPolicyEvidence(evidence, args, now),
      ),
    ];
    const orderedRows = rows
      .filter(
        (row) =>
          args.includeClosed ||
          !['trusted-closed', 'terminal-accepted'].includes(row.action),
      )
      .sort(compareRows);
    const limitedRows = orderedRows.slice(0, args.limit);
    const report = {
      generatedAt: now.toISOString(),
      mode: 'read-only',
      applicationYear: args.applicationYear,
      staleDays: args.staleDays,
      policyQualityThreshold: args.policyQualityThreshold,
      limits: {
        requested: args.limit,
        emittedRows: limitedRows.length,
        totalOpenRows: orderedRows.length,
      },
      summary: {
        deadlines: deadlines.length,
        policyEvidence: policyEvidence.length,
        manualDeadlines: deadlines.filter(
          (deadline) => deadline.source === 'MANUAL',
        ).length,
        tentativeDeadlines: deadlines.filter((deadline) =>
          deadline.source.includes(TENTATIVE_SOURCE_MARKER),
        ).length,
        approvedPolicyEvidence: policyEvidence.filter(
          (evidence) => evidence.status === 'APPROVED',
        ).length,
        byKind: countBy(orderedRows, (row) => row.kind),
        byAction: countBy(orderedRows, (row) => row.action),
        byGap: countBy(orderedRows, (row) => row.gap),
        bySeverity: countBy(orderedRows, (row) => row.severity),
      },
      nextCampaigns: rankCampaigns(orderedRows),
      rows: limitedRows,
    };

    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Deadline/policy closure worklist: ${args.out}`);
    console.log(
      `Rows: ${limitedRows.length}/${orderedRows.length}; deadlines=${deadlines.length}; policyEvidence=${policyEvidence.length}`,
    );
    for (const campaign of report.nextCampaigns.slice(0, 6)) {
      console.log(
        `- ${campaign.kind}/${campaign.action}/${campaign.gap}: count=${campaign.count} severity=${campaign.maxSeverity}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

function classifyDeadline(deadline: any, staleCutoff: number): WorklistRow[] {
  const rows: WorklistRow[] = [];
  const sourceUrl = extractSourceUrl(deadline.notes);
  if (deadline.source === 'MANUAL') {
    rows.push(
      deadlineRow(
        deadline,
        'deadline.manual_source',
        'missing-provenance',
        'source-evidence-review',
        'warning',
        {
          reason:
            'Manual deadline rows need explicit source evidence before timeline generation can be treated as closed.',
          sourceUrl,
        },
      ),
    );
  }
  if (deadline.source.includes(TENTATIVE_SOURCE_MARKER)) {
    rows.push(
      deadlineRow(
        deadline,
        'deadline.tentative_prior_year',
        'needs-review',
        'refresh-deadline',
        'warning',
        {
          sourceUrl,
          reason:
            'Tentative prior-year deadline must be refreshed or explicitly accepted for the current cycle.',
        },
      ),
    );
  }
  if (!sourceUrl && deadline.source !== 'SCRAPED') {
    rows.push(
      deadlineRow(
        deadline,
        'deadline.source_url_missing',
        'missing-provenance',
        'source-evidence-review',
        'warning',
        {
          source: deadline.source,
          websiteCandidate: normalizeUrl(deadline.school.website),
        },
      ),
    );
  }
  if (deadline.updatedAt.getTime() < staleCutoff) {
    rows.push(
      deadlineRow(
        deadline,
        'deadline.updated_at_stale',
        'stale',
        'refresh-deadline',
        'info',
        { updatedAt: deadline.updatedAt.toISOString() },
      ),
    );
  }
  if (deadline.financialAidDeadline) {
    const app = deadline.applicationDeadline.getTime();
    const aid = deadline.financialAidDeadline.getTime();
    if (aid < app - 365 * DAY_MS || aid > app + 365 * DAY_MS) {
      rows.push(
        deadlineRow(
          deadline,
          'deadline.financial_aid_date_outlier',
          'conflict',
          'review-deadline-conflict',
          'warning',
          {
            applicationDeadline: deadline.applicationDeadline.toISOString(),
            financialAidDeadline: deadline.financialAidDeadline.toISOString(),
          },
        ),
      );
    }
  }
  if (rows.length === 0) {
    rows.push(
      deadlineRow(
        deadline,
        'deadline.trusted_current',
        'trusted-usable',
        'trusted-closed',
        'info',
        { sourceUrl },
      ),
    );
  }
  return rows;
}

function classifyPolicyEvidence(
  evidence: any,
  args: Args,
  now: Date,
): WorklistRow[] {
  const rows: WorklistRow[] = [];
  if (['DRAFT', 'UNDER_REVIEW'].includes(evidence.status)) {
    rows.push(
      policyRow(
        evidence,
        'policy.review_pending',
        'needs-review',
        'review-policy-evidence',
        'warning',
        {},
      ),
    );
  }
  if (evidence.status === 'EXPIRED' || isExpired(evidence.expiresAt, now)) {
    rows.push(
      policyRow(
        evidence,
        'policy.expired',
        'stale',
        'refresh-policy-evidence',
        'warning',
        { expiresAt: evidence.expiresAt?.toISOString?.() ?? null },
      ),
    );
  }
  if (evidence.status === 'REJECTED') {
    rows.push(
      policyRow(
        evidence,
        'policy.rejected',
        'terminal',
        'terminal-accepted',
        'info',
        {},
      ),
    );
    return rows;
  }
  if (!evidence.sourceUrl) {
    rows.push(
      policyRow(
        evidence,
        'policy.source_url_missing',
        'missing-provenance',
        'policy-source-review',
        'warning',
        {
          sourceName: evidence.sourceName,
          websiteCandidate: normalizeUrl(evidence.school.website),
        },
      ),
    );
  }
  if (
    evidence.sourceQuality === null ||
    evidence.sourceQuality < args.policyQualityThreshold
  ) {
    rows.push(
      policyRow(
        evidence,
        'policy.source_quality_missing_or_low',
        'needs-review',
        'policy-quality-review',
        'warning',
        {
          sourceQuality: evidence.sourceQuality,
          policyQualityThreshold: args.policyQualityThreshold,
        },
      ),
    );
  }
  if (rows.length === 0) {
    rows.push(
      policyRow(
        evidence,
        'policy.trusted_approved',
        'trusted-usable',
        'trusted-closed',
        'info',
        {},
      ),
    );
  }
  return rows;
}

function deadlineRow(
  deadline: any,
  gap: string,
  bucket: Bucket,
  action: WorklistAction,
  severity: Severity,
  details: Record<string, unknown>,
): WorklistRow {
  return {
    id: deadline.id,
    kind: 'deadline',
    schoolId: deadline.schoolId,
    schoolName: deadline.school.name,
    usNewsRank: deadline.school.usNewsRank,
    gap,
    bucket,
    action,
    severity,
    route: `/admin/school-deadlines/${deadline.id}`,
    details: {
      ...details,
      year: deadline.year,
      round: deadline.round,
      applicationDeadline: deadline.applicationDeadline.toISOString(),
      financialAidDeadline:
        deadline.financialAidDeadline?.toISOString?.() ?? null,
      decisionDate: deadline.decisionDate?.toISOString?.() ?? null,
      source: deadline.source,
      notesSnippet: snippet(deadline.notes ?? ''),
    },
  };
}

function policyRow(
  evidence: any,
  gap: string,
  bucket: Bucket,
  action: WorklistAction,
  severity: Severity,
  details: Record<string, unknown>,
): WorklistRow {
  return {
    id: evidence.id,
    kind: 'policy_evidence',
    schoolId: evidence.schoolId,
    schoolName: evidence.school.name,
    usNewsRank: evidence.school.usNewsRank,
    gap,
    bucket,
    action,
    severity,
    route: `/admin/application-analysis-workflow/evidence/${evidence.id}`,
    details: {
      ...details,
      policyDimension: evidence.policyDimension,
      policyValue: evidence.policyValue,
      sourceName: evidence.sourceName,
      sourceUrl: evidence.sourceUrl,
      sourcePublishedAt: evidence.sourcePublishedAt?.toISOString?.() ?? null,
      status: evidence.status,
      reviewedAt: evidence.reviewedAt?.toISOString?.() ?? null,
      reviewedBy: evidence.reviewedBy,
      expiresAt: evidence.expiresAt?.toISOString?.() ?? null,
      notesSnippet: snippet(evidence.notes ?? ''),
    },
  };
}

function extractSourceUrl(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/https?:\/\/[^\s)\]]+/i);
  return match ? match[0] : null;
}

function normalizeUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isExpired(value: Date | null, now: Date): boolean {
  return Boolean(value && value.getTime() < now.getTime());
}

function snippet(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function countBy<T extends string>(
  rows: WorklistRow[],
  getKey: (row: WorklistRow) => T,
): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const row of rows) {
    const key = getKey(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function rankCampaigns(rows: WorklistRow[]) {
  const grouped = new Map<string, WorklistRow[]>();
  for (const row of rows) {
    const key = `${row.kind}:${row.action}:${row.gap}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return Array.from(grouped.entries())
    .map(([key, group]) => {
      const [kind, action, gap] = key.split(':');
      return {
        kind,
        action,
        gap,
        count: group.length,
        score: group.reduce(
          (sum, row) => sum + severityWeight(row.severity),
          0,
        ),
        maxSeverity: maxSeverity(group),
        sampleIds: group.slice(0, 5).map((row) => row.id),
      };
    })
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 12);
}

function compareRows(a: WorklistRow, b: WorklistRow): number {
  return (
    severityWeight(b.severity) - severityWeight(a.severity) ||
    a.kind.localeCompare(b.kind) ||
    a.schoolName.localeCompare(b.schoolName) ||
    a.gap.localeCompare(b.gap)
  );
}

function maxSeverity(rows: WorklistRow[]): Severity {
  if (rows.some((row) => row.severity === 'critical')) return 'critical';
  if (rows.some((row) => row.severity === 'warning')) return 'warning';
  return 'info';
}

function severityWeight(severity: Severity): number {
  if (severity === 'critical') return 5;
  if (severity === 'warning') return 3;
  return 1;
}

main().catch((error) => {
  try {
    writeBlockedReport(parseArgs(), error);
  } catch {
    console.error(error);
    process.exitCode = 1;
  }
});

function summarizePrismaAuditError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const compactMessage = compactPrismaAuditMessage(message);
  if (/Can't reach database server/i.test(message)) {
    return {
      kind: 'database_audit_availability',
      message: compactMessage,
      rawError: message,
    };
  }
  const missingColumn = message.match(
    /The column `([^`]+)` does not exist in the current database/i,
  );
  if (missingColumn) {
    return {
      kind: 'database_schema_compatibility',
      message: `Current database is missing column ${missingColumn[1]} required by the current Prisma schema`,
      rawError: message,
    };
  }
  return {
    kind: 'deadline_policy_worklist_error',
    message: compactMessage,
    rawError: message,
  };
}

function compactPrismaAuditMessage(message: string): string {
  const unavailable = message.match(/Can't reach database server at `[^`]+`/i);
  if (unavailable) return unavailable[0];
  const lines = message
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.at(-1) ?? message.trim() ?? message;
}

function writeBlockedReport(args: Args, error: unknown) {
  const blocker = summarizePrismaAuditError(error);
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'read-only',
    status: 'BLOCKED',
    applicationYear: args.applicationYear,
    staleDays: args.staleDays,
    policyQualityThreshold: args.policyQualityThreshold,
    limits: {
      requested: args.limit,
      emittedRows: 0,
      totalOpenRows: 0,
    },
    summary: {
      deadlines: 0,
      policyEvidence: 0,
      manualDeadlines: 0,
      tentativeDeadlines: 0,
      approvedPolicyEvidence: 0,
      byKind: {},
      byAction: {},
      byGap: {},
      bySeverity: {},
      blocker,
    },
    nextCampaigns: [
      {
        kind: blocker.kind,
        action: 'block-release',
        gap: blocker.kind,
        count: 1,
        score: severityWeight('critical'),
        maxSeverity: 'critical',
        sampleIds: [],
      },
    ],
    rows: [],
  };
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Deadline/policy closure worklist: ${args.out}`);
  console.log(`Status=BLOCKED; blocker=${blocker.message}`);
}
