/**
 * Diagnostic Ingest Service
 *
 * CSV → AdmissionCase (isVerified=true) 的纯 service 封装，供：
 *   - CLI: scripts/ingest-real-cases.ts
 *   - Admin API: POST /admin/predictions/diag/ingest-cases
 * 共同使用，避免逻辑重复。
 *
 * Workflow 上下文见 docs/PREDICTION_IMPROVEMENT_WORKFLOW.md
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { REAL_CASES_CSV_REQUIRED_COLUMNS } from '@study-abroad/shared';
import { SchoolMatcherService } from './benchmark/school-matcher.service';

/** CLI (tsx) may resolve stale shared dist; keep fallback in sync with REAL_CASES_CSV_REQUIRED_COLUMNS. */
const REQUIRED_COLS: readonly string[] =
  Array.isArray(REAL_CASES_CSV_REQUIRED_COLUMNS) &&
  REAL_CASES_CSV_REQUIRED_COLUMNS.length > 0
    ? REAL_CASES_CSV_REQUIRED_COLUMNS
    : (['schoolName', 'result', 'year', 'gpaRange'] as const);
import {
  normalizeResult as sharedNormalizeResult,
  normalizeRound as sharedNormalizeRound,
} from '../../common/utils/import-normalizers';
import type { HighSchoolType } from '@prisma/client';

// ============================================================
// Types
// ============================================================

export type IngestOptions = {
  csvContent: string;
  dryRun?: boolean;
  ownerUserEmail?: string;
};

export type SuggestedSchool = { id: string; name: string };

export type UnmatchedSchoolRow = {
  line: number;
  name: string;
  rowPreview: string;
  suggestedSchools: SuggestedSchool[];
};

export type AmbiguousSchoolRow = {
  line: number;
  inputName: string;
  rowPreview: string;
  candidates: SuggestedSchool[];
};

export type IngestSummary = {
  batchId: string;
  dryRun: boolean;
  totalRows: number;
  ingested: number;
  skippedDuplicate: number;
  skippedNoSchool: number;
  skippedAmbiguous: number;
  skippedBadRow: number;
  matchTypeCounts: Record<string, number>;
  perSchool: Record<string, number>;
  perResult: Record<string, number>;
  unmatchedSchools: UnmatchedSchoolRow[];
  ambiguousSchools: AmbiguousSchoolRow[];
  rowErrors: Array<{ line: number; error: string }>;
  warnings: string[];
  rollbackSql: string | null;
  header: string[];
};

type Row = Record<string, string>;

const HS_TYPE_ALIAS: Record<string, HighSchoolType> = {
  international: 'INTL_OTHER',
  intl: 'INTL_OTHER',
  intl_other: 'INTL_OTHER',
  intl_cn: 'INTL_CN',
  public: 'PUBLIC_US',
  public_us: 'PUBLIC_US',
  public_cn: 'PUBLIC_CN',
  public_other: 'PUBLIC_OTHER',
  private: 'PRIVATE_US',
  private_us: 'PRIVATE_US',
  private_cn: 'PRIVATE_CN',
  boarding: 'BOARDING_US',
  boarding_us: 'BOARDING_US',
};

// ============================================================
// CSV parser (RFC 4180-ish: 支持引号、引号内逗号、"" 转义)
// ============================================================

export function parseCsv(content: string): { header: string[]; rows: Row[] } {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        cur.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && content[i + 1] === '\n') i++;
        cur.push(field);
        field = '';
        if (cur.some((x) => x !== '')) rows.push(cur);
        cur = [];
      } else {
        field += c;
      }
    }
  }
  if (field !== '' || cur.length > 0) {
    cur.push(field);
    if (cur.some((x) => x !== '')) rows.push(cur);
  }

  if (rows.length === 0) return { header: [], rows: [] };
  const header = rows[0].map((h) => h.trim());
  const dataRows: Row[] = rows.slice(1).map((arr) => {
    const o: Row = {};
    header.forEach((h, i) => {
      o[h] = (arr[i] ?? '').trim();
    });
    return o;
  });
  return { header, rows: dataRows };
}

// ============================================================
// Helpers
// ============================================================

function parseIntOr(
  raw: string | undefined,
  fallback: number | null = null,
): number | null {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : n;
}

function parseBool(raw: string | undefined): boolean | null {
  if (raw === undefined || raw === '') return null;
  const v = raw.toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return null;
}

function normalizeHsType(raw: string | undefined): HighSchoolType | null {
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  const mapped = HS_TYPE_ALIAS[key];
  if (mapped) return mapped;
  const up = raw.toUpperCase();
  if (
    up in HS_TYPE_ALIAS ||
    Object.values(HS_TYPE_ALIAS).includes(up as HighSchoolType)
  ) {
    return up as HighSchoolType;
  }
  // 常见 enum 直接允许
  const KNOWN: HighSchoolType[] = [
    'PUBLIC_US',
    'PRIVATE_US',
    'BOARDING_US',
    'INTL_CN',
    'PUBLIC_CN',
    'PRIVATE_CN',
    'INTL_OTHER',
    'PUBLIC_OTHER',
  ];
  if (KNOWN.includes(up as HighSchoolType)) return up as HighSchoolType;
  return null;
}

function rowPreview(row: Row): string {
  return [row.schoolName, row.result, row.year, row.round, row.gpaRange]
    .filter(Boolean)
    .join(' | ')
    .slice(0, 120);
}

// ============================================================
// Service
// ============================================================

@Injectable()
export class DiagnosticIngestService {
  private readonly logger = new Logger(DiagnosticIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolMatcher: SchoolMatcherService,
  ) {}

  async ingestRealCases(opts: IngestOptions): Promise<IngestSummary> {
    const dryRun = opts.dryRun ?? false;
    const ownerEmail = opts.ownerUserEmail ?? 'import@system.local';

    const { header, rows } = parseCsv(opts.csvContent);

    const missing = REQUIRED_COLS.filter((c) => !header.includes(c));
    if (missing.length > 0) {
      throw new Error(
        `CSV 缺少必填列: ${missing.join(', ')} (模板: apps/api/data/real-cases-template.csv)`,
      );
    }

    const schoolIndex = await this.schoolMatcher.loadSchoolIndex();

    // Owner user (懒创建，只有 non-dry-run 才创建)
    let ownerUserId: string | null = null;
    if (!dryRun) {
      let owner = await this.prisma.user.findFirst({
        where: { email: ownerEmail },
      });
      if (!owner) {
        owner = await this.prisma.user.create({
          data: {
            email: ownerEmail,
            passwordHash: 'imported',
            role: 'USER',
          },
        });
        this.logger.log(`created ingest owner user ${owner.email}`);
      }
      ownerUserId = owner.id;
    }

    const batchId = `diag-ingest-${new Date().toISOString().replace(/[:.]/g, '-')}`;

    const summary: IngestSummary = {
      batchId,
      dryRun,
      totalRows: rows.length,
      ingested: 0,
      skippedDuplicate: 0,
      skippedNoSchool: 0,
      skippedAmbiguous: 0,
      skippedBadRow: 0,
      matchTypeCounts: {},
      perSchool: {},
      perResult: {},
      unmatchedSchools: [],
      ambiguousSchools: [],
      rowErrors: [],
      warnings: [],
      rollbackSql: null,
      header,
    };

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const lineNo = idx + 2;
      const schoolName = row.schoolName;
      const schoolId = row.schoolId || undefined;

      const result = sharedNormalizeResult(row.result);
      if (!result) {
        summary.skippedBadRow++;
        summary.rowErrors.push({
          line: lineNo,
          error: `invalid result "${row.result}"`,
        });
        continue;
      }
      const year = parseIntOr(row.year);
      if (!year) {
        summary.skippedBadRow++;
        summary.rowErrors.push({
          line: lineNo,
          error: `invalid year "${row.year}"`,
        });
        continue;
      }

      const resolved = this.schoolMatcher.matchSchool(
        { schoolName, schoolId },
        schoolIndex,
      );
      if (resolved.kind === 'ambiguous') {
        summary.skippedAmbiguous++;
        summary.ambiguousSchools.push({
          line: lineNo,
          inputName: schoolName || '(empty)',
          rowPreview: rowPreview(row),
          candidates: resolved.candidates,
        });
        continue;
      }
      if (resolved.kind === 'none') {
        summary.skippedNoSchool++;
        summary.unmatchedSchools.push({
          line: lineNo,
          name: schoolName || '(empty)',
          rowPreview: rowPreview(row),
          suggestedSchools: this.schoolMatcher.suggestSchools(
            schoolName,
            schoolIndex,
            5,
          ),
        });
        continue;
      }

      const matched = resolved;
      summary.matchTypeCounts[matched.matchType] =
        (summary.matchTypeCounts[matched.matchType] ?? 0) + 1;
      summary.perSchool[matched.school.name] =
        (summary.perSchool[matched.school.name] ?? 0) + 1;
      summary.perResult[result] = (summary.perResult[result] ?? 0) + 1;

      if (dryRun) {
        summary.ingested++;
        continue;
      }

      // dedup check
      const round = sharedNormalizeRound(row.round) || null;
      const dup = await this.prisma.admissionCase.findFirst({
        where: {
          userId: ownerUserId!,
          schoolId: matched.school.id,
          year,
          round: round ?? null,
        },
        select: { id: true },
      });
      if (dup) {
        summary.skippedDuplicate++;
        continue;
      }

      try {
        const tagList = (row.tags || '')
          .split(/[;,|]/)
          .map((t) => t.trim())
          .filter(Boolean);
        if (row.sourceTag) tagList.push(`source:${row.sourceTag}`);
        const isInternational = parseBool(row.isInternational);
        if (isInternational === true && !tagList.includes('international')) {
          tagList.push('international');
        }

        const evidenceUrl = row.evidenceUrl?.trim();
        if (evidenceUrl) {
          tagList.push(`evidence_url:${evidenceUrl.slice(0, 500)}`);
        }

        const activityCount = parseIntOr(row.activityCount);
        const awardCount = parseIntOr(row.awardCount);
        const activityList =
          [
            activityCount !== null
              ? `Activity count reported: ${activityCount}`
              : '',
            awardCount !== null ? `Award count reported: ${awardCount}` : '',
          ]
            .filter(Boolean)
            .join('\n') || null;

        const notes = row.notes?.trim();
        const narrativeParts: string[] = [];
        if (evidenceUrl) {
          narrativeParts.push(`Evidence URL: ${evidenceUrl}`);
        }
        if (notes) {
          narrativeParts.push(notes);
        }
        const narrative =
          narrativeParts.length > 0 ? narrativeParts.join('\n\n') : null;

        await this.prisma.admissionCase.create({
          data: {
            userId: ownerUserId!,
            schoolId: matched.school.id,
            year,
            round,
            result,
            major: row.major || null,
            gpaRange: row.gpaRange || null,
            satRange: row.satRange || null,
            actRange: row.actRange || null,
            toeflRange: row.toeflRange || null,
            activityList,
            tags: [...new Set(tagList)],
            highSchoolType: normalizeHsType(row.highSchoolType) ?? undefined,
            demographicTags: isInternational === true ? ['international'] : [],
            narrative,
            visibility: 'ANONYMOUS',
            source: `diag-ingest:${row.sourceTag || 'manual'}`,
            importBatchId: batchId,
            isVerified: true,
            verifiedAt: new Date(),
            reviewStatus: 'APPROVED',
            qualityScore: 80,
          },
        });
        summary.ingested++;
      } catch (e: unknown) {
        summary.skippedBadRow++;
        summary.rowErrors.push({
          line: lineNo,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // ==== Warnings (分布健康度) ====
    const ingestedTotal = summary.ingested + summary.skippedDuplicate;
    if (ingestedTotal > 0) {
      const admitted = summary.perResult.ADMITTED ?? 0;
      const rejected = summary.perResult.REJECTED ?? 0;
      const admitPct = (admitted / ingestedTotal) * 100;
      const rejectPct = (rejected / ingestedTotal) * 100;
      if (admitPct > 80) {
        summary.warnings.push(
          `ADMITTED 占比 ${admitPct.toFixed(0)}% 过高，ECE / bias 评估会失真。下次补数据请刻意加 REJECTED。`,
        );
      }
      if (rejectPct < 25 && ingestedTotal >= 10) {
        summary.warnings.push(
          `REJECTED 占比仅 ${rejectPct.toFixed(0)}% (< 25%)，评估结果不可信。`,
        );
      }
      const topSchool = Object.entries(summary.perSchool).sort(
        (a, b) => b[1] - a[1],
      )[0];
      if (topSchool && topSchool[1] > ingestedTotal * 0.4) {
        summary.warnings.push(
          `${topSchool[0]} 独占 ${((topSchool[1] / ingestedTotal) * 100).toFixed(0)}%，集中度过高，单校偏差会放大。`,
        );
      }
    }

    if (!dryRun && summary.ingested > 0) {
      summary.rollbackSql = `DELETE FROM admission_cases WHERE import_batch_id = '${batchId}';`;
    }

    if (summary.skippedAmbiguous > 0) {
      summary.warnings.push(
        `有 ${summary.skippedAmbiguous} 行学校名匹配到多所院校，已跳过。请在 CSV 中使用更完整的官方校名或填写 schoolId 列后重试。`,
      );
    }

    return summary;
  }
}
