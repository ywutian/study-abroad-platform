import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  normalizeSchoolProvenance,
  toSchoolFieldSource,
} from '@study-abroad/shared/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { UrbanInstituteDataService } from '../school/urban-institute-data.service';
import { SchoolWriteService } from '../school/school-write.service';
import {
  buildFieldProvenanceRecord,
  buildNormalizedSchoolProvenance,
  toRecord,
} from '../school/school-provenance.helpers';
import { AdminSchoolRatesService } from './admin-school-rates.service';
import type {
  CdsDiscoverDto,
  CdsExtractDto,
  HeuristicFillDto,
  ImportIpedsCsvDto,
  SyncIpedsAdmissionsDto,
} from './dto/school-data-pipeline.dto';

const US_COUNTRIES = ['US', 'United States', 'United States of America'];
const CRITICAL_FIELDS = [
  'acceptanceRate',
  'intlAcceptanceRate',
  'sat25',
  'sat75',
  'testOptional',
  'needBlindInternational',
] as const;
const OPTIONAL_FIELDS = [
  'oosAcceptanceRate',
  'satAvg',
  'act25',
  'actAvg',
  'act75',
] as const;
const HEURISTIC_SOURCE = 'HEURISTIC:PR-15';

type CoverageField =
  | (typeof CRITICAL_FIELDS)[number]
  | (typeof OPTIONAL_FIELDS)[number];

interface SchoolForCoverage {
  id: string;
  name: string;
  nameZh: string | null;
  country: string;
  state: string | null;
  isPrivate: boolean;
  usNewsRank: number | null;
  acceptanceRate: Prisma.Decimal | null;
  intlAcceptanceRate: Prisma.Decimal | null;
  oosAcceptanceRate?: Prisma.Decimal | null;
  sat25: number | null;
  satAvg: number | null;
  sat75: number | null;
  act25: number | null;
  actAvg: number | null;
  act75: number | null;
  testOptional: boolean | null;
  testingPolicy: string;
  needBlindInternational: boolean;
  metadata: unknown;
  updatedAt: Date;
  scorecardId: string | null;
  ipedsId: string | null;
}

@Injectable()
export class AdminSchoolDataCoverageService {
  private readonly logger = new Logger(AdminSchoolDataCoverageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly schoolWrite: SchoolWriteService,
    private readonly urbanInstitute: UrbanInstituteDataService,
    private readonly schoolRates: AdminSchoolRatesService,
  ) {}

  async getCoverage(options?: { includeAllCountries?: boolean }) {
    const schools = await this.findCoverageSchools(options);
    const generatedAt = new Date().toISOString();
    const fieldTotals = this.emptyFieldTotals();
    const sourceCounts: Record<string, number> = {};
    const tierCounts: Record<string, number> = {};

    const items = schools.map((school) => {
      const provenance = buildNormalizedSchoolProvenance(school as any);
      const fields = [...CRITICAL_FIELDS, ...OPTIONAL_FIELDS].map((field) => {
        const status = this.buildFieldStatus(school, field, provenance);
        const total = fieldTotals[field];
        total.total += 1;
        if (status.filled) total.filled += 1;
        if (status.predictionEligible) total.predictionEligible += 1;
        if (status.isHeuristic) total.heuristic += 1;
        if (status.staleness === 'STALE') total.stale += 1;
        if (status.source)
          sourceCounts[status.source] = (sourceCounts[status.source] ?? 0) + 1;
        if (status.tier)
          tierCounts[status.tier] = (tierCounts[status.tier] ?? 0) + 1;
        return status;
      });

      const critical = fields.filter((f) =>
        (CRITICAL_FIELDS as readonly string[]).includes(f.field),
      );
      const missingCritical = critical
        .filter((field) => !field.filled)
        .map((field) => field.field);
      const heuristicCritical = critical
        .filter((field) => field.isHeuristic)
        .map((field) => field.field);

      return {
        schoolId: school.id,
        schoolName: school.name,
        schoolNameZh: school.nameZh,
        country: school.country,
        state: school.state,
        usNewsRank: school.usNewsRank,
        scorecardId: school.scorecardId,
        ipedsId: school.ipedsId,
        criticalComplete: missingCritical.length === 0,
        missingCritical,
        heuristicCritical,
        fields,
      };
    });

    for (const total of Object.values(fieldTotals)) {
      total.percent =
        total.total > 0
          ? Math.round((total.filled / total.total) * 1000) / 10
          : 0;
      total.predictionEligiblePercent =
        total.total > 0
          ? Math.round((total.predictionEligible / total.total) * 1000) / 10
          : 0;
    }

    return {
      generatedAt,
      scope: options?.includeAllCountries ? 'all-schools' : 'us-freshman',
      criticalFields: CRITICAL_FIELDS,
      optionalFields: OPTIONAL_FIELDS,
      totals: {
        schools: schools.length,
        criticalComplete: items.filter((item) => item.criticalComplete).length,
        missingAnyCritical: items.filter((item) => !item.criticalComplete)
          .length,
        heuristicOnlySchools: items.filter(
          (item) => item.heuristicCritical.length > 0,
        ).length,
      },
      fieldTotals,
      sourceCounts,
      tierCounts,
      items,
    };
  }

  async heuristicFill(dto: HeuristicFillDto, actorUserId: string) {
    const dryRun = dto.dryRun ?? true;
    const limit = dto.limit ?? 500;
    const schools = await this.findCoverageSchools({
      includeAllCountries: false,
      limit,
    });
    const result = {
      dryRun,
      scanned: schools.length,
      updated: 0,
      skippedNoAnchor: 0,
      skippedNoChange: 0,
      changes: [] as Array<{
        schoolId: string;
        schoolName: string;
        changedFields: string[];
        after: Record<string, number | boolean>;
      }>,
      errors: [] as Array<{ schoolId: string; reason: string }>,
    };

    for (const school of schools) {
      const provenance = normalizeSchoolProvenance(
        toRecord(school.metadata).provenance,
      );
      const updates: Record<string, number | boolean> = {};
      const changedFields: string[] = [];

      const overall = this.toPercent(school.acceptanceRate);
      if (overall == null) {
        result.skippedNoAnchor += 1;
        continue;
      }

      const canFill = (field: string, current: unknown) => {
        if (current == null) return true;
        if (!dto.forceHeuristic) return false;
        const existing = provenance[field];
        return (
          existing?.tier === 'INFERRED' ||
          existing?.source?.includes('HEURISTIC')
        );
      };

      if (canFill('intlAcceptanceRate', school.intlAcceptanceRate)) {
        updates.intlAcceptanceRate = this.deriveIntlRate(
          overall,
          school.needBlindInternational,
        );
        changedFields.push('intlAcceptanceRate');
      }
      if (canFill('sat25', school.sat25) || canFill('sat75', school.sat75)) {
        const sat = this.deriveSatBand(overall);
        if (canFill('sat25', school.sat25)) {
          updates.sat25 = sat.sat25;
          changedFields.push('sat25');
        }
        if (canFill('satAvg', school.satAvg)) {
          updates.satAvg = sat.satAvg;
          changedFields.push('satAvg');
        }
        if (canFill('sat75', school.sat75)) {
          updates.sat75 = sat.sat75;
          changedFields.push('sat75');
        }
      }
      if (canFill('act25', school.act25) || canFill('act75', school.act75)) {
        const act = this.deriveActBand(overall);
        if (canFill('act25', school.act25)) {
          updates.act25 = act.act25;
          changedFields.push('act25');
        }
        if (canFill('actAvg', school.actAvg)) {
          updates.actAvg = act.actAvg;
          changedFields.push('actAvg');
        }
        if (canFill('act75', school.act75)) {
          updates.act75 = act.act75;
          changedFields.push('act75');
        }
      }

      if (changedFields.length === 0) {
        result.skippedNoChange += 1;
        continue;
      }

      result.changes.push({
        schoolId: school.id,
        schoolName: school.name,
        changedFields,
        after: updates,
      });

      if (dryRun) {
        result.updated += 1;
        continue;
      }

      try {
        await this.schoolWrite.update(school.id, {
          fields: updates,
          provenance: buildFieldProvenanceRecord(changedFields, {
            source: HEURISTIC_SOURCE,
            verifiedBy: actorUserId,
            confidence: 0.55,
            notes:
              'PR-15 heuristic fallback after official/public sources were unavailable. Replace with Scorecard/IPEDS/CDS/manual data when available.',
          }),
        });
        result.updated += 1;
      } catch (err) {
        result.errors.push({
          schoolId: school.id,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  }

  async syncIpedsAdmissions(dto: SyncIpedsAdmissionsDto, actorUserId: string) {
    const year = dto.year ?? new Date().getFullYear() - 1;
    const limit = dto.limit ?? 500;
    const result = await this.urbanInstitute.syncAdmissions(year, limit);
    await this.prisma.auditLog.create({
      data: {
        userId: actorUserId,
        action: 'SCHOOL_DATA_IPEDS_ADMISSIONS_SYNC',
        resource: 'school',
        resourceId: '',
        metadata: { year, limit, result } as unknown as Prisma.InputJsonValue,
      },
    });
    return result;
  }

  async importIpedsCsvRows(dto: ImportIpedsCsvDto, actorUserId: string) {
    const unitids = dto.rows.map((row) => row.unitid);
    const schools = await this.prisma.school.findMany({
      where: { ipedsId: { in: unitids } },
      select: { id: true, ipedsId: true },
    });
    const byUnitid = new Map(
      schools.map((school) => [school.ipedsId, school.id]),
    );
    const notFound: Array<{ rowIndex: number; unitid: string }> = [];
    const rows = dto.rows.flatMap((row, rowIndex) => {
      const schoolId = byUnitid.get(row.unitid);
      if (!schoolId) {
        notFound.push({ rowIndex, unitid: row.unitid });
        return [];
      }
      return [
        {
          ...row,
          schoolId,
          source: `IPEDS_CSV:${dto.cycleYear ?? new Date().getFullYear()}:unitid-${row.unitid}`,
          cycleYear: dto.cycleYear,
          sourceConfidence: 0.95,
          sourceNotes: 'IPEDS CSV import via PR-15 all-schools data pipeline.',
        },
      ];
    });
    const bulkResult = await this.schoolRates.runBulkUpdate(
      {
        dryRun: dto.dryRun ?? true,
        rows,
      },
      actorUserId,
    );
    return {
      ...bulkResult,
      scannedIpedsRows: dto.rows.length,
      ipedsNotFound: notFound,
    };
  }

  async discoverCdsCandidates(dto: CdsDiscoverDto) {
    const missingField = dto.missingField ?? 'intlAcceptanceRate';
    const coverage = await this.getCoverage();
    const candidates = coverage.items
      .filter((item) =>
        item.fields.some(
          (field) => field.field === missingField && !field.filled,
        ),
      )
      .slice(0, dto.limit ?? 50)
      .map((item) => ({
        schoolId: item.schoolId,
        schoolName: item.schoolName,
        schoolNameZh: item.schoolNameZh,
        usNewsRank: item.usNewsRank,
        missingField,
        query: `site:edu "Common Data Set" "2024-25" "${item.schoolName}" filetype:pdf`,
      }));

    return {
      generatedAt: new Date().toISOString(),
      missingField,
      candidates,
      note: 'Discovery endpoint returns official-search queries for ops/automation. When a PDF is verified, submit extracted rows to /admin/schools/cds/extract.',
    };
  }

  async extractCdsRows(dto: CdsExtractDto, actorUserId: string) {
    return this.schoolRates.runBulkUpdate(
      {
        dryRun: dto.dryRun ?? true,
        rows: dto.rows.map((row) => ({
          ...row,
          source:
            row.source ||
            `CDS_PDF_MANUAL:${row.cycleYear ?? new Date().getFullYear()}`,
          sourceConfidence: row.sourceConfidence ?? 0.98,
          sourceNotes:
            row.sourceNotes ??
            'CDS PDF extraction reviewed through PR-15 school-data pipeline.',
        })),
      },
      actorUserId,
    );
  }

  private async findCoverageSchools(options?: {
    includeAllCountries?: boolean;
    limit?: number;
  }): Promise<SchoolForCoverage[]> {
    return this.prisma.school.findMany({
      where: options?.includeAllCountries
        ? undefined
        : { country: { in: US_COUNTRIES } },
      select: {
        id: true,
        name: true,
        nameZh: true,
        country: true,
        state: true,
        isPrivate: true,
        usNewsRank: true,
        acceptanceRate: true,
        intlAcceptanceRate: true,
        oosAcceptanceRate: true,
        sat25: true,
        satAvg: true,
        sat75: true,
        act25: true,
        actAvg: true,
        act75: true,
        testOptional: true,
        testingPolicy: true,
        needBlindInternational: true,
        metadata: true,
        updatedAt: true,
        scorecardId: true,
        ipedsId: true,
      },
      orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
      take: options?.limit,
    }) as Promise<SchoolForCoverage[]>;
  }

  private buildFieldStatus(
    school: SchoolForCoverage,
    field: CoverageField,
    provenance: ReturnType<typeof buildNormalizedSchoolProvenance>,
  ) {
    const rawValue = this.fieldValue(school, field);
    const explicitUnknown =
      field === 'testOptional' &&
      rawValue == null &&
      school.testingPolicy === 'UNKNOWN';
    const filled = rawValue != null || explicitUnknown;
    const source = provenance[field]
      ? toSchoolFieldSource(provenance[field])
      : null;
    const isHeuristic =
      source?.tier === 'INFERRED' ||
      Boolean(source?.source?.toUpperCase().includes('HEURISTIC'));
    return {
      field,
      value: rawValue,
      filled,
      explicitUnknown,
      source: source?.source ?? null,
      tier: source?.tier ?? null,
      confidence: source?.confidence ?? null,
      fetchedAt: source?.fetchedAt ?? null,
      sourceUrl: source?.sourceUrl ?? null,
      cycleYear: source?.cycleYear ?? null,
      notes: source?.notes ?? null,
      staleness: source?.staleness ?? null,
      predictionEligible: (source?.predictionEligible ?? false) || isHeuristic,
      isHeuristic,
    };
  }

  private fieldValue(school: SchoolForCoverage, field: CoverageField) {
    if (field === 'testOptional') {
      return (
        school.testOptional ??
        (school.testingPolicy !== 'UNKNOWN' ? school.testingPolicy : null)
      );
    }
    const value = (school as any)[field];
    if (value instanceof Prisma.Decimal) return value.toNumber();
    return value ?? null;
  }

  private emptyFieldTotals() {
    const totals = {} as Record<
      CoverageField,
      {
        total: number;
        filled: number;
        percent: number;
        predictionEligible: number;
        predictionEligiblePercent: number;
        heuristic: number;
        stale: number;
      }
    >;
    for (const field of [...CRITICAL_FIELDS, ...OPTIONAL_FIELDS]) {
      totals[field] = {
        total: 0,
        filled: 0,
        percent: 0,
        predictionEligible: 0,
        predictionEligiblePercent: 0,
        heuristic: 0,
        stale: 0,
      };
    }
    return totals;
  }

  private toPercent(
    value: Prisma.Decimal | number | null | undefined,
  ): number | null {
    if (value == null) return null;
    const n =
      value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n > 1 ? n : n * 100;
  }

  private deriveIntlRate(overallPercent: number, needBlind: boolean): number {
    const multiplier =
      overallPercent >= 40
        ? 0.95
        : overallPercent >= 20
          ? needBlind
            ? 0.85
            : 0.7
          : needBlind
            ? 0.7
            : 0.4;
    return Math.max(
      0.1,
      Math.min(98, Math.round(overallPercent * multiplier * 100) / 100),
    );
  }

  private deriveSatBand(overallPercent: number) {
    if (overallPercent <= 5) return { sat25: 1510, satAvg: 1560, sat75: 1590 };
    if (overallPercent <= 10) return { sat25: 1460, satAvg: 1530, sat75: 1570 };
    if (overallPercent <= 20) return { sat25: 1380, satAvg: 1480, sat75: 1540 };
    if (overallPercent <= 40) return { sat25: 1250, satAvg: 1360, sat75: 1450 };
    if (overallPercent <= 70) return { sat25: 1080, satAvg: 1200, sat75: 1320 };
    return { sat25: 950, satAvg: 1080, sat75: 1200 };
  }

  private deriveActBand(overallPercent: number) {
    if (overallPercent <= 5) return { act25: 34, actAvg: 35, act75: 36 };
    if (overallPercent <= 10) return { act25: 33, actAvg: 34, act75: 35 };
    if (overallPercent <= 20) return { act25: 30, actAvg: 33, act75: 35 };
    if (overallPercent <= 40) return { act25: 27, actAvg: 30, act75: 33 };
    if (overallPercent <= 70) return { act25: 22, actAvg: 25, act75: 29 };
    return { act25: 18, actAvg: 22, act75: 26 };
  }
}
