#!/usr/bin/env tsx
import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

type Severity = 'critical' | 'warning' | 'info';
type Bucket =
  | 'trusted-usable'
  | 'missing-coverage'
  | 'missing-provenance'
  | 'conflict'
  | 'needs-review'
  | 'terminal';
type WorklistAction =
  | 'trusted-closed'
  | 'discover-media'
  | 'review-media-candidate'
  | 'source-evidence-review'
  | 'fix-primary-conflict'
  | 'retry-discovery'
  | 'terminal-accepted';

interface Args {
  out: string;
  limit: number;
  includeClosed: boolean;
  requireLicense: boolean;
}

interface WorklistRow {
  schoolId: string;
  schoolName: string;
  usNewsRank: number | null;
  assetId: string | null;
  gap: string;
  bucket: Bucket;
  action: WorklistAction;
  severity: Severity;
  route: string;
  details: Record<string, unknown>;
}

const API_ROOT = detectApiRoot();

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
  return {
    out: path.resolve(
      API_ROOT,
      get(
        '--out',
        path.join(
          API_ROOT,
          'scripts',
          'closure-reports',
          `school-media-worklist-${stamp}.json`,
        ),
      )!,
    ),
    limit: Number(get('--limit', '500')),
    includeClosed: argv.includes('--include-closed'),
    requireLicense: !argv.includes('--no-require-license'),
  };
}

async function main() {
  const args = parseArgs();
  const prisma = new PrismaClient();
  try {
    const schools = await prisma.school.findMany({
      where: {
        country: { in: ['US', 'United States', 'United States of America'] },
      },
      orderBy: [
        { usNewsRank: { sort: 'asc', nulls: 'last' } },
        { name: 'asc' },
      ],
      select: {
        id: true,
        name: true,
        usNewsRank: true,
        website: true,
        mediaAssets: {
          where: { type: 'CAMPUS_COVER' },
          orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
          select: {
            id: true,
            status: true,
            sourceType: true,
            storageUrl: true,
            originalUrl: true,
            sourcePageUrl: true,
            license: true,
            author: true,
            attribution: true,
            width: true,
            height: true,
            isPrimary: true,
            failureReason: true,
            reviewedBy: true,
            reviewedAt: true,
            updatedAt: true,
          },
        },
      },
    });

    const rows = schools.flatMap((school) => classifySchoolMedia(school, args));
    const orderedRows = rows
      .filter((row) => args.includeClosed || row.action !== 'trusted-closed')
      .sort(compareRows);
    const limitedRows = orderedRows.slice(0, args.limit);
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'read-only',
      requireLicense: args.requireLicense,
      limits: {
        requested: args.limit,
        emittedRows: limitedRows.length,
        totalOpenRows: orderedRows.length,
      },
      summary: {
        schools: schools.length,
        schoolsWithApprovedPrimary: schools.filter((school) =>
          school.mediaAssets.some(
            (asset) => asset.status === 'APPROVED' && asset.isPrimary,
          ),
        ).length,
        schoolsWithAnyCandidate: schools.filter((school) =>
          school.mediaAssets.some((asset) =>
            ['CANDIDATE', 'PENDING_REVIEW'].includes(asset.status),
          ),
        ).length,
        byAction: countBy(orderedRows, (row) => row.action),
        byGap: countBy(orderedRows, (row) => row.gap),
        bySeverity: countBy(orderedRows, (row) => row.severity),
      },
      nextCampaigns: rankCampaigns(orderedRows),
      rows: limitedRows,
    };

    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`School media closure worklist: ${args.out}`);
    console.log(
      `Rows: ${limitedRows.length}/${orderedRows.length}; schools=${schools.length}; approvedPrimary=${report.summary.schoolsWithApprovedPrimary}`,
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

function classifySchoolMedia(school: any, args: Args): WorklistRow[] {
  const rows: WorklistRow[] = [];
  const approvedPrimary = school.mediaAssets.filter(
    (asset: any) => asset.status === 'APPROVED' && asset.isPrimary,
  );
  const candidates = school.mediaAssets.filter((asset: any) =>
    ['CANDIDATE', 'PENDING_REVIEW'].includes(asset.status),
  );
  const failed = school.mediaAssets.filter(
    (asset: any) => asset.status === 'FAILED',
  );

  if (approvedPrimary.length === 0) {
    rows.push(
      schoolRow(
        school,
        null,
        'media.primary_missing',
        'missing-coverage',
        candidates.length ? 'review-media-candidate' : 'discover-media',
        'warning',
        {
          candidateCount: candidates.length,
          failedCount: failed.length,
          websiteCandidate: normalizeUrl(school.website),
        },
      ),
    );
  }
  if (approvedPrimary.length > 1) {
    rows.push(
      schoolRow(
        school,
        approvedPrimary[0],
        'media.multiple_primary',
        'conflict',
        'fix-primary-conflict',
        'warning',
        { primaryAssetIds: approvedPrimary.map((asset: any) => asset.id) },
      ),
    );
  }
  for (const asset of approvedPrimary) {
    if (!asset.storageUrl && !asset.originalUrl) {
      rows.push(
        schoolRow(
          school,
          asset,
          'media.url_missing',
          'missing-provenance',
          'source-evidence-review',
          'critical',
          {},
        ),
      );
    }
    if (!asset.sourcePageUrl && !asset.originalUrl) {
      rows.push(
        schoolRow(
          school,
          asset,
          'media.source_url_missing',
          'missing-provenance',
          'source-evidence-review',
          'warning',
          {},
        ),
      );
    }
    if (args.requireLicense && !asset.license && !asset.attribution) {
      rows.push(
        schoolRow(
          school,
          asset,
          'media.license_or_attribution_missing',
          'missing-provenance',
          'source-evidence-review',
          'warning',
          { sourceType: asset.sourceType },
        ),
      );
    }
    if (!asset.reviewedAt || !asset.reviewedBy) {
      rows.push(
        schoolRow(
          school,
          asset,
          'media.review_missing',
          'needs-review',
          'source-evidence-review',
          'info',
          {
            reviewedAt: asset.reviewedAt?.toISOString?.() ?? null,
            reviewedBy: asset.reviewedBy,
          },
        ),
      );
    }
  }
  for (const asset of candidates) {
    rows.push(
      schoolRow(
        school,
        asset,
        'media.candidate_pending_review',
        'needs-review',
        'review-media-candidate',
        'info',
        { sourceType: asset.sourceType },
      ),
    );
  }
  if (
    approvedPrimary.length === 0 &&
    candidates.length === 0 &&
    failed.length > 0
  ) {
    rows.push(
      schoolRow(
        school,
        failed[0],
        'media.discovery_failed',
        'terminal',
        'retry-discovery',
        'info',
        {
          failedCount: failed.length,
          failureReasons: failed
            .map((asset: any) => asset.failureReason)
            .filter(Boolean)
            .slice(0, 5),
        },
      ),
    );
  }
  if (rows.length === 0) {
    rows.push(
      schoolRow(
        school,
        approvedPrimary[0],
        'media.trusted_primary',
        'trusted-usable',
        'trusted-closed',
        'info',
        {},
      ),
    );
  }
  return rows;
}

function schoolRow(
  school: any,
  asset: any | null,
  gap: string,
  bucket: Bucket,
  action: WorklistAction,
  severity: Severity,
  details: Record<string, unknown>,
): WorklistRow {
  return {
    schoolId: school.id,
    schoolName: school.name,
    usNewsRank: school.usNewsRank,
    assetId: asset?.id ?? null,
    gap,
    bucket,
    action,
    severity,
    route: asset
      ? `/admin/schools/media-assets/${asset.id}`
      : `/admin/schools/${school.id}/media`,
    details: {
      ...details,
      sourceType: asset?.sourceType,
      status: asset?.status,
      storageUrl: asset?.storageUrl,
      originalUrl: asset?.originalUrl,
      sourcePageUrl: asset?.sourcePageUrl,
      license: asset?.license,
      author: asset?.author,
      attribution: asset?.attribution,
      width: asset?.width,
      height: asset?.height,
      isPrimary: asset?.isPrimary,
      failureReason: asset?.failureReason,
      updatedAt: asset?.updatedAt?.toISOString?.() ?? null,
    },
  };
}

function normalizeUrl(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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
        sampleSchoolIds: group.slice(0, 5).map((row) => row.schoolId),
      };
    })
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 12);
}

function compareRows(a: WorklistRow, b: WorklistRow): number {
  return (
    severityWeight(b.severity) - severityWeight(a.severity) ||
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
  console.error(error);
  process.exitCode = 1;
});
