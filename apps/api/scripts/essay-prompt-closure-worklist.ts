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
  | 'needs-review'
  | 'terminal';
type WorklistAction =
  | 'trusted-closed'
  | 'terminal-accepted'
  | 'verify-prompt'
  | 'refresh-source'
  | 'scrape-configured-source'
  | 'source-search'
  | 'source-evidence-review'
  | 'raw-evidence-review'
  | 'confidence-review'
  | 'audit-log-review';

interface Args {
  out: string;
  limit: number;
  includeClosed: boolean;
  applicationYear: number;
  staleDays: number;
  confidenceThreshold: number;
}

interface WorklistRow {
  essayPromptId: string;
  schoolId: string;
  schoolName: string;
  usNewsRank: number | null;
  year: number;
  type: string;
  status: string;
  gap: string;
  bucket: Bucket;
  action: WorklistAction;
  severity: Severity;
  route: string;
  details: Record<string, unknown>;
}

const API_ROOT = detectApiRoot();
const DAY_MS = 24 * 60 * 60 * 1000;

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
          `essay-prompt-worklist-${stamp}.json`,
        ),
      )!,
    ),
    limit: Number(get('--limit', '500')),
    includeClosed: argv.includes('--include-closed'),
    applicationYear: Number(
      get('--application-year', `${resolveApplicationYear()}`),
    ),
    staleDays: Number(get('--stale-days', '365')),
    confidenceThreshold: Number(get('--confidence-threshold', '0.65')),
  };
}

async function main() {
  const args = parseArgs();
  const now = new Date();
  const staleCutoff = now.getTime() - args.staleDays * DAY_MS;
  const prisma = new PrismaClient();
  try {
    const [prompts, sourceConfigs, latestPipelineRun] = await Promise.all([
      prisma.essayPrompt.findMany({
        orderBy: [
          { year: 'desc' },
          { school: { usNewsRank: { sort: 'asc', nulls: 'last' } } },
          { school: { name: 'asc' } },
          { sortOrder: 'asc' },
        ],
        select: {
          id: true,
          schoolId: true,
          type: true,
          status: true,
          year: true,
          prompt: true,
          wordLimit: true,
          isRequired: true,
          changeType: true,
          verifiedAt: true,
          updatedAt: true,
          school: {
            select: {
              name: true,
              website: true,
              usNewsRank: true,
            },
          },
          sources: {
            select: {
              id: true,
              sourceType: true,
              sourceUrl: true,
              rawContent: true,
              confidence: true,
              scrapedAt: true,
              updatedAt: true,
            },
          },
          auditLogs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              action: true,
              operatorType: true,
              toStatus: true,
              reason: true,
              createdAt: true,
            },
          },
          essays: { select: { id: true } },
        },
      }),
      prisma.schoolEssaySource.findMany({
        where: { isActive: true },
        select: {
          schoolId: true,
          sourceType: true,
          url: true,
          scrapeGroup: true,
          priority: true,
          lastScrapedAt: true,
          lastStatus: true,
          lastError: true,
        },
      }),
      prisma.essayPipelineRun.findFirst({
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          year: true,
          status: true,
          totalSchools: true,
          successCount: true,
          failedCount: true,
          newPrompts: true,
          changedPrompts: true,
          startedAt: true,
          completedAt: true,
        },
      }),
    ]);

    const sourceConfigBySchool = new Map<string, typeof sourceConfigs>();
    for (const config of sourceConfigs) {
      const bucket = sourceConfigBySchool.get(config.schoolId) ?? [];
      bucket.push(config);
      sourceConfigBySchool.set(config.schoolId, bucket);
    }

    const rows = prompts.flatMap((prompt) =>
      classifyPrompt(prompt, sourceConfigBySchool, args, staleCutoff),
    );
    const orderedRows = rows
      .filter(
        (row) =>
          args.includeClosed ||
          !['trusted-closed', 'terminal-accepted'].includes(row.action),
      )
      .sort(compareRows);
    const limitedRows = orderedRows.slice(0, args.limit);
    const currentYearPrompts = prompts.filter(
      (prompt) => prompt.year === args.applicationYear,
    );
    const report = {
      generatedAt: now.toISOString(),
      mode: 'read-only',
      applicationYear: args.applicationYear,
      staleDays: args.staleDays,
      confidenceThreshold: args.confidenceThreshold,
      limits: {
        requested: args.limit,
        emittedRows: limitedRows.length,
        totalOpenRows: orderedRows.length,
      },
      summary: {
        prompts: prompts.length,
        currentYearPrompts: currentYearPrompts.length,
        verifiedCurrentYearPrompts: currentYearPrompts.filter(
          (prompt) => prompt.status === 'VERIFIED',
        ).length,
        promptsWithoutSources: prompts.filter(
          (prompt) => prompt.sources.length === 0,
        ).length,
        activeSchoolEssaySources: sourceConfigs.length,
        latestPipelineRun,
        byAction: countBy(orderedRows, (row) => row.action),
        byGap: countBy(orderedRows, (row) => row.gap),
        byStatus: countBy(orderedRows, (row) => row.status),
        bySeverity: countBy(orderedRows, (row) => row.severity),
      },
      nextCampaigns: rankCampaigns(orderedRows),
      rows: limitedRows,
    };

    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Essay prompt closure worklist: ${args.out}`);
    console.log(
      `Rows: ${limitedRows.length}/${orderedRows.length}; prompts=${prompts.length}; currentYear=${currentYearPrompts.length}`,
    );
    for (const campaign of report.nextCampaigns.slice(0, 6)) {
      console.log(
        `- ${campaign.action}/${campaign.gap}: count=${campaign.count} severity=${campaign.maxSeverity}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

function classifyPrompt(
  prompt: any,
  sourceConfigBySchool: Map<string, any[]>,
  args: Args,
  staleCutoff: number,
): WorklistRow[] {
  const rows: WorklistRow[] = [];
  const isCurrentYear = prompt.year === args.applicationYear;
  const sourceConfigs = sourceConfigBySchool.get(prompt.schoolId) ?? [];
  const sourceUrls = prompt.sources
    .map((source: { sourceUrl: string | null }) => source.sourceUrl)
    .filter(Boolean);
  const hasSourceRows = prompt.sources.length > 0;
  const hasSourceUrl = sourceUrls.length > 0;
  const hasRawContent = prompt.sources.some(
    (source: { rawContent: string | null }) =>
      typeof source.rawContent === 'string' &&
      source.rawContent.trim().length > 0,
  );
  const lowestConfidence = prompt.sources.reduce(
    (min: number | null, source: { confidence: number | null }) => {
      if (typeof source.confidence !== 'number') return min;
      return min === null
        ? source.confidence
        : Math.min(min, source.confidence);
    },
    null,
  );
  const unknownConfidence = prompt.sources.some(
    (source: { confidence: number | null }) => source.confidence === null,
  );
  const staleSources = prompt.sources.filter((source: any) => {
    const lastSeen = source.scrapedAt ?? source.updatedAt;
    return lastSeen && lastSeen.getTime() < staleCutoff;
  });

  if (prompt.status === 'REJECTED') {
    rows.push(
      row(prompt, 'prompt.rejected', 'terminal', 'terminal-accepted', 'info', {
        latestAudit: prompt.auditLogs[0] ?? null,
      }),
    );
    return rows;
  }

  if (prompt.status !== 'VERIFIED') {
    rows.push(
      row(
        prompt,
        'prompt.pending_verification',
        'needs-review',
        'verify-prompt',
        isCurrentYear ? 'critical' : 'warning',
        {
          latestAudit: prompt.auditLogs[0] ?? null,
        },
      ),
    );
  }
  if (!hasSourceRows) {
    rows.push(
      row(
        prompt,
        'source.rows_missing',
        'missing-provenance',
        sourceConfigs.length ? 'scrape-configured-source' : 'source-search',
        isCurrentYear ? 'critical' : 'warning',
        {
          configuredSources: sourceConfigs.map((config) => ({
            sourceType: config.sourceType,
            url: config.url,
            scrapeGroup: config.scrapeGroup,
            lastScrapedAt: config.lastScrapedAt?.toISOString?.() ?? null,
            lastStatus: config.lastStatus,
            lastError: config.lastError,
          })),
          sourceCandidates: buildSourceCandidates(
            prompt.school.website,
            prompt.school.name,
          ),
        },
      ),
    );
  } else {
    if (!hasSourceUrl) {
      rows.push(
        row(
          prompt,
          'source.url_missing',
          'missing-provenance',
          'source-evidence-review',
          isCurrentYear ? 'critical' : 'warning',
          {
            sourceCount: prompt.sources.length,
          },
        ),
      );
    }
    if (!hasRawContent) {
      rows.push(
        row(
          prompt,
          'source.raw_content_missing',
          'missing-provenance',
          'raw-evidence-review',
          'info',
          {
            sourceUrls,
          },
        ),
      );
    }
    if (
      unknownConfidence ||
      (lowestConfidence !== null && lowestConfidence < args.confidenceThreshold)
    ) {
      rows.push(
        row(
          prompt,
          'source.confidence_missing_or_low',
          'needs-review',
          'confidence-review',
          isCurrentYear ? 'warning' : 'info',
          {
            lowestConfidence,
            unknownConfidence,
            confidenceThreshold: args.confidenceThreshold,
          },
        ),
      );
    }
    if (staleSources.length > 0 || !isCurrentYear) {
      rows.push(
        row(
          prompt,
          isCurrentYear ? 'source.stale' : 'prompt.not_current_year',
          'stale',
          'refresh-source',
          isCurrentYear ? 'warning' : 'info',
          {
            staleSourceCount: staleSources.length,
            sourceUrls,
            year: prompt.year,
            applicationYear: args.applicationYear,
          },
        ),
      );
    }
  }
  if (prompt.auditLogs.length === 0) {
    rows.push(
      row(
        prompt,
        'audit.log_missing',
        'needs-review',
        'audit-log-review',
        'info',
        {},
      ),
    );
  }

  if (rows.length === 0) {
    rows.push(
      row(
        prompt,
        'prompt.trusted_current_verified',
        'trusted-usable',
        'trusted-closed',
        'info',
        {
          sourceUrls,
        },
      ),
    );
  }
  return rows;
}

function row(
  prompt: any,
  gap: string,
  bucket: Bucket,
  action: WorklistAction,
  severity: Severity,
  details: Record<string, unknown>,
): WorklistRow {
  return {
    essayPromptId: prompt.id,
    schoolId: prompt.schoolId,
    schoolName: prompt.school.name,
    usNewsRank: prompt.school.usNewsRank,
    year: prompt.year,
    type: prompt.type,
    status: prompt.status,
    gap,
    bucket,
    action,
    severity,
    route: `/admin/essay-prompts/${prompt.id}`,
    details: {
      ...details,
      promptSnippet: snippet(prompt.prompt),
      wordLimit: prompt.wordLimit,
      isRequired: prompt.isRequired,
      changeType: prompt.changeType,
      verifiedAt: prompt.verifiedAt?.toISOString?.() ?? null,
      linkedEssayCount: prompt.essays.length,
      sourceCount: prompt.sources.length,
    },
  };
}

function snippet(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function buildSourceCandidates(
  website: string | null,
  schoolName: string,
): Array<{ sourceType: string; url: string; reason: string }> {
  const candidates: Array<{ sourceType: string; url: string; reason: string }> =
    [];
  const normalizedWebsite = normalizeUrl(website);
  if (normalizedWebsite) {
    const origin = originFor(normalizedWebsite);
    candidates.push({
      sourceType: 'OFFICIAL',
      url: normalizedWebsite,
      reason: 'School website from School.website',
    });
    if (origin) {
      for (const suffix of [
        '/admissions',
        '/admission',
        '/apply',
        '/undergraduate-admission',
        '/undergraduate-admissions',
        '/first-year-applicants',
      ]) {
        candidates.push({
          sourceType: 'OFFICIAL_CANDIDATE',
          url: `${origin}${suffix}`,
          reason:
            'Heuristic admissions path to inspect before writing source rows',
        });
      }
    }
  }
  candidates.push({
    sourceType: 'COMMON_APP_CANDIDATE',
    url: `https://www.commonapp.org/explore/search?search=${encodeURIComponent(schoolName)}`,
    reason:
      'Common App search candidate; verify manually before treating as source evidence',
  });
  return dedupeCandidates(candidates).slice(0, 8);
}

function normalizeUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function originFor(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function dedupeCandidates(
  candidates: Array<{ sourceType: string; url: string; reason: string }>,
) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  });
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
    const key = `${row.action}:${row.gap}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return Array.from(grouped.entries())
    .map(([key, group]) => {
      const [action, gap] = key.split(':');
      return {
        action,
        gap,
        count: group.length,
        score: group.reduce(
          (sum, row) => sum + severityWeight(row.severity),
          0,
        ),
        maxSeverity: maxSeverity(group),
        samplePromptIds: group.slice(0, 5).map((row) => row.essayPromptId),
      };
    })
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 12);
}

function compareRows(a: WorklistRow, b: WorklistRow): number {
  return (
    severityWeight(b.severity) - severityWeight(a.severity) ||
    a.schoolName.localeCompare(b.schoolName) ||
    b.year - a.year ||
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
    kind: 'essay_prompt_worklist_error',
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
    confidenceThreshold: args.confidenceThreshold,
    limits: {
      requested: args.limit,
      emittedRows: 0,
      totalOpenRows: 0,
    },
    summary: {
      prompts: 0,
      currentYearPrompts: 0,
      verifiedCurrentYearPrompts: 0,
      promptsWithoutSources: 0,
      activeSchoolEssaySources: 0,
      latestPipelineRun: null,
      byAction: {},
      byGap: {},
      byStatus: {},
      bySeverity: {},
      blocker,
    },
    nextCampaigns: [
      {
        action: 'block-release',
        gap: blocker.kind,
        count: 1,
        score: severityWeight('critical'),
        maxSeverity: 'critical',
        samplePromptIds: [],
      },
    ],
    rows: [],
  };
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Essay prompt closure worklist: ${args.out}`);
  console.log(`Status=BLOCKED; blocker=${blocker.message}`);
}
