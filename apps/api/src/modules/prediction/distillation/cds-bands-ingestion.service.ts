import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

const CDS_BAND_SCHOOL_SELECT = {
  id: true,
  name: true,
  nameZh: true,
  usNewsRank: true,
} as const;
import { ListCdsBandRowsDto, UpdateCdsBandRowDto } from './distillation.dto';

export type CdsBandInputRow = {
  schoolId?: string;
  schoolName?: string;
  schoolNameNorm?: string;
  gpaBand: string;
  testType: string;
  testBand?: string;
  admitRate: number;
  sampleCount?: number | null;
  cycleYear: number;
  source: string;
  sourceUrl?: string | null;
};

export type CdsBandsIngestionResult = {
  dryRun: boolean;
  scanned: number;
  valid: number;
  created: number;
  updated: number;
  errors: Array<{ index: number; reason: string }>;
};

const ALLOWED_TEST_TYPES = new Set(['SAT', 'ACT', 'GPA_ONLY']);
const GPA_BANDS = new Set([
  '3.75-4.00',
  '3.50-3.74',
  '3.25-3.49',
  '3.00-3.24',
  '<3.00',
]);

const PRIORITY_SCHOOL_NAME_NORMS = new Set(
  [
    'university of california, berkeley',
    'university of california, los angeles',
    'university of california, san diego',
    'university of california, davis',
    'university of california, irvine',
    'university of california, santa barbara',
    'university of california, riverside',
    'university of california, santa cruz',
    'university of california, merced',
    'harvard university',
    'yale university',
    'princeton university',
    'columbia university',
    'brown university',
    'dartmouth college',
    'cornell university',
    'university of pennsylvania',
    'massachusetts institute of technology',
    'stanford university',
    'duke university',
    'northwestern university',
    'johns hopkins university',
    'vanderbilt university',
    'university of notre dame',
    'rice university',
    'university of michigan-ann arbor',
    'university of virginia-main campus',
    'university of north carolina at chapel hill',
    'university of florida',
  ].map((name) => name.toLowerCase()),
);

@Injectable()
export class CdsBandsIngestionService {
  constructor(private readonly prisma: PrismaService) {}

  async getCoverage() {
    const [schools, grouped] = await Promise.all([
      // governance: system-scope — SchoolCdsAdmitBand / School — published Common Data Set figures
      this.prisma.school.findMany({
        where: { country: 'US' },
        select: {
          id: true,
          name: true,
          nameZh: true,
          nameNorm: true,
          usNewsRank: true,
          acceptanceRate: true,
        },
        orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.schoolCdsAdmitBand.groupBy({
        by: ['schoolId'],
        _count: { _all: true },
        _max: { cycleYear: true, updatedAt: true },
      }),
    ]);

    const bySchool = new Map(grouped.map((row) => [row.schoolId, row]));
    const items = schools.map((school) => {
      const coverage = bySchool.get(school.id);
      const cellCount = coverage?._count._all ?? 0;
      return {
        schoolId: school.id,
        schoolName: school.name,
        schoolNameZh: school.nameZh,
        schoolNameNorm: school.nameNorm,
        usNewsRank: school.usNewsRank,
        acceptanceRate: school.acceptanceRate
          ? Number(school.acceptanceRate)
          : null,
        priority: PRIORITY_SCHOOL_NAME_NORMS.has(school.nameNorm),
        cellCount,
        ready: cellCount >= 10,
        latestCycleYear: coverage?._max.cycleYear ?? null,
        lastUpdatedAt: coverage?._max.updatedAt?.toISOString() ?? null,
      };
    });

    const priority = items.filter((item) => item.priority);
    return {
      generatedAt: new Date().toISOString(),
      totals: {
        schools: items.length,
        schoolsWithAnyCells: items.filter((item) => item.cellCount > 0).length,
        schoolsReady: items.filter((item) => item.ready).length,
        prioritySchools: priority.length,
        priorityReady: priority.filter((item) => item.ready).length,
        totalCells: grouped.reduce((sum, row) => sum + row._count._all, 0),
      },
      items,
    };
  }

  async listRows(query: ListCdsBandRowsDto) {
    const limit = Math.min(Math.max(query.limit ?? 200, 1), 1000);
    // governance: system-scope — SchoolCdsAdmitBand / School — published Common Data Set figures
    const rows = await this.prisma.schoolCdsAdmitBand.findMany({
      where: {
        ...(query.schoolId ? { schoolId: query.schoolId } : {}),
        ...(query.source
          ? { source: { contains: query.source, mode: 'insensitive' } }
          : {}),
      },
      include: {
        school: {
          select: CDS_BAND_SCHOOL_SELECT,
        },
      },
      orderBy: [
        { school: { usNewsRank: 'asc' } },
        { school: { name: 'asc' } },
        { cycleYear: 'desc' },
        { gpaBand: 'asc' },
        { testType: 'asc' },
        { testBand: 'asc' },
      ],
      take: limit,
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        schoolId: row.schoolId,
        school: row.school,
        gpaBand: row.gpaBand,
        testType: row.testType,
        testBand: row.testBand,
        admitRate: Number(row.admitRate),
        sampleCount: row.sampleCount,
        cycleYear: row.cycleYear,
        source: row.source,
        sourceUrl: row.sourceUrl,
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }

  async updateRow(id: string, dto: UpdateCdsBandRowDto) {
    const data: Prisma.SchoolCdsAdmitBandUpdateInput = {};
    if (dto.gpaBand != null) {
      if (!GPA_BANDS.has(dto.gpaBand)) {
        throw new BadRequestException(`invalid_gpa_band:${dto.gpaBand}`);
      }
      data.gpaBand = dto.gpaBand;
    }
    if (dto.testType != null) {
      const testType = dto.testType.trim().toUpperCase();
      if (!ALLOWED_TEST_TYPES.has(testType)) {
        throw new BadRequestException(`invalid_test_type:${dto.testType}`);
      }
      data.testType = testType;
      if (testType === 'GPA_ONLY') data.testBand = 'ANY';
    }
    if (dto.testBand != null && dto.testType?.toUpperCase() !== 'GPA_ONLY') {
      data.testBand = dto.testBand.trim();
    }
    if (dto.admitRate != null) {
      const admitRate = dto.admitRate > 1 ? dto.admitRate / 100 : dto.admitRate;
      if (!Number.isFinite(admitRate) || admitRate <= 0 || admitRate >= 1) {
        throw new BadRequestException(`invalid_admit_rate:${dto.admitRate}`);
      }
      data.admitRate = new Prisma.Decimal(admitRate);
    }
    if (dto.sampleCount != null)
      data.sampleCount = Math.max(0, dto.sampleCount);
    if (dto.cycleYear != null) data.cycleYear = dto.cycleYear;
    if (dto.source != null) data.source = dto.source.trim();
    if (dto.sourceUrl !== undefined)
      data.sourceUrl = dto.sourceUrl?.trim() || null;

    // governance: system-scope — SchoolCdsAdmitBand / School — published Common Data Set figures
    const row = await this.prisma.schoolCdsAdmitBand.update({
      where: { id },
      data,
      include: {
        school: {
          select: CDS_BAND_SCHOOL_SELECT,
        },
      },
    });

    return {
      id: row.id,
      schoolId: row.schoolId,
      school: row.school,
      gpaBand: row.gpaBand,
      testType: row.testType,
      testBand: row.testBand,
      admitRate: Number(row.admitRate),
      sampleCount: row.sampleCount,
      cycleYear: row.cycleYear,
      source: row.source,
      sourceUrl: row.sourceUrl,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async ingestRows(
    rows: CdsBandInputRow[],
    options: { dryRun?: boolean } = {},
  ): Promise<CdsBandsIngestionResult> {
    const dryRun = options.dryRun ?? true;
    const result: CdsBandsIngestionResult = {
      dryRun,
      scanned: rows.length,
      valid: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    for (const [index, rawRow] of rows.entries()) {
      const parsed = await this.normalizeRow(rawRow).catch((error) => {
        result.errors.push({
          index,
          reason: error instanceof Error ? error.message : String(error),
        });
        return null;
      });
      if (!parsed) continue;
      result.valid += 1;
      if (dryRun) continue;

      // governance: system-scope — SchoolCdsAdmitBand / School — published Common Data Set figures
      const existing = await this.prisma.schoolCdsAdmitBand.findUnique({
        where: {
          schoolId_gpaBand_testType_testBand_cycleYear: {
            schoolId: parsed.schoolId,
            gpaBand: parsed.gpaBand,
            testType: parsed.testType,
            testBand: parsed.testBand,
            cycleYear: parsed.cycleYear,
          },
        },
        select: { id: true },
      });

      if (existing) {
        // governance: system-scope — SchoolCdsAdmitBand / School — published Common Data Set figures
        await this.prisma.schoolCdsAdmitBand.update({
          where: { id: existing.id },
          data: {
            admitRate: parsed.admitRate,
            sampleCount: parsed.sampleCount,
            source: parsed.source,
            sourceUrl: parsed.sourceUrl,
          },
        });
        result.updated += 1;
      } else {
        // governance: system-scope — SchoolCdsAdmitBand / School — published Common Data Set figures
        await this.prisma.schoolCdsAdmitBand.create({ data: parsed });
        result.created += 1;
      }
    }

    return result;
  }

  private async normalizeRow(raw: CdsBandInputRow): Promise<{
    schoolId: string;
    gpaBand: string;
    testType: string;
    testBand: string;
    admitRate: Prisma.Decimal;
    sampleCount: number | null;
    cycleYear: number;
    source: string;
    sourceUrl: string | null;
  }> {
    const schoolId = await this.resolveSchoolId(raw);
    const gpaBand = raw.gpaBand?.trim();
    if (!GPA_BANDS.has(gpaBand)) {
      throw new BadRequestException(`invalid_gpa_band:${raw.gpaBand}`);
    }

    const testType = raw.testType?.trim().toUpperCase();
    if (!ALLOWED_TEST_TYPES.has(testType)) {
      throw new BadRequestException(`invalid_test_type:${raw.testType}`);
    }
    const testBand =
      testType === 'GPA_ONLY' ? 'ANY' : raw.testBand?.trim() || '';
    if (!testBand) {
      throw new BadRequestException('missing_test_band');
    }

    const admitRate = raw.admitRate > 1 ? raw.admitRate / 100 : raw.admitRate;
    if (!Number.isFinite(admitRate) || admitRate <= 0 || admitRate >= 1) {
      throw new BadRequestException(`invalid_admit_rate:${raw.admitRate}`);
    }
    if (!Number.isInteger(raw.cycleYear) || raw.cycleYear < 2000) {
      throw new BadRequestException(`invalid_cycle_year:${raw.cycleYear}`);
    }
    if (!raw.source?.trim()) {
      throw new BadRequestException('missing_source');
    }

    return {
      schoolId,
      gpaBand,
      testType,
      testBand,
      admitRate: new Prisma.Decimal(admitRate),
      sampleCount:
        raw.sampleCount == null
          ? null
          : Math.max(0, Math.round(raw.sampleCount)),
      cycleYear: raw.cycleYear,
      source: raw.source.trim(),
      sourceUrl: raw.sourceUrl?.trim() || null,
    };
  }

  private async resolveSchoolId(raw: CdsBandInputRow): Promise<string> {
    if (raw.schoolId) {
      // governance: system-scope — SchoolCdsAdmitBand / School — published Common Data Set figures
      const school = await this.prisma.school.findUnique({
        where: { id: raw.schoolId },
        select: { id: true },
      });
      if (school) return school.id;
      throw new BadRequestException(`unknown_school_id:${raw.schoolId}`);
    }

    const schoolNameNorm =
      raw.schoolNameNorm?.trim().toLowerCase() ??
      raw.schoolName?.trim().toLowerCase();
    if (!schoolNameNorm) {
      throw new BadRequestException('missing_school_identifier');
    }

    // governance: system-scope — SchoolCdsAdmitBand / School — published Common Data Set figures
    const school = await this.prisma.school.findUnique({
      where: { nameNorm: schoolNameNorm },
      select: { id: true },
    });
    if (!school) {
      throw new BadRequestException(`unknown_school:${schoolNameNorm}`);
    }
    return school.id;
  }
}
