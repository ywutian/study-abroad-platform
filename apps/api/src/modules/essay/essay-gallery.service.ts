import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parseEssayProvenance } from '@study-abroad/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { EssayAiService, PARAGRAPH_PROMPT_VERSION } from './essay-ai.service';
import { PointsService, PointAction } from '../points/incentive.service';
import { safeRefund } from '../points/refund.helper';
import {
  CASE_PUBLIC_WHERE,
  GALLERY_LIST_SELECT,
  GALLERY_DETAIL_SELECT,
} from './constants/essay-gallery.constants';

/**
 * Shape of `AdmissionCase.aiAnalysisCache[locale]`. Stored as a `Json?` column
 * (Prisma sees it as `Prisma.JsonValue`), validated narrowly here before use.
 */
interface CachedAnalysisEntry {
  promptVersion: string;
  model?: string;
  generatedAt: string;
  payload: unknown;
}

@Injectable()
export class EssayGalleryService {
  private readonly logger = new Logger(EssayGalleryService.name);

  constructor(
    private prisma: PrismaService,
    private essayAiService: EssayAiService,
    private pointsService: PointsService,
  ) {}

  /**
   * 获取公开优秀文书列表
   * 来源：录取案例中公开分享的文书
   */
  async getGalleryEssays(filters: {
    school?: string;
    type?: 'COMMON_APP' | 'UC' | 'SUPPLEMENTAL' | 'WHY_SCHOOL' | 'OTHER';
    promptNumber?: number;
    year?: number;
    result?: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';
    rankMin?: number;
    rankMax?: number;
    isVerified?: boolean;
    sortBy?: 'newest' | 'popular';
    page: number;
    pageSize: number;
  }) {
    const {
      school,
      type,
      promptNumber,
      year,
      result,
      rankMin,
      rankMax,
      isVerified,
      sortBy,
      page,
      pageSize,
    } = filters;
    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const where: any = { ...CASE_PUBLIC_WHERE };

    // 文书类型筛选
    if (type) {
      where.essayType = type;
    }

    // Common App/UC 题号筛选
    if (promptNumber) {
      where.promptNumber = promptNumber;
    }

    // 年份筛选
    if (year) {
      where.year = year;
    }

    // 录取结果筛选
    if (result) {
      where.result = result;
    }

    // 仅显示已验证
    if (isVerified) {
      where.isVerified = true;
    }

    // 学校名称搜索
    if (school) {
      where.school = {
        OR: [
          { name: { contains: school, mode: 'insensitive' } },
          { nameZh: { contains: school, mode: 'insensitive' } },
        ],
      };
    }

    // 学校排名范围筛选
    if (rankMin !== undefined || rankMax !== undefined) {
      where.school = {
        ...where.school,
        usNewsRank: {
          ...(rankMin !== undefined && { gte: rankMin }),
          ...(rankMax !== undefined && { lte: rankMax }),
        },
      };
    }

    // 排序逻辑
    const orderBy =
      sortBy === 'popular'
        ? [{ isVerified: 'desc' as const }, { createdAt: 'desc' as const }]
        : [{ createdAt: 'desc' as const }, { isVerified: 'desc' as const }];

    const [cases, total, stats] = await Promise.all([
      this.prisma.admissionCase.findMany({
        where,
        select: GALLERY_LIST_SELECT,
        skip,
        take: pageSize,
        orderBy,
      }),
      this.prisma.admissionCase.count({ where }),
      this.getGalleryStats(),
    ]);

    // 处理返回数据
    const essays = cases.map((c) => {
      const provenance = this.resolveProvenance(c);
      return {
        id: c.id,
        year: c.year,
        result: c.result,
        essayType: c.essayType,
        promptNumber: c.promptNumber,
        prompt: c.essayPrompt,
        preview: c.essayContent ? c.essayContent.slice(0, 200) + '...' : null,
        wordCount: c.essayContent ? c.essayContent.split(/\s+/).length : 0,
        school: c.school,
        tags: c.tags,
        isVerified: c.isVerified,
        sourceArchive: provenance.archive,
        sourceUrl: provenance.url,
        sourceAuthor: provenance.author,
      };
    });

    // Best-effort backfill: hot-write the parsed provenance into the
    // dedicated columns when they were null on the DB row. Future reads
    // skip the parse step. Failures are silently swallowed — the response
    // already carries the resolved values.
    void this.backfillProvenance(cases);

    return {
      items: essays,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats,
    };
  }

  /**
   * Find the published rejected/waitlisted essays for the "文书避雷" tab.
   *
   * Editorial rule (enforced upstream in seed scripts + import paths):
   *   - Only self-uploaded rejected essays land here — we never harvest.
   *   - At launch this query returns ~0 rows; the empty state in the UI
   *     invites learners to submit.
   */
  async getRejectedEssays(filters: { page: number; pageSize: number }) {
    const { page, pageSize } = filters;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AdmissionCaseWhereInput = {
      ...CASE_PUBLIC_WHERE,
      result: { in: ['REJECTED', 'WAITLISTED'] },
    };

    const [cases, total] = await Promise.all([
      this.prisma.admissionCase.findMany({
        where,
        select: GALLERY_LIST_SELECT,
        skip,
        take: pageSize,
        orderBy: [
          { isVerified: 'desc' as const },
          { createdAt: 'desc' as const },
        ],
      }),
      this.prisma.admissionCase.count({ where }),
    ]);

    const essays = cases.map((c) => {
      const provenance = this.resolveProvenance(c);
      return {
        id: c.id,
        year: c.year,
        result: c.result,
        essayType: c.essayType,
        promptNumber: c.promptNumber,
        prompt: c.essayPrompt,
        preview: c.essayContent ? c.essayContent.slice(0, 200) + '...' : null,
        wordCount: c.essayContent ? c.essayContent.split(/\s+/).length : 0,
        school: c.school,
        tags: c.tags,
        isVerified: c.isVerified,
        sourceArchive: provenance.archive,
        sourceUrl: provenance.url,
        sourceAuthor: provenance.author,
      };
    });

    return {
      items: essays,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Pull provenance from the dedicated columns first, fall back to parsing
   * the `tags` array (legacy rows). Always returns a structured triple
   * (any field can be null) so callers don't have to guard each property.
   */
  private resolveProvenance(c: {
    sourceArchive?: string | null;
    sourceUrl?: string | null;
    sourceAuthor?: string | null;
    tags: string[];
  }): { archive: string | null; url: string | null; author: string | null } {
    if (c.sourceArchive || c.sourceUrl) {
      return {
        archive: c.sourceArchive ?? null,
        url: c.sourceUrl ?? null,
        author: c.sourceAuthor ?? null,
      };
    }
    return parseEssayProvenance(c.tags);
  }

  /**
   * Write parsed provenance into the dedicated columns. Best-effort: any
   * write error is logged and silently dropped — the served response
   * already carries the resolved values.
   *
   * We only update rows where:
   *   - The provenance columns are currently null, AND
   *   - The tag parser actually found a URL (no point writing an empty row).
   *
   * Run inside an `updateMany` batched-by-id loop, capped at the page size,
   * so a single gallery list query at worst writes 50 rows.
   */
  private async backfillProvenance(
    cases: Array<{
      id: string;
      sourceArchive?: string | null;
      sourceUrl?: string | null;
      sourceAuthor?: string | null;
      tags: string[];
    }>,
  ): Promise<void> {
    const updates = cases
      .filter((c) => !c.sourceArchive && !c.sourceUrl)
      .map((c) => ({ id: c.id, parsed: parseEssayProvenance(c.tags) }))
      .filter((u) => u.parsed.url !== null);

    if (updates.length === 0) return;

    try {
      await Promise.all(
        updates.map((u) =>
          this.prisma.admissionCase.update({
            where: { id: u.id },
            data: {
              sourceArchive: u.parsed.archive,
              sourceUrl: u.parsed.url,
              sourceAuthor: u.parsed.author,
            },
          }),
        ),
      );
    } catch (err) {
      this.logger.warn(`Provenance backfill failed: ${(err as Error).message}`);
    }
  }

  /**
   * 获取文书画廊统计数据
   */
  private async getGalleryStats() {
    const baseWhere = { ...CASE_PUBLIC_WHERE };

    const [total, admitted, top20, byType] = await Promise.all([
      this.prisma.admissionCase.count({ where: baseWhere }),
      this.prisma.admissionCase.count({
        where: { ...baseWhere, result: 'ADMITTED' },
      }),
      this.prisma.admissionCase.count({
        where: {
          ...baseWhere,
          school: { usNewsRank: { lte: 20 } },
        },
      }),
      this.prisma.admissionCase.groupBy({
        by: ['essayType'],
        where: baseWhere,
        _count: true,
      }),
    ]);

    return {
      total,
      admitted,
      top20,
      byType: byType.reduce(
        (acc, item) => {
          if (item.essayType) {
            acc[item.essayType] = item._count;
          }
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  /**
   * 获取单篇公开文书详情
   */
  async getGalleryEssayDetail(caseId: string) {
    const admissionCase = await this.prisma.admissionCase.findFirst({
      where: {
        id: caseId,
        ...CASE_PUBLIC_WHERE,
      },
      select: GALLERY_DETAIL_SELECT,
    });

    if (!admissionCase) {
      throw new NotFoundException('Essay not found or not public');
    }

    const provenance = this.resolveProvenance(admissionCase);
    // Best-effort write-through to the dedicated columns. See note on
    // backfillProvenance — never throws to the user.
    void this.backfillProvenance([admissionCase]);

    return {
      id: admissionCase.id,
      year: admissionCase.year,
      round: admissionCase.round,
      result: admissionCase.result,
      essayType: admissionCase.essayType,
      promptNumber: admissionCase.promptNumber,
      prompt: admissionCase.essayPrompt,
      content: admissionCase.essayContent,
      wordCount: admissionCase.essayContent?.split(/\s+/).length || 0,
      gpaRange: admissionCase.gpaRange,
      satRange: admissionCase.satRange,
      school: admissionCase.school,
      tags: admissionCase.tags,
      isVerified: admissionCase.isVerified,
      isAnonymous: admissionCase.visibility === 'ANONYMOUS',
      sourceArchive: provenance.archive,
      sourceUrl: provenance.url,
      sourceAuthor: provenance.author,
      selfReflection: admissionCase.selfReflection ?? null,
    };
  }

  /**
   * 逐段分析公开文书
   *
   * Decision tree (PR 1 fix #4 — gallery analysis cache):
   *   1. Caller passed a custom `schoolName` that differs from the canonical
   *      school name? → custom-fit run: bypass cache, fresh LLM call, no
   *      cache write. (Still charges points — same behaviour as before.)
   *   2. Canonical run + cache hit for this locale + version matches? → serve
   *      from `aiAnalysisCache[locale]` immediately. Returns `cached: true`.
   *      Points still charged (per product spec — keep cost at 20).
   *   3. Cache miss / stale version → fresh LLM call, conditional JSON merge
   *      into `aiAnalysisCache[locale]` so the next caller gets the hot path.
   */
  async analyzeGalleryEssay(
    userId: string,
    caseId: string,
    schoolName?: string,
    locale = 'zh',
  ) {
    await this.pointsService.charge(userId, PointAction.AI_ESSAY_GALLERY);

    const essay = await this.prisma.admissionCase.findFirst({
      where: {
        id: caseId,
        ...CASE_PUBLIC_WHERE,
      },
      select: GALLERY_DETAIL_SELECT,
    });

    if (!essay) {
      await safeRefund(
        this.pointsService,
        userId,
        PointAction.AI_ESSAY_GALLERY,
        this.logger,
      );
      throw new NotFoundException('Essay not found or not public');
    }

    if (!essay.essayContent) {
      await safeRefund(
        this.pointsService,
        userId,
        PointAction.AI_ESSAY_GALLERY,
        this.logger,
      );
      throw new BadRequestException('Essay content is empty');
    }

    const canonicalSchoolName = essay.school?.name;
    const isCustomFit = Boolean(
      schoolName && canonicalSchoolName && schoolName !== canonicalSchoolName,
    );

    // ── Path 1: custom-fit run — bypass cache entirely ────────────────────
    if (isCustomFit) {
      try {
        const analysis = await this.essayAiService.analyzeEssayParagraphs(
          essay.essayContent,
          essay.essayPrompt || undefined,
          schoolName,
          locale,
        );
        return {
          essayId: caseId,
          ...analysis,
          tokenUsed: this.estimateTokens(essay.essayContent),
          cached: false,
        };
      } catch (error) {
        await safeRefund(
          this.pointsService,
          userId,
          PointAction.AI_ESSAY_GALLERY,
          this.logger,
        );
        this.logger.error('Gallery essay analysis (custom-fit) failed', error);
        throw new BadRequestException('Failed to analyze essay');
      }
    }

    // ── Path 2: canonical run — try cache ─────────────────────────────────
    const cacheBlob = essay.aiAnalysisCache;
    const cachedEntry = this.readCacheEntry(cacheBlob, locale);
    if (cachedEntry && cachedEntry.promptVersion === PARAGRAPH_PROMPT_VERSION) {
      this.logger.debug(
        `Gallery analysis cache HIT case=${caseId} locale=${locale}`,
      );
      return {
        essayId: caseId,
        ...(cachedEntry.payload as Record<string, unknown>),
        tokenUsed: this.estimateTokens(essay.essayContent),
        cached: true,
        generatedAt: cachedEntry.generatedAt,
      };
    }

    // ── Path 3: cache miss — fresh LLM call + write-through ───────────────
    try {
      const analysis = await this.essayAiService.analyzeEssayParagraphs(
        essay.essayContent,
        essay.essayPrompt || undefined,
        canonicalSchoolName,
        locale,
      );

      // Write-through: merge the new entry into aiAnalysisCache[locale].
      // Use a conditional JSON merge so concurrent writers don't clobber
      // each other's locales. The cache key is `<caseId, locale>`; we never
      // overwrite a sibling locale.
      const newEntry: CachedAnalysisEntry = {
        promptVersion: PARAGRAPH_PROMPT_VERSION,
        generatedAt: new Date().toISOString(),
        payload: analysis,
      };
      const nextCache = this.mergeCacheEntry(cacheBlob, locale, newEntry);
      try {
        await this.prisma.admissionCase.update({
          where: { id: caseId },
          // Cast through `unknown` because `CachedAnalysisEntry` is a private
          // app-side shape; Prisma's `InputJsonValue` is a recursive structural
          // type and TS can't see the mapping without the double cast.
          data: {
            aiAnalysisCache: nextCache as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (writeErr) {
        // Cache write is best-effort. If it fails, the user still gets their
        // analysis result; the next caller just takes the slow path again.
        this.logger.warn(
          `Failed to persist gallery analysis cache for case=${caseId} locale=${locale}: ${(writeErr as Error).message}`,
        );
      }

      return {
        essayId: caseId,
        ...analysis,
        tokenUsed: this.estimateTokens(essay.essayContent),
        cached: false,
      };
    } catch (error) {
      await safeRefund(
        this.pointsService,
        userId,
        PointAction.AI_ESSAY_GALLERY,
        this.logger,
      );
      this.logger.error('Gallery essay analysis failed', error);
      throw new BadRequestException('Failed to analyze essay');
    }
  }

  /**
   * Narrowly validate a cache entry pulled out of the JSON column before we
   * trust it. Anything that doesn't fit the shape is treated as a miss.
   */
  private readCacheEntry(
    cacheBlob: Prisma.JsonValue | null | undefined,
    locale: string,
  ): CachedAnalysisEntry | null {
    if (
      !cacheBlob ||
      typeof cacheBlob !== 'object' ||
      Array.isArray(cacheBlob)
    ) {
      return null;
    }
    const entry = (cacheBlob as Record<string, unknown>)[locale];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return null;
    }
    const e = entry as Record<string, unknown>;
    if (
      typeof e.promptVersion !== 'string' ||
      typeof e.generatedAt !== 'string' ||
      e.payload == null
    ) {
      return null;
    }
    return {
      promptVersion: e.promptVersion,
      model: typeof e.model === 'string' ? e.model : undefined,
      generatedAt: e.generatedAt,
      payload: e.payload,
    };
  }

  /**
   * Produce the next value for `aiAnalysisCache` with the new entry merged
   * under `locale`. Never blows away other locales.
   */
  private mergeCacheEntry(
    cacheBlob: Prisma.JsonValue | null | undefined,
    locale: string,
    entry: CachedAnalysisEntry,
  ): Record<string, CachedAnalysisEntry> {
    // We only narrow the runtime shape — Prisma's `JsonObject` is structurally
    // wider than `CachedAnalysisEntry`, so route through `unknown` to keep TS
    // honest while preserving any sibling locales we've already cached.
    const base: Record<string, CachedAnalysisEntry> =
      cacheBlob && typeof cacheBlob === 'object' && !Array.isArray(cacheBlob)
        ? {
            ...(cacheBlob as unknown as Record<string, CachedAnalysisEntry>),
          }
        : {};
    base[locale] = entry;
    return base;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 3);
  }
}
