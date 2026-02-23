import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { School, Prisma } from '@prisma/client';
import { normalizeSchoolName } from '../utils/school-name.util';

/**
 * Canonical school lookup service.
 *
 * ALL data ingestion paths should use this service (or at minimum the
 * `normalizeSchoolName` utility) to prevent duplicate school records.
 * The `nameNorm` column has a UNIQUE constraint enforced by the database.
 */
@Injectable()
export class SchoolLookupService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find a school by name (case-insensitive, trimmed).
   * This is the single canonical lookup method.
   */
  async findByName(name: string): Promise<School | null> {
    const norm = normalizeSchoolName(name);
    return this.prisma.school.findUnique({
      where: { nameNorm: norm },
    });
  }

  /**
   * Find by external ID (College Scorecard or IPEDS).
   */
  async findByExternalId(opts: {
    scorecardId?: string;
    ipedsId?: string;
  }): Promise<School | null> {
    if (opts.scorecardId) {
      return this.prisma.school.findUnique({
        where: { scorecardId: opts.scorecardId },
      });
    }
    if (opts.ipedsId) {
      return this.prisma.school.findUnique({
        where: { ipedsId: opts.ipedsId },
      });
    }
    return null;
  }

  /**
   * Find or create a school. Used by ingestion paths that may encounter
   * schools not yet in the database.
   */
  async findOrCreate(
    name: string,
    defaults?: Omit<Prisma.SchoolCreateInput, 'name' | 'nameNorm'>,
  ): Promise<School> {
    const norm = normalizeSchoolName(name);
    const existing = await this.prisma.school.findUnique({
      where: { nameNorm: norm },
    });
    if (existing) return existing;

    return this.prisma.school.create({
      data: {
        name: name.trim(),
        nameNorm: norm,
        country: 'US',
        ...defaults,
      },
    });
  }

  /**
   * Upsert by College Scorecard ID.
   * Looks up by scorecardId first, then falls back to nameNorm.
   */
  async upsertByScorecard(
    scorecardId: string,
    name: string,
    data: Omit<Prisma.SchoolUpdateInput, 'name' | 'nameNorm' | 'scorecardId'>,
  ): Promise<School> {
    const norm = normalizeSchoolName(name);

    const existing =
      (await this.prisma.school.findUnique({ where: { scorecardId } })) ??
      (await this.prisma.school.findUnique({ where: { nameNorm: norm } }));

    if (existing) {
      return this.prisma.school.update({
        where: { id: existing.id },
        data: { ...data, scorecardId, nameNorm: norm },
      });
    }

    return this.prisma.school.create({
      data: {
        name: name.trim(),
        nameNorm: norm,
        scorecardId,
        country: 'US',
        ...(data as Prisma.SchoolCreateInput),
      },
    });
  }
}
