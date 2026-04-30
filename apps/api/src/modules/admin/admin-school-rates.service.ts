import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeSchoolProvenance } from '@study-abroad/shared/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolWriteService } from '../school/school-write.service';
import {
  buildFieldProvenanceRecord,
  toRecord,
} from '../school/school-provenance.helpers';
import {
  BulkUpdateSchoolRatesDto,
  BulkUpdateSchoolRateRowDto,
} from './dto/bulk-update-school-rates.dto';

/**
 * AdminSchoolRatesService — bulk-update school admit rates from CDS / IPEDS / curated sources.
 *
 * Why this exists
 * ---------------
 * The counselor engine (PR-1 onward) and especially PR-8's selectivity-aware
 * intl multiplier need REAL per-school admit rates to produce accurate
 * predictions. The 4/26 evening discovery — UC intl admit rates are HIGHER
 * than overall (UCD 50.7% vs 41.8%, UCR 85% vs 76.8%) — proves heuristic
 * multipliers can't substitute for real published data.
 *
 * This service powers PR-13 (IPEDS importer for all 234 schools) and PR-14
 * (top-30 CDS PDF refinement). Single endpoint, idempotent, audit-logged.
 *
 * Behavior
 * --------
 * For each row in the payload:
 *   1. Locate school by `schoolId` (preferred) or `schoolNameNorm`
 *   2. Skip if school not found → reported in `notFound[]`
 *   3. Normalize rates: accept BOTH 0.418 AND 41.8 (auto-convert to percentage)
 *   4. Compute diff vs current values; skip if no actual change (idempotent)
 *   5. Write update via Prisma; write `AuditLog` row capturing who/what/source
 *
 * `dryRun: true` performs validation + diff calc but does not write.
 *
 * Rate convention
 * ---------------
 * Schema is `Decimal(5,2)` storing percentage (e.g. 41.80). PR-8 normalization
 * code handles BOTH conventions, so we store the percentage form for clarity.
 * Input < 1.0 → multiplied by 100 (interpreted as fraction).
 * Input >= 1.0 → stored as-is (interpreted as percentage).
 */

export interface BulkUpdateRowResult {
  schoolId: string;
  schoolName: string;
  changedFields: string[]; // empty when no diff (idempotent skip)
  before: Record<string, number | boolean | null>;
  after: Record<string, number | boolean>;
}

export interface BulkUpdateError {
  rowIndex: number;
  reason: string;
  payload: BulkUpdateSchoolRateRowDto;
}

export interface BulkUpdateSchoolRatesResult {
  dryRun: boolean;
  scanned: number;
  updated: number;
  skippedNoChange: number;
  notFound: Array<{
    rowIndex: number;
    schoolId?: string;
    schoolNameNorm?: string;
  }>;
  errors: BulkUpdateError[];
  changes: BulkUpdateRowResult[]; // includes skippedNoChange entries with empty changedFields
  durationMs: number;
}

const PERCENT_THRESHOLD = 1.0;
const RATE_FIELDS = [
  'acceptanceRate',
  'intlAcceptanceRate',
  'oosAcceptanceRate',
  'transferAcceptanceRate',
] as const;
const PERCENT_POINT_FIELDS = ['intlStudentPct'] as const;
const DECIMAL_PERCENT_FIELDS = [
  'graduationRate',
  'retentionRate',
  'percentNeedMet',
  'loanDefaultRate',
] as const;
const INTEGER_FIELDS = [
  'totalEnrollment',
  'studentCount',
  'tuition',
  'avgSalary',
  'studentFacultyRatio',
  'averageAidPackage',
  'averageNetPrice',
  'roomAndBoard',
  'applicationFee',
  'salary6YrPostGrad',
  'monthlyLoanPayment',
  'sat25',
  'satAvg',
  'sat75',
  'act25',
  'actAvg',
  'act75',
] as const;
const BOOLEAN_FIELDS = [
  'needBlindInternational',
  'testOptional',
  'feeWaiverAvailable',
  'acceptsCommonApp',
  'acceptsCoalition',
  'hasEarlyDecision',
] as const;

type RateField = (typeof RATE_FIELDS)[number];
type PercentPointField = (typeof PERCENT_POINT_FIELDS)[number];
type DecimalPercentField = (typeof DECIMAL_PERCENT_FIELDS)[number];
type IntegerField = (typeof INTEGER_FIELDS)[number];
type BooleanField = (typeof BOOLEAN_FIELDS)[number];

@Injectable()
export class AdminSchoolRatesService {
  private readonly logger = new Logger(AdminSchoolRatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolWrite: SchoolWriteService,
  ) {}

  /**
   * Coerce input rate (0.418 OR 41.8) into the Decimal(5,2) percentage form.
   * Returns null when input is null/undefined.
   */
  private normalizePercent(input: number | undefined | null): number | null {
    if (input == null || !Number.isFinite(input)) return null;
    if (input < 0) return null;
    return input < PERCENT_THRESHOLD ? input * 100 : input;
  }

  async runBulkUpdate(
    dto: BulkUpdateSchoolRatesDto,
    actorUserId: string,
  ): Promise<BulkUpdateSchoolRatesResult> {
    const startedAt = Date.now();
    const dryRun = dto.dryRun ?? false;
    const result: BulkUpdateSchoolRatesResult = {
      dryRun,
      scanned: dto.rows.length,
      updated: 0,
      skippedNoChange: 0,
      notFound: [],
      errors: [],
      changes: [],
      durationMs: 0,
    };

    // Pre-check: each row must have at least one rate field OR needBlindInternational
    for (let i = 0; i < dto.rows.length; i += 1) {
      const row = dto.rows[i];
      if (!row.schoolId && !row.schoolNameNorm) {
        result.errors.push({
          rowIndex: i,
          reason: 'must provide schoolId or schoolNameNorm',
          payload: row,
        });
        continue;
      }
      const hasAnyField =
        RATE_FIELDS.some((field) => row[field] != null) ||
        PERCENT_POINT_FIELDS.some((field) => row[field] != null) ||
        DECIMAL_PERCENT_FIELDS.some((field) => row[field] != null) ||
        INTEGER_FIELDS.some((field) => row[field] != null) ||
        BOOLEAN_FIELDS.some((field) => row[field] != null);
      if (!hasAnyField) {
        result.errors.push({
          rowIndex: i,
          reason: 'must provide at least one supported school data field',
          payload: row,
        });
      }
    }

    // Bulk fetch schools by id and by nameNorm to minimize round-trips
    const ids = dto.rows
      .filter((r) => r.schoolId)
      .map((r) => r.schoolId as string);
    const norms = dto.rows
      .filter((r) => !r.schoolId && r.schoolNameNorm)
      .map((r) => r.schoolNameNorm as string);

    const [byIdRows, byNormRows] = await Promise.all([
      ids.length
        ? this.prisma.school.findMany({
            where: { id: { in: ids } },
            select: this.schoolSelect(),
          })
        : Promise.resolve([]),
      norms.length
        ? this.prisma.school.findMany({
            where: { nameNorm: { in: norms } },
            select: this.schoolSelect(),
          })
        : Promise.resolve([]),
    ]);

    const byId = new Map(byIdRows.map((s) => [s.id, s]));
    const byNorm = new Map(byNormRows.map((s) => [s.nameNorm, s]));

    for (let i = 0; i < dto.rows.length; i += 1) {
      const row = dto.rows[i];
      // Skip rows already errored in pre-check
      if (result.errors.some((e) => e.rowIndex === i)) continue;

      const school =
        (row.schoolId && byId.get(row.schoolId)) ||
        (row.schoolNameNorm && byNorm.get(row.schoolNameNorm)) ||
        null;

      if (!school) {
        result.notFound.push({
          rowIndex: i,
          schoolId: row.schoolId,
          schoolNameNorm: row.schoolNameNorm,
        });
        continue;
      }

      // Build proposed update (only fields that are explicitly present)
      const updates: Prisma.SchoolUpdateInput = {};
      const before: BulkUpdateRowResult['before'] = {};
      const after: BulkUpdateRowResult['after'] = {};
      const changedFields: string[] = [];
      const provenance = normalizeSchoolProvenance(
        toRecord(toRecord(school.metadata).provenance),
      );
      const incomingIsHeuristic = row.source
        .toUpperCase()
        .includes('HEURISTIC');
      const shouldRefreshHeuristicProvenance = (key: string) => {
        if (incomingIsHeuristic) return false;
        const existing = provenance[key];
        return (
          existing?.tier === 'INFERRED' ||
          existing?.source?.toUpperCase().includes('HEURISTIC')
        );
      };

      const tryRateField = (key: RateField, rawInput: number | undefined) => {
        if (rawInput == null) return;
        const normalized = this.normalizePercent(rawInput);
        if (normalized == null) return;
        const currentDecimal = (school as any)[key] as Prisma.Decimal | null;
        const currentNum = currentDecimal ? currentDecimal.toNumber() : null;
        // Round to 2 dp for comparison (storage is Decimal(5,2))
        const roundedNew = Math.round(normalized * 100) / 100;
        if (currentNum != null && Math.abs(currentNum - roundedNew) < 0.005) {
          before[key] = currentNum;
          if (shouldRefreshHeuristicProvenance(key)) {
            after[key] = roundedNew;
            changedFields.push(key);
          }
          return;
        }
        updates[key] = new Prisma.Decimal(roundedNew);
        before[key] = currentNum;
        after[key] = roundedNew;
        changedFields.push(key);
      };

      const tryIntegerField = (
        key: IntegerField,
        rawInput: number | undefined,
      ) => {
        if (rawInput == null || !Number.isFinite(rawInput)) return;
        const currentNum = (school as any)[key] as number | null;
        const next = Math.round(rawInput);
        if (currentNum != null && currentNum === next) {
          before[key] = currentNum;
          if (shouldRefreshHeuristicProvenance(key)) {
            after[key] = next;
            changedFields.push(key);
          }
          return;
        }
        updates[key] = next;
        before[key] = currentNum ?? null;
        after[key] = next;
        changedFields.push(key);
      };

      const tryPercentPointField = (
        key: PercentPointField,
        rawInput: number | undefined,
      ) => {
        if (rawInput == null || !Number.isFinite(rawInput) || rawInput < 0)
          return;
        const currentDecimal = (school as any)[key] as Prisma.Decimal | null;
        const currentNum = currentDecimal ? currentDecimal.toNumber() : null;
        const roundedNew = Math.round(rawInput * 100) / 100;
        if (currentNum != null && Math.abs(currentNum - roundedNew) < 0.005) {
          before[key] = currentNum;
          if (shouldRefreshHeuristicProvenance(key)) {
            after[key] = roundedNew;
            changedFields.push(key);
          }
          return;
        }
        updates[key] = new Prisma.Decimal(roundedNew);
        before[key] = currentNum;
        after[key] = roundedNew;
        changedFields.push(key);
      };

      const tryDecimalPercentField = (
        key: DecimalPercentField,
        rawInput: number | undefined,
      ) => {
        if (rawInput == null) return;
        const normalized = this.normalizePercent(rawInput);
        if (normalized == null) return;
        const currentDecimal = (school as any)[key] as Prisma.Decimal | null;
        const currentNum = currentDecimal ? currentDecimal.toNumber() : null;
        const roundedNew = Math.round(normalized * 100) / 100;
        if (currentNum != null && Math.abs(currentNum - roundedNew) < 0.005) {
          before[key] = currentNum;
          if (shouldRefreshHeuristicProvenance(key)) {
            after[key] = roundedNew;
            changedFields.push(key);
          }
          return;
        }
        updates[key] = new Prisma.Decimal(roundedNew);
        before[key] = currentNum;
        after[key] = roundedNew;
        changedFields.push(key);
      };

      const tryBooleanField = (
        key: BooleanField,
        rawInput: boolean | undefined,
      ) => {
        if (rawInput == null) return;
        const currentValue = (school as any)[key] as boolean | null;
        if (currentValue === rawInput) {
          before[key] = currentValue;
          if (shouldRefreshHeuristicProvenance(key)) {
            after[key] = rawInput;
            changedFields.push(key);
          }
          return;
        }
        updates[key] = rawInput;
        before[key] = currentValue ?? null;
        after[key] = rawInput;
        changedFields.push(key);
      };

      for (const field of RATE_FIELDS) tryRateField(field, row[field]);
      for (const field of PERCENT_POINT_FIELDS)
        tryPercentPointField(field, row[field]);
      for (const field of DECIMAL_PERCENT_FIELDS)
        tryDecimalPercentField(field, row[field]);
      for (const field of INTEGER_FIELDS) tryIntegerField(field, row[field]);
      for (const field of BOOLEAN_FIELDS) tryBooleanField(field, row[field]);

      const rowResult: BulkUpdateRowResult = {
        schoolId: school.id,
        schoolName: school.name,
        changedFields,
        before,
        after,
      };
      result.changes.push(rowResult);

      if (changedFields.length === 0) {
        result.skippedNoChange += 1;
        continue;
      }

      if (dryRun) {
        result.updated += 1; // count what *would* be updated
        continue;
      }

      // Live: route school write through SchoolWriteService (governance:
      // school-write-must-have-provenance — ensures cache invalidation +
      // metadata + provenance pipeline). AuditLog written separately
      // (best-effort; if audit fails, school update still applied — admin
      // can reconstruct from update history).
      try {
        await this.schoolWrite.update(school.id, {
          fields: updates as Record<string, unknown>,
          provenance: buildFieldProvenanceRecord(changedFields, {
            source: row.source,
            sourceUrl: row.sourceUrl,
            cycleYear: row.cycleYear,
            verifiedBy: actorUserId,
            confidence: row.sourceConfidence,
            notes: row.sourceNotes,
          }),
        });
        try {
          await this.prisma.auditLog.create({
            data: {
              userId: actorUserId,
              action: 'SCHOOL_RATES_BULK_UPDATE',
              resource: 'school',
              resourceId: school.id,
              metadata: {
                source: row.source,
                sourceUrl: row.sourceUrl,
                cycleYear: row.cycleYear,
                sourceConfidence: row.sourceConfidence,
                sourceNotes: row.sourceNotes,
                changedFields,
                before,
                after,
              } as Prisma.InputJsonValue,
            },
          });
        } catch (auditErr) {
          this.logger.warn(
            `AuditLog write failed for school ${school.id}, update still applied: ${
              auditErr instanceof Error ? auditErr.message : String(auditErr)
            }`,
          );
        }
        result.updated += 1;
      } catch (err) {
        result.errors.push({
          rowIndex: i,
          reason: `schoolWrite.update failed: ${err instanceof Error ? err.message : String(err)}`,
          payload: row,
        });
      }
    }

    result.durationMs = Date.now() - startedAt;
    this.logger.log(
      `Bulk school-rates ${dryRun ? '(dry-run) ' : ''}` +
        `scanned=${result.scanned} updated=${result.updated} ` +
        `skippedNoChange=${result.skippedNoChange} ` +
        `notFound=${result.notFound.length} errors=${result.errors.length}`,
    );
    return result;
  }

  private schoolSelect() {
    return {
      id: true,
      name: true,
      nameNorm: true,
      acceptanceRate: true,
      intlAcceptanceRate: true,
      transferAcceptanceRate: true,
      intlStudentPct: true,
      totalEnrollment: true,
      studentCount: true,
      tuition: true,
      avgSalary: true,
      graduationRate: true,
      retentionRate: true,
      studentFacultyRatio: true,
      percentNeedMet: true,
      averageAidPackage: true,
      averageNetPrice: true,
      roomAndBoard: true,
      applicationFee: true,
      feeWaiverAvailable: true,
      acceptsCommonApp: true,
      acceptsCoalition: true,
      hasEarlyDecision: true,
      salary6YrPostGrad: true,
      loanDefaultRate: true,
      monthlyLoanPayment: true,
      needBlindInternational: true,
      oosAcceptanceRate: true,
      sat25: true,
      satAvg: true,
      sat75: true,
      act25: true,
      actAvg: true,
      act75: true,
      testOptional: true,
      metadata: true,
    } satisfies Prisma.SchoolSelect;
  }
}
