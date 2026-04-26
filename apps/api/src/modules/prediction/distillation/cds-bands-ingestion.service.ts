import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

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

@Injectable()
export class CdsBandsIngestionService {
  constructor(private readonly prisma: PrismaService) {}

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
