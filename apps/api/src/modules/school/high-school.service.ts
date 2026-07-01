import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { HighSchoolType, Prisma } from '@prisma/client';
import { computeTierFromPartial } from '@study-abroad/shared/scoring';
import {
  computeHsQualityScore,
  type HsQualityInput,
} from '@study-abroad/shared/scoring';
import {
  HS_QUALITY_ASSESSED,
  HS_TIER_CHANGED,
  HS_SUGGESTION_APPROVED,
  type HsQualityAssessedPayload,
  type HsTierChangedPayload,
  type HsSuggestionApprovedPayload,
} from '../../common/events/high-school.events';

type HsSource =
  'admin' | 'suggestion' | 'import' | 'ai-evaluate' | 'niche-scrape';

@Injectable()
export class HighSchoolService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ============================================
  // Layer 1: Unified Quality Gate
  // ============================================

  /**
   * Unified pre-save hook for ALL high school write paths.
   *
   * 1. Compute tier from available dimensions (partial support)
   * 2. Compute quality score and grade
   * 3. Route: D-grade → hsImpactEnabled=false
   * 4. Emit quality-assessed event
   */
  private beforeSave(
    data: Record<string, any>,
    source: HsSource,
    oldTier?: number | null,
  ): Record<string, any> {
    // 1. Compute tier from partial dimensions
    const tier = computeTierFromPartial({
      recognition: data.recognition,
      academicRigor: data.academicRigor,
      placementRecord: data.placementRecord,
      studentQuality: data.studentQuality,
      resources: data.resources,
    });

    if (tier !== null) {
      data.tier = tier;
    }

    // 2. Quality scoring
    const quality = computeHsQualityScore(data as HsQualityInput);
    data.qualityScore = quality.score;
    data.qualityGrade = quality.grade;

    // 3. Routing: D-grade schools don't participate in HS scoring
    data.hsImpactEnabled = quality.grade !== 'D';

    // 4. Emit events (deferred to after save in caller, but prepare payload)
    // Store event data for post-save emission
    data._qualityEvent = {
      score: quality.score,
      grade: quality.grade,
      missingCritical: quality.missingCritical,
      source,
    } as Partial<HsQualityAssessedPayload>;

    // Track tier change for event emission
    if (oldTier !== undefined && tier !== null && oldTier !== tier) {
      data._tierChanged = { oldTier, newTier: tier };
    }

    return data;
  }

  /**
   * Emit events after a successful save operation.
   */
  private emitPostSaveEvents(
    highSchoolId: string,
    name: string,
    data: Record<string, any>,
    changedBy: string,
  ): void {
    if (data._qualityEvent) {
      const payload: HsQualityAssessedPayload = {
        highSchoolId,
        name,
        ...data._qualityEvent,
      };
      this.eventEmitter.emit(HS_QUALITY_ASSESSED, payload);
    }

    if (data._tierChanged) {
      const payload: HsTierChangedPayload = {
        highSchoolId,
        name,
        oldTier: data._tierChanged.oldTier,
        newTier: data._tierChanged.newTier,
        changedBy,
      };
      this.eventEmitter.emit(HS_TIER_CHANGED, payload);
    }
  }

  /**
   * Clean transient event fields before persisting to DB.
   */
  private stripEventFields(data: Record<string, any>): Record<string, any> {
    const { _qualityEvent, _tierChanged, ...clean } = data;
    return clean;
  }

  // ============================================
  // Public API
  // ============================================

  async search(params: {
    search?: string;
    country?: string;
    type?: HighSchoolType;
    tier?: number;
    pageSize?: number;
  }) {
    const { search, country, type, tier, pageSize = 20 } = params;
    const where: any = { isActive: true };

    if (country) where.country = country;
    if (type) where.type = type;
    if (tier) where.tier = tier;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { nameZh: { contains: search, mode: 'insensitive' } },
        { abbreviation: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.highSchool.findMany({
      where,
      select: {
        id: true,
        name: true,
        nameZh: true,
        country: true,
        state: true,
        city: true,
        type: true,
        tier: true,
        abbreviation: true,
        description: true,
      },
      orderBy: [{ tier: 'desc' }, { name: 'asc' }],
      take: Math.min(pageSize, 100),
    });
  }

  async findById(id: string) {
    return this.prisma.highSchool.findUnique({ where: { id } });
  }

  async adminList(params: {
    search?: string;
    country?: string;
    state?: string;
    type?: string;
    tier?: number;
    needsReview?: boolean;
    page?: number;
    limit?: number;
  }) {
    const {
      search,
      country,
      state,
      type,
      tier,
      needsReview,
      page = 1,
      limit = 20,
    } = params;
    const where: any = {};

    if (country) where.country = country;
    if (state) where.state = state;
    if (type) where.type = type;
    if (tier) where.tier = tier;

    const searchConditions = search
      ? [
          { name: { contains: search, mode: 'insensitive' } },
          { nameZh: { contains: search, mode: 'insensitive' } },
          { abbreviation: { contains: search, mode: 'insensitive' } },
        ]
      : null;

    // needsReview: evaluatedAt is null or older than 12 months
    let reviewConditions = null;
    if (needsReview) {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      reviewConditions = [
        { evaluatedAt: null },
        { evaluatedAt: { lt: twelveMonthsAgo } },
      ];
    }

    // Combine search + needsReview with AND to avoid OR collision
    if (searchConditions && reviewConditions) {
      where.AND = [{ OR: searchConditions }, { OR: reviewConditions }];
    } else if (searchConditions) {
      where.OR = searchConditions;
    } else if (reviewConditions) {
      where.OR = reviewConditions;
    }

    const [data, total] = await Promise.all([
      this.prisma.highSchool.findMany({
        where,
        orderBy: [{ tier: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.highSchool.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async create(data: Record<string, any>, evaluatedBy: string) {
    const processed = this.beforeSave({ ...data }, 'admin');
    const clean = this.stripEventFields(processed);

    const highSchool = await this.prisma.highSchool.create({
      data: {
        ...clean,
        tier: clean.tier ?? data.tier ?? 3,
        evaluatedAt: new Date(),
        evaluatedBy,
      } as Prisma.HighSchoolCreateInput,
    });

    this.emitPostSaveEvents(
      highSchool.id,
      highSchool.name,
      processed,
      evaluatedBy,
    );
    return highSchool;
  }

  async update(id: string, data: Record<string, any>, evaluatedBy: string) {
    const existing = await this.prisma.highSchool.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`High school ${id} not found`);

    const merged = { ...existing, ...data };
    const processed = this.beforeSave(merged, 'admin', existing.tier);
    const clean = this.stripEventFields(processed);

    // Only persist fields from `data` plus computed quality fields
    const updateData: Record<string, any> = { ...data };
    if (clean.tier !== undefined) updateData.tier = clean.tier;
    updateData.qualityScore = clean.qualityScore;
    updateData.qualityGrade = clean.qualityGrade;
    updateData.hsImpactEnabled = clean.hsImpactEnabled;
    updateData.evaluatedAt = new Date();
    updateData.evaluatedBy = evaluatedBy;

    const highSchool = await this.prisma.highSchool.update({
      where: { id },
      data: updateData as Prisma.HighSchoolUpdateInput,
    });

    this.emitPostSaveEvents(
      highSchool.id,
      highSchool.name,
      processed,
      evaluatedBy,
    );
    return highSchool;
  }

  async getReviewNeeded() {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    return this.prisma.highSchool.findMany({
      where: {
        isActive: true,
        OR: [{ evaluatedAt: null }, { evaluatedAt: { lt: twelveMonthsAgo } }],
      },
      orderBy: { evaluatedAt: 'asc' },
    });
  }

  async submitSuggestion(
    data: { name: string; country: string; state?: string; city?: string },
    userId: string,
  ) {
    // Check if suggestion already exists
    const existing = await this.prisma.highSchoolSuggestion.findUnique({
      where: {
        name_country: { name: data.name, country: data.country },
      },
    });

    if (existing) {
      // Add userId if not already there
      if (!existing.submittedBy.includes(userId)) {
        return this.prisma.highSchoolSuggestion.update({
          where: { id: existing.id },
          data: { submittedBy: { push: userId } },
        });
      }
      return existing;
    }

    return this.prisma.highSchoolSuggestion.create({
      data: { ...data, submittedBy: [userId] },
    });
  }

  async listSuggestions(status?: string) {
    const suggestions = await this.prisma.highSchoolSuggestion.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    // Return submittedByCount instead of raw userIds array
    return suggestions.map((s) => ({
      ...s,
      submittedByCount: s.submittedBy.length,
      submittedBy: undefined, // Strip raw user IDs for privacy
    }));
  }

  async approveSuggestion(
    suggestionId: string,
    type: string,
    mergeIntoId?: string,
  ) {
    const suggestion = await this.prisma.highSchoolSuggestion.findUnique({
      where: { id: suggestionId },
    });
    if (!suggestion)
      throw new NotFoundException(`Suggestion ${suggestionId} not found`);
    if (suggestion.status !== 'pending')
      throw new BadRequestException('Suggestion already processed');

    if (mergeIntoId) {
      // Merge into existing school
      return this.prisma.highSchoolSuggestion.update({
        where: { id: suggestionId },
        data: { status: 'merged', mergedInto: mergeIntoId },
      });
    }

    // Create new high school from suggestion — runs through quality gate
    const hsData: Record<string, any> = {
      name: suggestion.name,
      country: suggestion.country,
      state: suggestion.state ?? undefined,
      city: suggestion.city ?? undefined,
      type: type as HighSchoolType,
    };

    const processed = this.beforeSave(hsData, 'suggestion');
    const clean = this.stripEventFields(processed);

    const highSchool = await this.prisma.highSchool.create({
      data: {
        ...clean,
        tier: clean.tier ?? 3,
      } as Prisma.HighSchoolCreateInput,
    });

    await this.prisma.highSchoolSuggestion.update({
      where: { id: suggestionId },
      data: { status: 'approved', mergedInto: highSchool.id },
    });

    // Emit quality + suggestion-approved events
    this.emitPostSaveEvents(
      highSchool.id,
      highSchool.name,
      processed,
      'system',
    );

    const approvedPayload: HsSuggestionApprovedPayload = {
      highSchoolId: highSchool.id,
      suggestionId,
      name: highSchool.name,
      submittedByUserIds: suggestion.submittedBy,
    };
    this.eventEmitter.emit(HS_SUGGESTION_APPROVED, approvedPayload);

    return highSchool;
  }

  async rejectSuggestion(suggestionId: string) {
    return this.prisma.highSchoolSuggestion.update({
      where: { id: suggestionId },
      data: { status: 'rejected' },
    });
  }

  /**
   * Batch import high schools from scraped/curated data.
   * Upserts by (name, country) to avoid duplicates.
   * All paths go through the unified quality gate (beforeSave).
   */
  async batchImport(
    schools: Array<Record<string, any>>,
    evaluatedBy: string,
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ name: string; error: string }>;
  }> {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ name: string; error: string }> = [];

    for (const school of schools) {
      try {
        if (!school.name || !school.country || !school.type) {
          errors.push({
            name: school.name ?? 'unknown',
            error: 'Missing required fields: name, country, type',
          });
          continue;
        }

        // Check for existing school by name + country
        const existing = await this.prisma.highSchool.findFirst({
          where: {
            name: { equals: school.name, mode: 'insensitive' },
            country: school.country,
          },
        });

        if (existing) {
          // Only update if new data has any evaluation dimensions or supplementary data
          if (
            school.recognition ||
            school.academicRigor ||
            school.placementRecord ||
            school.studentQuality ||
            school.resources
          ) {
            const merged = { ...existing, ...school };
            const processed = this.beforeSave(merged, 'import', existing.tier);
            const clean = this.stripEventFields(processed);

            await this.prisma.highSchool.update({
              where: { id: existing.id },
              data: {
                nameZh: school.nameZh ?? existing.nameZh,
                abbreviation: school.abbreviation ?? existing.abbreviation,
                state: school.state ?? existing.state,
                city: school.city ?? existing.city,
                website: school.website ?? existing.website,
                recognition: school.recognition ?? existing.recognition,
                academicRigor: school.academicRigor ?? existing.academicRigor,
                placementRecord:
                  school.placementRecord ?? existing.placementRecord,
                studentQuality:
                  school.studentQuality ?? existing.studentQuality,
                resources: school.resources ?? existing.resources,
                gradeInflation:
                  school.gradeInflation ?? existing.gradeInflation,
                avgSatScore: school.avgSatScore ?? existing.avgSatScore,
                avgIbScore: school.avgIbScore ?? existing.avgIbScore,
                annualTop30Count:
                  school.annualTop30Count ?? existing.annualTop30Count,
                tier: clean.tier,
                qualityScore: clean.qualityScore,
                qualityGrade: clean.qualityGrade,
                hsImpactEnabled: clean.hsImpactEnabled,
                evaluatedAt: new Date(),
                evaluatedBy,
              },
            });

            this.emitPostSaveEvents(
              existing.id,
              existing.name,
              processed,
              evaluatedBy,
            );
            updated++;
          } else {
            skipped++;
          }
        } else {
          const processed = this.beforeSave({ ...school }, 'import');
          const clean = this.stripEventFields(processed);

          const hs = await this.prisma.highSchool.create({
            data: {
              name: school.name,
              nameZh: school.nameZh ?? undefined,
              abbreviation: school.abbreviation ?? undefined,
              country: school.country,
              state: school.state ?? undefined,
              city: school.city ?? undefined,
              type: school.type as HighSchoolType,
              tier: clean.tier ?? school.tier ?? 3,
              description: school.description ?? undefined,
              website: school.website ?? undefined,
              recognition: school.recognition ?? undefined,
              academicRigor: school.academicRigor ?? undefined,
              placementRecord: school.placementRecord ?? undefined,
              studentQuality: school.studentQuality ?? undefined,
              resources: school.resources ?? undefined,
              gradeInflation: school.gradeInflation ?? undefined,
              avgSatScore: school.avgSatScore ?? undefined,
              avgIbScore: school.avgIbScore ?? undefined,
              annualTop30Count: school.annualTop30Count ?? undefined,
              qualityScore: clean.qualityScore,
              qualityGrade: clean.qualityGrade,
              hsImpactEnabled: clean.hsImpactEnabled,
              evaluatedAt: school.recognition ? new Date() : undefined,
              evaluatedBy: school.recognition ? evaluatedBy : undefined,
            },
          });

          this.emitPostSaveEvents(hs.id, hs.name, processed, evaluatedBy);
          created++;
        }
      } catch (error) {
        errors.push({
          name: school.name ?? 'unknown',
          error: (error as Error).message,
        });
      }
    }

    return { created, updated, skipped, errors };
  }
}
