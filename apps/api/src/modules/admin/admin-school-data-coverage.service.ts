import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  ProvenanceStaleness,
  RealDataStatus,
  TrustTier,
} from '@study-abroad/shared';
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
  'oosAcceptanceRate',
  'sat25',
  'sat75',
  'testOptional',
  'needBlindInternational',
] as const;
const OPTIONAL_FIELDS = ['satAvg', 'act25', 'actAvg', 'act75'] as const;
const CAMPUS_LIFE_FIELDS = [
  'roomAndBoard',
  'studentOrgsCount',
  'countriesRepresented',
  'housingAvailable',
  'housingRequiredYears',
  'percentLivingOnCampus',
  'mealPlanCost',
  'campusSafetyServices',
  'campusLifeSummary',
  'nicheSafetyGrade',
  'nicheLifeGrade',
  'nicheFoodGrade',
  'nicheOverallGrade',
] as const;
const HEURISTIC_SOURCE = 'HEURISTIC:PR-15';
const TERMINAL_REAL_DATA_STATUSES = new Set([
  'OFFICIAL_BLANK',
  'OFFICIAL_BLOCKED',
  'NO_PUBLIC_REAL_DATA',
  'MANUAL_REVIEW',
  'PERMANENT_HEURISTIC',
]);

export type PredictionCoverageField =
  (typeof CRITICAL_FIELDS)[number] | (typeof OPTIONAL_FIELDS)[number];
export type CampusLifeCoverageField = (typeof CAMPUS_LIFE_FIELDS)[number];
export type CoverageField = PredictionCoverageField | CampusLifeCoverageField;
export type CoverageBucket =
  'official' | 'heuristic' | 'terminal' | 'stale' | 'other' | 'missing';

export interface FieldCoverageTotal {
  total: number;
  filled: number;
  percent: number;
  predictionEligible: number;
  predictionEligiblePercent: number;
  heuristic: number;
  official: number;
  terminal: number;
  stale: number;
}

export interface CoverageFieldStatus {
  field: CoverageField;
  value: unknown;
  filled: boolean;
  explicitUnknown: boolean;
  source: string | null;
  tier: TrustTier | null;
  confidence: number | null;
  fetchedAt: string | null;
  sourceUrl: string | null;
  cycleYear: number | null;
  notes: string | null;
  validatorCount: number | null;
  originalFormula: string | null;
  realDataStatus: RealDataStatus | null;
  terminalStatus: RealDataStatus | string | null;
  extractionMethod: string | null;
  reason: string | null;
  permanent: boolean | null;
  staleness: ProvenanceStaleness | null;
  predictionEligible: boolean;
  isOfficial: boolean;
  isHeuristic: boolean;
  isTerminal: boolean;
  bucket: CoverageBucket;
}

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
  needBlindInternational: boolean | null;
  roomAndBoard: number | null;
  studentOrgsCount: number | null;
  countriesRepresented: number | null;
  housingAvailable: boolean | null;
  housingRequiredYears: number | null;
  percentLivingOnCampus: Prisma.Decimal | null;
  mealPlanCost: number | null;
  campusSafetyServices: string[];
  campusLifeSummary: Prisma.JsonValue | null;
  nicheSafetyGrade: string | null;
  nicheLifeGrade: string | null;
  nicheFoodGrade: string | null;
  nicheOverallGrade: string | null;
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
    const campusLifeTotals = this.emptyFieldTotalsFor(CAMPUS_LIFE_FIELDS);
    const sourceCounts: Record<string, number> = {};
    const tierCounts: Record<string, number> = {};
    const bucketCounts: Record<CoverageBucket, number> = {
      official: 0,
      heuristic: 0,
      terminal: 0,
      stale: 0,
      other: 0,
      missing: 0,
    };
    const campusLifeSourceCounts: Record<string, number> = {};
    const campusLifeTierCounts: Record<string, number> = {};
    const campusLifeBucketCounts: Record<CoverageBucket, number> = {
      official: 0,
      heuristic: 0,
      terminal: 0,
      stale: 0,
      other: 0,
      missing: 0,
    };

    const items = schools.map((school) => {
      const provenance = buildNormalizedSchoolProvenance(school as any);
      const fields = [...CRITICAL_FIELDS, ...OPTIONAL_FIELDS].map((field) => {
        const status = this.buildFieldStatus(school, field, provenance);
        this.trackFieldStatus(status, fieldTotals[field], {
          bucketCounts,
          sourceCounts,
          tierCounts,
        });
        return status;
      });
      const campusLifeFields = CAMPUS_LIFE_FIELDS.map((field) => {
        const status = this.buildFieldStatus(school, field, provenance);
        this.trackFieldStatus(status, campusLifeTotals[field], {
          bucketCounts: campusLifeBucketCounts,
          sourceCounts: campusLifeSourceCounts,
          tierCounts: campusLifeTierCounts,
        });
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
      const terminalCritical = critical
        .filter((field) => field.isTerminal)
        .map((field) => field.field);
      const staleCritical = critical
        .filter((field) => field.staleness === 'STALE')
        .map((field) => field.field);
      const missingCampusLife = campusLifeFields
        .filter((field) => !field.filled)
        .map((field) => field.field);
      const terminalCampusLife = campusLifeFields
        .filter((field) => field.isTerminal)
        .map((field) => field.field);
      const staleCampusLife = campusLifeFields
        .filter((field) => field.staleness === 'STALE')
        .map((field) => field.field);

      return {
        schoolId: school.id,
        schoolName: school.name,
        schoolNameZh: school.nameZh,
        country: school.country,
        state: school.state,
        // Exposed so downstream consumers (data-health dashboard) can
        // distinguish "private — OOS not applicable" from a real data gap.
        isPrivate: school.isPrivate,
        usNewsRank: school.usNewsRank,
        scorecardId: school.scorecardId,
        ipedsId: school.ipedsId,
        criticalComplete: missingCritical.length === 0,
        missingCritical,
        heuristicCritical,
        terminalCritical,
        staleCritical,
        campusLifeComplete: missingCampusLife.length === 0,
        missingCampusLife,
        terminalCampusLife,
        staleCampusLife,
        fields,
        campusLifeFields,
      };
    });

    this.finalizeFieldTotals(fieldTotals);
    this.finalizeFieldTotals(campusLifeTotals);
    const campusLifeTotalValues = Object.values(campusLifeTotals);

    return {
      generatedAt,
      scope: options?.includeAllCountries ? 'all-schools' : 'us-freshman',
      criticalFields: CRITICAL_FIELDS,
      optionalFields: OPTIONAL_FIELDS,
      campusLifeFields: CAMPUS_LIFE_FIELDS,
      totals: {
        schools: schools.length,
        criticalComplete: items.filter((item) => item.criticalComplete).length,
        missingAnyCritical: items.filter((item) => !item.criticalComplete)
          .length,
        heuristicOnlySchools: items.filter(
          (item) => item.heuristicCritical.length > 0,
        ).length,
        terminalStatusSchools: items.filter(
          (item) => item.terminalCritical.length > 0,
        ).length,
        staleCriticalSchools: items.filter(
          (item) => item.staleCritical.length > 0,
        ).length,
        officialFields: Object.values(fieldTotals).reduce(
          (sum, total) => sum + total.official,
          0,
        ),
        heuristicFields: Object.values(fieldTotals).reduce(
          (sum, total) => sum + total.heuristic,
          0,
        ),
        terminalFields: Object.values(fieldTotals).reduce(
          (sum, total) => sum + total.terminal,
          0,
        ),
        staleFields: Object.values(fieldTotals).reduce(
          (sum, total) => sum + total.stale,
          0,
        ),
      },
      fieldTotals,
      campusLifeTotals,
      campusLifeSummary: {
        totalSchools: schools.length,
        complete: items.filter((item) => item.campusLifeComplete).length,
        missingAny: items.filter((item) => !item.campusLifeComplete).length,
        terminalSchools: items.filter(
          (item) => item.terminalCampusLife.length > 0,
        ).length,
        staleSchools: items.filter((item) => item.staleCampusLife.length > 0)
          .length,
        filledFields: campusLifeTotalValues.reduce(
          (sum, total) => sum + total.filled,
          0,
        ),
        terminalFields: campusLifeTotalValues.reduce(
          (sum, total) => sum + total.terminal,
          0,
        ),
        missingFields: campusLifeTotalValues.reduce(
          (sum, total) => sum + (total.total - total.filled),
          0,
        ),
      },
      bucketCounts,
      sourceCounts,
      tierCounts,
      campusLifeBucketCounts,
      campusLifeSourceCounts,
      campusLifeTierCounts,
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
        // For the heuristic derivation a null status (unreviewed) is treated
        // the same as need-aware (the safer fallback). Explicit need-blind
        // schools (true) lift the cap on the heuristic — see deriveIntlRate.
        updates.intlAcceptanceRate = this.deriveIntlRate(
          overall,
          school.needBlindInternational,
        );
        changedFields.push('intlAcceptanceRate');
      }
      if (canFill('oosAcceptanceRate', school.oosAcceptanceRate)) {
        updates.oosAcceptanceRate = this.deriveOosRate(
          overall,
          school.isPrivate,
          school.state,
        );
        changedFields.push('oosAcceptanceRate');
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
    const beforeCoverage =
      dto.dryRun === false ? await this.getCoverage() : null;
    const unitids = dto.rows.map((row) => row.unitid);
    const nameNorms = dto.rows
      .map((row) => row.schoolNameNorm)
      .filter((nameNorm): nameNorm is string => Boolean(nameNorm));
    const [schoolsByIpeds, schoolsByName] = await Promise.all([
      this.prisma.school.findMany({
        where: { ipedsId: { in: unitids } },
        select: { id: true, ipedsId: true },
      }),
      nameNorms.length
        ? this.prisma.school.findMany({
            where: { nameNorm: { in: nameNorms } },
            select: { id: true, nameNorm: true },
          })
        : Promise.resolve([]),
    ]);
    const byUnitid = new Map(
      schoolsByIpeds.map((school) => [school.ipedsId, school.id]),
    );
    const byNameNorm = new Map(
      schoolsByName.map((school) => [school.nameNorm, school.id]),
    );
    const notFound: Array<{
      rowIndex: number;
      unitid: string;
      schoolNameNorm?: string;
    }> = [];
    const rows = dto.rows.flatMap((row, rowIndex) => {
      const schoolId =
        byUnitid.get(row.unitid) ??
        (row.schoolNameNorm ? byNameNorm.get(row.schoolNameNorm) : undefined);
      if (!schoolId) {
        notFound.push({
          rowIndex,
          unitid: row.unitid,
          schoolNameNorm: row.schoolNameNorm,
        });
        return [];
      }
      return [
        {
          ...row,
          schoolId,
          source: `IPEDS_CSV:${dto.cycleYear ?? new Date().getFullYear()}:unitid-${row.unitid}`,
          sourceUrl: 'https://nces.ed.gov/ipeds/use-the-data',
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
    const afterCoverage = beforeCoverage ? await this.getCoverage() : null;
    return {
      ...bulkResult,
      scannedIpedsRows: dto.rows.length,
      ipedsNotFound: notFound,
      coverageDiff:
        beforeCoverage && afterCoverage
          ? this.computeCoverageDiff(beforeCoverage, afterCoverage)
          : undefined,
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
    const beforeCoverage =
      dto.dryRun === false ? await this.getCoverage() : null;
    const bulkResult = await this.schoolRates.runBulkUpdate(
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
    const afterCoverage = beforeCoverage ? await this.getCoverage() : null;
    return {
      ...bulkResult,
      coverageDiff:
        beforeCoverage && afterCoverage
          ? this.computeCoverageDiff(beforeCoverage, afterCoverage)
          : undefined,
    };
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
        roomAndBoard: true,
        studentOrgsCount: true,
        countriesRepresented: true,
        housingAvailable: true,
        housingRequiredYears: true,
        percentLivingOnCampus: true,
        mealPlanCost: true,
        campusSafetyServices: true,
        campusLifeSummary: true,
        nicheSafetyGrade: true,
        nicheLifeGrade: true,
        nicheFoodGrade: true,
        nicheOverallGrade: true,
        metadata: true,
        updatedAt: true,
        scorecardId: true,
        ipedsId: true,
      },
      orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
      take: options?.limit,
    });
  }

  private buildFieldStatus(
    school: SchoolForCoverage,
    field: CoverageField,
    provenance: ReturnType<typeof buildNormalizedSchoolProvenance>,
  ): CoverageFieldStatus {
    const rawValue = this.fieldValue(school, field);
    const explicitUnknown =
      field === 'testOptional' &&
      rawValue == null &&
      school.testingPolicy === 'UNKNOWN';
    const source = provenance[field]
      ? toSchoolFieldSource(provenance[field])
      : null;
    const isHeuristic =
      source?.tier === 'INFERRED' ||
      Boolean(source?.source?.toUpperCase().includes('HEURISTIC'));
    const isTerminal =
      source?.tier === 'UNAVAILABLE' ||
      Boolean(
        source?.realDataStatus &&
        TERMINAL_REAL_DATA_STATUSES.has(source.realDataStatus),
      );
    const isOfficial =
      source?.tier === 'OFFICIAL' || source?.tier === 'PARTNER';
    const filled = rawValue != null || explicitUnknown || isTerminal;
    const bucket: CoverageBucket = isTerminal
      ? 'terminal'
      : isHeuristic
        ? 'heuristic'
        : isOfficial
          ? 'official'
          : source?.staleness === 'STALE'
            ? 'stale'
            : source
              ? 'other'
              : 'missing';
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
      validatorCount: source?.validatorCount ?? null,
      originalFormula: source?.originalFormula ?? null,
      realDataStatus: source?.realDataStatus ?? null,
      terminalStatus: isTerminal
        ? (source?.realDataStatus ?? source?.source ?? null)
        : null,
      extractionMethod: source?.extractionMethod ?? null,
      reason: source?.reason ?? null,
      permanent: source?.permanent ?? null,
      staleness: source?.staleness ?? null,
      predictionEligible: (source?.predictionEligible ?? false) || isHeuristic,
      isOfficial,
      isHeuristic,
      isTerminal,
      bucket,
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
    if (Array.isArray(value)) return value.length > 0 ? value : null;
    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>).length > 0
        ? value
        : null;
    }
    return value ?? null;
  }

  private emptyFieldTotalsFor<T extends string>(fields: readonly T[]) {
    const totals = {} as Record<T, FieldCoverageTotal>;
    for (const field of fields) {
      totals[field] = {
        total: 0,
        filled: 0,
        percent: 0,
        predictionEligible: 0,
        predictionEligiblePercent: 0,
        official: 0,
        heuristic: 0,
        terminal: 0,
        stale: 0,
      };
    }
    return totals;
  }

  private emptyFieldTotals() {
    return this.emptyFieldTotalsFor([...CRITICAL_FIELDS, ...OPTIONAL_FIELDS]);
  }

  private trackFieldStatus(
    status: ReturnType<AdminSchoolDataCoverageService['buildFieldStatus']>,
    total: FieldCoverageTotal,
    counts: {
      bucketCounts: Record<CoverageBucket, number>;
      sourceCounts: Record<string, number>;
      tierCounts: Record<string, number>;
    },
  ) {
    total.total += 1;
    if (status.filled) total.filled += 1;
    if (status.predictionEligible) total.predictionEligible += 1;
    if (status.isOfficial) total.official += 1;
    if (status.isHeuristic) total.heuristic += 1;
    if (status.isTerminal) total.terminal += 1;
    if (status.staleness === 'STALE') total.stale += 1;
    counts.bucketCounts[status.bucket] += 1;
    if (status.source) {
      counts.sourceCounts[status.source] =
        (counts.sourceCounts[status.source] ?? 0) + 1;
    }
    if (status.tier) {
      counts.tierCounts[status.tier] =
        (counts.tierCounts[status.tier] ?? 0) + 1;
    }
  }

  private finalizeFieldTotals(
    totals: Record<string, FieldCoverageTotal>,
  ): void {
    for (const total of Object.values(totals)) {
      total.percent =
        total.total > 0
          ? Math.round((total.filled / total.total) * 1000) / 10
          : 0;
      total.predictionEligiblePercent =
        total.total > 0
          ? Math.round((total.predictionEligible / total.total) * 1000) / 10
          : 0;
    }
  }

  private computeCoverageDiff(
    before: Awaited<ReturnType<AdminSchoolDataCoverageService['getCoverage']>>,
    after: Awaited<ReturnType<AdminSchoolDataCoverageService['getCoverage']>>,
  ) {
    const fields = [...CRITICAL_FIELDS, ...OPTIONAL_FIELDS];
    const fieldDiffs = Object.fromEntries(
      fields.map((field) => {
        const b = before.fieldTotals[field];
        const a = after.fieldTotals[field];
        return [
          field,
          {
            filled: a.filled - b.filled,
            official: a.official - b.official,
            heuristic: a.heuristic - b.heuristic,
            terminal: a.terminal - b.terminal,
            stale: a.stale - b.stale,
            predictionEligible: a.predictionEligible - b.predictionEligible,
            predictionEligiblePercent:
              Math.round(
                (a.predictionEligiblePercent - b.predictionEligiblePercent) *
                  10,
              ) / 10,
          },
        ];
      }),
    );

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        officialFields:
          (after.totals.officialFields ?? 0) -
          (before.totals.officialFields ?? 0),
        heuristicFields:
          (after.totals.heuristicFields ?? 0) -
          (before.totals.heuristicFields ?? 0),
        terminalFields:
          (after.totals.terminalFields ?? 0) -
          (before.totals.terminalFields ?? 0),
        staleFields:
          (after.totals.staleFields ?? 0) - (before.totals.staleFields ?? 0),
        criticalComplete:
          after.totals.criticalComplete - before.totals.criticalComplete,
        missingAnyCritical:
          after.totals.missingAnyCritical - before.totals.missingAnyCritical,
      },
      fields: fieldDiffs,
    };
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

  private deriveIntlRate(
    overallPercent: number,
    needBlind: boolean | null,
  ): number {
    const multiplier =
      overallPercent >= 40
        ? 0.95
        : overallPercent >= 20
          ? needBlind
            ? 0.85
            : needBlind === false
              ? 0.7
              : 0.78
          : needBlind
            ? 0.7
            : needBlind === false
              ? 0.4
              : 0.55;
    return Math.max(
      0.1,
      Math.min(98, Math.round(overallPercent * multiplier * 100) / 100),
    );
  }

  private deriveOosRate(
    overallPercent: number,
    isPrivate: boolean,
    state: string | null,
  ): number {
    if (isPrivate) return Math.round(overallPercent * 100) / 100;

    const strongResidencyPreference = new Set([
      'CA',
      'MI',
      'NC',
      'VA',
      'TX',
      'FL',
    ]);
    const hasStrongPreference = state
      ? strongResidencyPreference.has(state.trim().toUpperCase())
      : false;
    const multiplier =
      overallPercent >= 50
        ? 1.02
        : overallPercent >= 40
          ? 0.95
          : overallPercent >= 20
            ? hasStrongPreference
              ? 0.75
              : 0.85
            : overallPercent >= 10
              ? hasStrongPreference
                ? 0.6
                : 0.75
              : hasStrongPreference
                ? 0.5
                : 0.7;

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
