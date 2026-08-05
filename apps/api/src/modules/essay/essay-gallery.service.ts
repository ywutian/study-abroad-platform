import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type AdminEssayGalleryAIMetricsResponse,
  parseEssayProvenance,
  type GalleryEssayCompareRequest,
  type GalleryEssayCompareResponse,
  type GalleryEssayOverlapRisk,
  type GalleryEssayEvidence,
  type GalleryEssayInteractionFeedbackRequest,
  type GalleryEssayInteractionFeedbackResponse,
  type GalleryEssayAIInteractionItem,
  type GalleryEssayAIInteractionType,
  type GalleryEssayFeedbackCategory,
  type GalleryEssayInteractionsResponse,
  type GalleryEssayQuestionRequest,
  type GalleryEssayQuestionResponse,
  type GalleryLearningNotesPayload,
  type GalleryLearningNotesResponse,
} from '@study-abroad/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { EssayAiService, PARAGRAPH_PROMPT_VERSION } from './essay-ai.service';
import { PointsService, PointAction } from '../points/incentive.service';
import { safeRefund } from '../points/refund.helper';
import { LLMService } from '../ai-agent/core/llm.service';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import {
  buildGalleryCompareSystemPrompt,
  buildGalleryQuestionSystemPrompt,
} from './essay-ai.prompts';
import {
  CASE_PUBLIC_WHERE,
  GALLERY_LIST_SELECT,
  GALLERY_DETAIL_SELECT,
} from './constants/essay-gallery.constants';
import { FeatureFlagService } from '../../common/feature-flags/feature-flag.service';
// Same AdmissionCase.tags array the case list strips; the gallery is the other
// unauthenticated surface that emits it. See stripInternalTags for why.
import { stripInternalTags } from '../case/case.constants';

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

const GALLERY_PERSONALIZED_TOOLS_FLAG = 'essay_gallery_personalized_tools_v1';

type GalleryInteractionWithFeedback =
  Prisma.GalleryEssayAIInteractionGetPayload<{
    include: { feedback: true };
  }>;

type GalleryDetailCase = Prisma.AdmissionCaseGetPayload<{
  select: typeof GALLERY_DETAIL_SELECT;
}>;

@Injectable()
export class EssayGalleryService {
  private readonly logger = new Logger(EssayGalleryService.name);

  constructor(
    private prisma: PrismaService,
    private essayAiService: EssayAiService,
    private pointsService: PointsService,
    private llmService: LLMService,
    @Optional()
    private readonly featureFlagService?: FeatureFlagService,
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
      // governance: public-feed — spreads CASE_PUBLIC_WHERE — AdmissionCase.visibility defaults to PRIVATE, so that spread is what keeps unpublished essays out
      this.prisma.admissionCase.findMany({
        where,
        select: GALLERY_LIST_SELECT,
        skip,
        take: pageSize,
        orderBy,
      }),
      // governance: public-feed — spreads CASE_PUBLIC_WHERE — AdmissionCase.visibility defaults to PRIVATE, so that spread is what keeps unpublished essays out
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
        tags: stripInternalTags({ tags: c.tags }).tags,
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
      // governance: public-feed — spreads CASE_PUBLIC_WHERE — AdmissionCase.visibility defaults to PRIVATE, so that spread is what keeps unpublished essays out
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
      // governance: public-feed — spreads CASE_PUBLIC_WHERE — AdmissionCase.visibility defaults to PRIVATE, so that spread is what keeps unpublished essays out
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
        tags: stripInternalTags({ tags: c.tags }).tags,
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
          // governance: parent-scoped — writes derived provenance columns back onto rows the caller already fetched through a CASE_PUBLIC_WHERE query
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
      // governance: public-feed — spreads CASE_PUBLIC_WHERE — AdmissionCase.visibility defaults to PRIVATE, so that spread is what keeps unpublished essays out
      this.prisma.admissionCase.count({ where: baseWhere }),
      // governance: public-feed — spreads CASE_PUBLIC_WHERE — AdmissionCase.visibility defaults to PRIVATE, so that spread is what keeps unpublished essays out
      this.prisma.admissionCase.count({
        where: { ...baseWhere, result: 'ADMITTED' },
      }),
      // governance: public-feed — spreads CASE_PUBLIC_WHERE — AdmissionCase.visibility defaults to PRIVATE, so that spread is what keeps unpublished essays out
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
    // governance: public-feed — spreads CASE_PUBLIC_WHERE — AdmissionCase.visibility defaults to PRIVATE, so that spread is what keeps unpublished essays out
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
   * Public, free, read-only learning notes for a gallery essay.
   *
   * This intentionally does not call the LLM and does not charge points. The
   * notes are shared study material generated by the existing precompute path.
   */
  async getGalleryLearningNotes(
    caseId: string,
    locale = 'zh',
  ): Promise<GalleryLearningNotesResponse> {
    const requestedLocale = locale === 'en' ? 'en' : 'zh';
    // governance: public-feed — spreads CASE_PUBLIC_WHERE — AdmissionCase.visibility defaults to PRIVATE, so that spread is what keeps unpublished essays out
    const essay = await this.prisma.admissionCase.findFirst({
      where: {
        id: caseId,
        ...CASE_PUBLIC_WHERE,
      },
      select: GALLERY_DETAIL_SELECT,
    });

    if (!essay) {
      throw new NotFoundException('Essay not found or not public');
    }

    const cacheHit = this.findLearningNotesCacheEntry(
      essay.aiAnalysisCache,
      requestedLocale,
    );
    const cachedEntry = cacheHit?.entry;
    if (
      !cachedEntry ||
      cachedEntry.promptVersion !== PARAGRAPH_PROMPT_VERSION ||
      !this.isLearningNotesPayload(cachedEntry.payload)
    ) {
      return {
        essayId: caseId,
        status: 'unavailable',
        promptVersion: PARAGRAPH_PROMPT_VERSION,
        cached: false,
        requestedLocale,
        fallbackUsed: false,
      };
    }

    return {
      essayId: caseId,
      status: 'ready',
      promptVersion: cachedEntry.promptVersion,
      generatedAt: cachedEntry.generatedAt,
      cached: true,
      requestedLocale,
      sourceLocale: cacheHit.locale,
      fallbackUsed: cacheHit.locale !== requestedLocale,
      payload: cachedEntry.payload,
    };
  }

  async askGalleryEssay(
    userId: string,
    caseId: string,
    dto: GalleryEssayQuestionRequest,
    locale = 'zh',
  ): Promise<GalleryEssayQuestionResponse> {
    const question = dto.question?.trim();
    if (!question) {
      throw new BadRequestException('Question is required');
    }

    await this.ensurePersonalizedGalleryToolsEnabled(userId);
    const essay = await this.getPublicGalleryCaseForAi(caseId);
    const clientRequestId = this.normalizeClientRequestId(dto.clientRequestId);
    const existing = await this.findExistingGalleryInteraction(
      userId,
      caseId,
      'question',
      clientRequestId,
    );
    if (existing) {
      return this.toGalleryQuestionResponse(existing);
    }

    const learningNotes = this.getCachedLearningNotes(essay, locale);
    const interaction = await this.prisma.galleryEssayAIInteraction.create({
      data: {
        userId,
        admissionCaseId: caseId,
        type: 'question',
        status: 'PENDING',
        locale: locale === 'en' ? 'en' : 'zh',
        question,
        paragraphIndex: dto.paragraphIndex,
        selectedText: dto.selectedText?.trim() || null,
        clientRequestId,
        pointsAction: PointAction.AI_ESSAY_GALLERY_ASK,
        input: {
          question,
          paragraphIndex: dto.paragraphIndex ?? null,
          selectedText: dto.selectedText?.trim() || null,
          clientRequestId,
        },
      },
    });
    let chargeResult: { pointHistoryId?: string; points?: number } | null =
      null;
    try {
      chargeResult = await this.pointsService.charge(
        userId,
        PointAction.AI_ESSAY_GALLERY_ASK,
        {
          galleryEssayId: caseId,
          interactionId: interaction.id,
          clientRequestId,
          interactionType: 'question',
        },
      );
      await this.prisma.galleryEssayAIInteraction.update({
        where: { id: interaction.id },
        data: {
          pointsHistoryId: chargeResult.pointHistoryId,
          pointsCharged: Math.abs(chargeResult.points ?? 0) || null,
        },
      });
      const prompt = this.buildGalleryQuestionUserPrompt(
        essay,
        question,
        dto.paragraphIndex,
        dto.selectedText,
        learningNotes,
        locale,
      );

      const raw = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: buildGalleryQuestionSystemPrompt(locale) },
          { role: 'user', content: prompt },
        ],
        {
          userId,
          temperature: 0.25,
          maxTokens: 1200,
        },
      );
      // `?? {}` preserves what this did before: on an unparseable response the
      // util used to hand back `{ result: <prose> }`, so every optional field
      // below read `undefined` and the normalisers degraded to empty. Same
      // outcome, without the util asserting a shape it never checked.
      const parsed =
        extractJsonFromLlm<{
          answer?: unknown;
          evidence?: unknown;
          followUps?: unknown;
        }>(raw) ?? {};
      const evidence = this.verifyEvidence(
        this.normalizeEvidence(parsed.evidence, {
          fallbackQuote: dto.selectedText || essay.essayContent || '',
          allowedSources: ['essay', 'learning_notes', 'case_context'],
        }),
        {
          essay: essay.essayContent || '',
          learning_notes: learningNotes ? JSON.stringify(learningNotes) : '',
          case_context: JSON.stringify(this.galleryMetadata(essay)),
        },
        {
          fallbackSource: 'essay',
          fallbackQuote: dto.selectedText || essay.essayContent || '',
        },
      );
      const followUps = this.normalizeStringArray(parsed.followUps, 4);
      const answer =
        typeof parsed.answer === 'string' && parsed.answer.trim()
          ? parsed.answer.trim()
          : locale === 'zh'
            ? '我只能基于这篇公开范文和已有拆解作答。请换一个更具体的问题，例如询问开头、结构或某一段的作用。'
            : 'I can only answer from the public essay and existing notes. Try a more specific question about the opening, structure, or one paragraph.';
      const tokensUsed = this.estimateTokens(`${prompt}\n${raw}`);

      await this.prisma.galleryEssayAIInteraction.update({
        where: { id: interaction.id },
        data: {
          status: 'SUCCEEDED',
          output: {
            answer,
            evidence,
            followUps,
          } as unknown as Prisma.InputJsonValue,
          evidence: evidence as unknown as Prisma.InputJsonValue,
          tokensUsed,
          refundStatus: 'NOT_NEEDED',
        },
      });

      return {
        essayId: caseId,
        interactionId: interaction.id,
        answer,
        evidence,
        followUps,
        tokensUsed,
      };
    } catch (error) {
      const refundResult = chargeResult
        ? await safeRefund(
            this.pointsService,
            userId,
            PointAction.AI_ESSAY_GALLERY_ASK,
            this.logger,
            {
              galleryEssayId: caseId,
              interactionId: interaction.id,
              clientRequestId,
            },
          )
        : null;
      await this.markGalleryInteractionFailed(interaction.id, error, {
        refundStatus: chargeResult ? 'REFUNDED' : 'NOT_NEEDED',
        refundPointHistoryId: refundResult?.pointHistoryId,
      });
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Gallery essay question failed', error);
      throw new BadRequestException('Failed to answer gallery essay question');
    }
  }

  async compareGalleryEssay(
    userId: string,
    caseId: string,
    dto: GalleryEssayCompareRequest,
    locale = 'zh',
  ): Promise<GalleryEssayCompareResponse> {
    if (!dto.userEssayId?.trim()) {
      throw new BadRequestException('userEssayId is required');
    }

    await this.ensurePersonalizedGalleryToolsEnabled(userId);
    const [galleryEssay, userEssay] = await Promise.all([
      this.getPublicGalleryCaseForAi(caseId),
      this.prisma.essay.findFirst({
        where: { id: dto.userEssayId, profile: { userId } },
        select: {
          id: true,
          title: true,
          prompt: true,
          content: true,
          wordCount: true,
          schoolId: true,
        },
      }),
    ]);

    if (!userEssay) {
      throw new BadRequestException(
        'You do not have permission to access this essay',
      );
    }

    const clientRequestId = this.normalizeClientRequestId(dto.clientRequestId);
    const existing = await this.findExistingGalleryInteraction(
      userId,
      caseId,
      'compare',
      clientRequestId,
    );
    if (existing) {
      return this.toGalleryCompareResponse(existing);
    }

    const learningNotes = this.getCachedLearningNotes(galleryEssay, locale);
    const focus = dto.focus ?? 'structure';
    const interaction = await this.prisma.galleryEssayAIInteraction.create({
      data: {
        userId,
        admissionCaseId: caseId,
        type: 'compare',
        status: 'PENDING',
        locale: locale === 'en' ? 'en' : 'zh',
        focus,
        userEssayId: userEssay.id,
        clientRequestId,
        pointsAction: PointAction.AI_ESSAY_COMPARE,
        input: {
          galleryEssayId: caseId,
          userEssayId: userEssay.id,
          focus,
          clientRequestId,
        },
      },
    });
    let chargeResult: { pointHistoryId?: string; points?: number } | null =
      null;
    try {
      chargeResult = await this.pointsService.charge(
        userId,
        PointAction.AI_ESSAY_COMPARE,
        {
          galleryEssayId: caseId,
          userEssayId: userEssay.id,
          interactionId: interaction.id,
          clientRequestId,
          interactionType: 'compare',
          focus,
        },
      );
      await this.prisma.galleryEssayAIInteraction.update({
        where: { id: interaction.id },
        data: {
          pointsHistoryId: chargeResult.pointHistoryId,
          pointsCharged: Math.abs(chargeResult.points ?? 0) || null,
        },
      });
      const prompt = this.buildGalleryCompareUserPrompt(
        galleryEssay,
        userEssay,
        focus,
        learningNotes,
        locale,
      );

      const raw = await this.llmService.chatSimpleGuarded(
        [
          { role: 'system', content: buildGalleryCompareSystemPrompt(locale) },
          { role: 'user', content: prompt },
        ],
        {
          userId,
          temperature: 0.25,
          maxTokens: 1600,
        },
      );
      const parsed =
        extractJsonFromLlm<{
          referenceSignals?: unknown;
          gapAnalysis?: unknown;
          overlapWarnings?: unknown;
          overlapRisk?: unknown;
          overlapRiskReason?: unknown;
          revisionActions?: unknown;
          evidence?: unknown;
        }>(raw) ?? {};

      const overlapRiskReason = this.clip(
        typeof parsed.overlapRiskReason === 'string'
          ? parsed.overlapRiskReason.trim()
          : '',
        220,
      );
      const responseBody = {
        referenceSignals: this.normalizeStringArray(parsed.referenceSignals, 6),
        gapAnalysis: this.normalizeStringArray(parsed.gapAnalysis, 6),
        overlapWarnings: this.normalizeStringArray(parsed.overlapWarnings, 4),
        overlapRisk: this.normalizeOverlapRisk(parsed.overlapRisk),
        ...(overlapRiskReason ? { overlapRiskReason } : {}),
        revisionActions: this.normalizeStringArray(parsed.revisionActions, 5),
        evidence: this.verifyEvidence(
          this.ensureCompareEvidence(
            this.normalizeEvidence(parsed.evidence, {
              fallbackQuote: userEssay.content,
              allowedSources: [
                'essay',
                'learning_notes',
                'case_context',
                'user_essay',
              ],
            }),
            galleryEssay.essayContent || '',
            userEssay.content,
          ),
          {
            essay: galleryEssay.essayContent || '',
            learning_notes: learningNotes ? JSON.stringify(learningNotes) : '',
            case_context: JSON.stringify(this.galleryMetadata(galleryEssay)),
            user_essay: userEssay.content,
          },
          {
            fallbackSource: 'user_essay',
            fallbackQuote: userEssay.content,
          },
        ),
      };
      const tokensUsed = this.estimateTokens(`${prompt}\n${raw}`);

      const aiResult = await this.prisma.essayAIResult.create({
        data: {
          essayId: userEssay.id,
          type: 'gallery_compare',
          input: JSON.stringify({
            galleryEssayId: caseId,
            userEssayId: userEssay.id,
            focus,
            interactionId: interaction.id,
          }),
          output: JSON.stringify(responseBody),
          scores: { focus },
          suggestions: responseBody.revisionActions,
          tokenUsed: tokensUsed,
        },
      });

      await this.prisma.galleryEssayAIInteraction.update({
        where: { id: interaction.id },
        data: {
          status: 'SUCCEEDED',
          essayAIResultId: aiResult.id,
          output: responseBody as unknown as Prisma.InputJsonValue,
          evidence: responseBody.evidence as unknown as Prisma.InputJsonValue,
          tokensUsed,
          refundStatus: 'NOT_NEEDED',
        },
      });

      return {
        essayId: caseId,
        userEssayId: userEssay.id,
        interactionId: interaction.id,
        ...responseBody,
        tokensUsed,
        resultId: aiResult.id,
      };
    } catch (error) {
      const refundResult = chargeResult
        ? await safeRefund(
            this.pointsService,
            userId,
            PointAction.AI_ESSAY_COMPARE,
            this.logger,
            {
              galleryEssayId: caseId,
              userEssayId: userEssay.id,
              interactionId: interaction.id,
              clientRequestId,
            },
          )
        : null;
      await this.markGalleryInteractionFailed(interaction.id, error, {
        refundStatus: chargeResult ? 'REFUNDED' : 'NOT_NEEDED',
        refundPointHistoryId: refundResult?.pointHistoryId,
      });
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Gallery essay compare failed', error);
      throw new BadRequestException('Failed to compare gallery essay');
    }
  }

  async listGalleryEssayInteractions(
    userId: string,
    caseId: string,
    options: { type?: string; limit?: number } = {},
  ): Promise<GalleryEssayInteractionsResponse> {
    const exists = await this.prisma.admissionCase.findFirst({
      where: {
        id: caseId,
        ...CASE_PUBLIC_WHERE,
      },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Essay not found or not public');
    }

    const type =
      options.type === 'question' || options.type === 'compare'
        ? options.type
        : undefined;
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
    const where: Prisma.GalleryEssayAIInteractionWhereInput = {
      userId,
      admissionCaseId: caseId,
      ...(type ? { type } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.galleryEssayAIInteraction.findMany({
        where,
        include: { feedback: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.galleryEssayAIInteraction.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toGalleryInteractionItem(item)),
      total,
      limit,
    };
  }

  async submitGalleryInteractionFeedback(
    userId: string,
    interactionId: string,
    dto: GalleryEssayInteractionFeedbackRequest,
  ): Promise<GalleryEssayInteractionFeedbackResponse> {
    const interaction = await this.prisma.galleryEssayAIInteraction.findFirst({
      where: { id: interactionId, userId },
      select: { id: true },
    });

    if (!interaction) {
      throw new NotFoundException('Gallery essay AI interaction not found');
    }

    const category =
      dto.sentiment === 'NOT_HELPFUL' ? (dto.category ?? 'other') : null;
    const notes = dto.notes?.trim() || null;
    const feedback = await this.prisma.galleryEssayAIInteractionFeedback.upsert(
      {
        where: { interactionId },
        create: {
          interactionId,
          userId,
          sentiment: dto.sentiment,
          category,
          notes,
        },
        update: {
          userId,
          sentiment: dto.sentiment,
          category,
          notes,
        },
      },
    );

    return this.toGalleryInteractionFeedback(feedback);
  }

  async getAdminGalleryAiMetrics(
    options: {
      from?: string;
      to?: string;
    } = {},
  ): Promise<AdminEssayGalleryAIMetricsResponse> {
    const period = this.buildDateRange(options);
    const interactionWhere: Prisma.GalleryEssayAIInteractionWhereInput = period
      ? { createdAt: period }
      : {};
    const feedbackWhere: Prisma.GalleryEssayAIInteractionFeedbackWhereInput =
      period ? { createdAt: period } : {};
    const [
      interactions,
      questions,
      compares,
      succeeded,
      failed,
      refunded,
      tokenStats,
      feedbackBySentiment,
      feedbackByCategoryRaw,
      recentNotHelpfulRaw,
      failedByEssay,
      totalByEssay,
      publicEssays,
    ] = await Promise.all([
      // governance: admin-scope — reached only from admin-essay-gallery-ai.controller — @Roles(Role.OPERATOR) + @RequirePermission(DATA_HEALTH)
      this.prisma.galleryEssayAIInteraction.count({
        where: interactionWhere,
      }),
      // governance: admin-scope — reached only from admin-essay-gallery-ai.controller — @Roles(Role.OPERATOR) + @RequirePermission(DATA_HEALTH)
      this.prisma.galleryEssayAIInteraction.count({
        where: { ...interactionWhere, type: 'question' },
      }),
      // governance: admin-scope — reached only from admin-essay-gallery-ai.controller — @Roles(Role.OPERATOR) + @RequirePermission(DATA_HEALTH)
      this.prisma.galleryEssayAIInteraction.count({
        where: { ...interactionWhere, type: 'compare' },
      }),
      // governance: admin-scope — reached only from admin-essay-gallery-ai.controller — @Roles(Role.OPERATOR) + @RequirePermission(DATA_HEALTH)
      this.prisma.galleryEssayAIInteraction.count({
        where: { ...interactionWhere, status: 'SUCCEEDED' },
      }),
      // governance: admin-scope — reached only from admin-essay-gallery-ai.controller — @Roles(Role.OPERATOR) + @RequirePermission(DATA_HEALTH)
      this.prisma.galleryEssayAIInteraction.count({
        where: { ...interactionWhere, status: 'FAILED' },
      }),
      // governance: admin-scope — reached only from admin-essay-gallery-ai.controller — @Roles(Role.OPERATOR) + @RequirePermission(DATA_HEALTH)
      this.prisma.galleryEssayAIInteraction.count({
        where: {
          ...interactionWhere,
          refundStatus: { in: ['REFUNDED', 'REFUND_ATTEMPTED'] },
        },
      }),
      // governance: admin-scope — reached only from admin-essay-gallery-ai.controller — @Roles(Role.OPERATOR) + @RequirePermission(DATA_HEALTH)
      this.prisma.galleryEssayAIInteraction.aggregate({
        where: interactionWhere,
        _avg: { tokensUsed: true },
      }),
      this.prisma.galleryEssayAIInteractionFeedback.groupBy({
        by: ['sentiment'],
        where: feedbackWhere,
        _count: true,
      }),
      // Category breakdown of NOT_HELPFUL ratings — gives `category` a reader.
      this.prisma.galleryEssayAIInteractionFeedback.groupBy({
        by: ['category'],
        where: { ...feedbackWhere, sentiment: 'NOT_HELPFUL' },
        _count: true,
      }),
      // Recent negative feedback with free-text notes (the qualitative signal).
      // governance: admin-scope — reached only from admin-essay-gallery-ai.controller — @Roles(Role.OPERATOR) + @RequirePermission(DATA_HEALTH)
      this.prisma.galleryEssayAIInteractionFeedback.findMany({
        where: { ...feedbackWhere, sentiment: 'NOT_HELPFUL' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          interactionId: true,
          category: true,
          notes: true,
          createdAt: true,
          interaction: { select: { admissionCaseId: true, type: true } },
        },
      }),
      // Per-essay failure drill-down (actionable: which essays drive failures).
      this.prisma.galleryEssayAIInteraction.groupBy({
        by: ['admissionCaseId'],
        where: { ...interactionWhere, status: 'FAILED' },
        _count: true,
      }),
      this.prisma.galleryEssayAIInteraction.groupBy({
        by: ['admissionCaseId'],
        where: interactionWhere,
        _count: true,
      }),
      // governance: admin-scope — reached only from admin-essay-gallery-ai.controller — @Roles(Role.OPERATOR) + @RequirePermission(DATA_HEALTH)
      this.prisma.admissionCase.findMany({
        where: CASE_PUBLIC_WHERE,
        select: { aiAnalysisCache: true },
      }),
    ]);

    const helpful =
      feedbackBySentiment.find((item) => item.sentiment === 'HELPFUL')
        ?._count ?? 0;
    const notHelpful =
      feedbackBySentiment.find((item) => item.sentiment === 'NOT_HELPFUL')
        ?._count ?? 0;
    const feedback = helpful + notHelpful;
    const readyCount = publicEssays.filter((essay) =>
      this.hasCurrentLearningNotesForAnyLocale(essay.aiAnalysisCache),
    ).length;
    const publicEssayCount = publicEssays.length;
    const missingCount = Math.max(publicEssayCount - readyCount, 0);

    const feedbackByCategory = feedbackByCategoryRaw
      .filter((row) => row.category)
      .map((row) => ({
        category: row.category as GalleryEssayFeedbackCategory,
        count: row._count,
      }))
      .sort((a, b) => b.count - a.count);

    const recentNotHelpful = recentNotHelpfulRaw.map((row) => ({
      interactionId: row.interactionId,
      essayId: row.interaction.admissionCaseId,
      type: row.interaction.type as GalleryEssayAIInteractionType,
      category: (row.category ?? null) as GalleryEssayFeedbackCategory | null,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    }));

    const totalByEssayMap = new Map(
      totalByEssay.map((row) => [row.admissionCaseId, row._count]),
    );
    const topFailingEssays = failedByEssay
      .map((row) => ({
        essayId: row.admissionCaseId,
        failed: row._count,
        total: totalByEssayMap.get(row.admissionCaseId) ?? row._count,
      }))
      .sort((a, b) => b.failed - a.failed)
      .slice(0, 10);

    return {
      generatedAt: new Date().toISOString(),
      period: {
        from:
          period?.gte instanceof Date ? period.gte.toISOString() : undefined,
        to: period?.lte instanceof Date ? period.lte.toISOString() : undefined,
      },
      totals: {
        interactions,
        questions,
        compares,
        succeeded,
        failed,
        refunded,
        feedback,
        helpful,
        notHelpful,
      },
      rates: {
        helpfulRate: feedback > 0 ? helpful / feedback : 0,
        failureRate: interactions > 0 ? failed / interactions : 0,
      },
      tokens: {
        average: Math.round(tokenStats._avg.tokensUsed ?? 0),
      },
      learningNotes: {
        publicEssayCount,
        readyCount,
        missingCount,
        missingRate: publicEssayCount > 0 ? missingCount / publicEssayCount : 0,
      },
      feedbackByCategory,
      recentNotHelpful,
      topFailingEssays,
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

  private async ensurePersonalizedGalleryToolsEnabled(
    userId: string,
  ): Promise<void> {
    if (!this.featureFlagService) return;
    const enabled = await this.featureFlagService.isEnabled(
      GALLERY_PERSONALIZED_TOOLS_FLAG,
      { userId },
    );
    if (!enabled) {
      throw new BadRequestException(
        'Essay gallery AI tools are temporarily unavailable',
      );
    }
  }

  private normalizeClientRequestId(value: unknown): string | null {
    return typeof value === 'string' && value.trim()
      ? this.clip(value.trim(), 128)
      : null;
  }

  private buildDateRange(options: {
    from?: string;
    to?: string;
  }): Prisma.DateTimeFilter | null {
    const range: Prisma.DateTimeFilter = {};
    const from = options.from ? new Date(options.from) : null;
    const to = options.to ? new Date(options.to) : null;
    if (from && !Number.isNaN(from.getTime())) {
      range.gte = from;
    }
    if (to && !Number.isNaN(to.getTime())) {
      range.lte = to;
    }
    return range.gte || range.lte ? range : null;
  }

  private async findExistingGalleryInteraction(
    userId: string,
    caseId: string,
    type: 'question' | 'compare',
    clientRequestId: string | null,
  ): Promise<GalleryInteractionWithFeedback | null> {
    if (!clientRequestId) return null;
    const existing = await this.prisma.galleryEssayAIInteraction.findFirst({
      where: { userId, admissionCaseId: caseId, type, clientRequestId },
      include: { feedback: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!existing) return null;
    if (existing.status === 'SUCCEEDED') return existing;
    if (existing.status === 'PENDING') {
      throw new BadRequestException('Request is already processing');
    }
    throw new BadRequestException('Previous request failed; please retry');
  }

  private toGalleryQuestionResponse(
    item: GalleryInteractionWithFeedback,
  ): GalleryEssayQuestionResponse {
    const output = this.asJsonObject(item.output);
    const answer = typeof output.answer === 'string' ? output.answer : '';
    if (!answer) {
      throw new BadRequestException('Stored question result is incomplete');
    }
    return {
      essayId: item.admissionCaseId,
      interactionId: item.id,
      answer,
      evidence: this.normalizeStoredEvidence(item.evidence),
      followUps: this.normalizeStringArray(output.followUps, 4),
      tokensUsed: item.tokensUsed,
    };
  }

  private toGalleryCompareResponse(
    item: GalleryInteractionWithFeedback,
  ): GalleryEssayCompareResponse {
    const output = this.asJsonObject(item.output);
    if (!item.userEssayId) {
      throw new BadRequestException('Stored compare result is incomplete');
    }
    return {
      essayId: item.admissionCaseId,
      userEssayId: item.userEssayId,
      interactionId: item.id,
      referenceSignals: this.normalizeStringArray(output.referenceSignals, 6),
      gapAnalysis: this.normalizeStringArray(output.gapAnalysis, 6),
      overlapWarnings: this.normalizeStringArray(output.overlapWarnings, 4),
      overlapRisk: this.normalizeOverlapRisk(output.overlapRisk),
      ...(typeof output.overlapRiskReason === 'string' &&
      output.overlapRiskReason
        ? { overlapRiskReason: output.overlapRiskReason }
        : {}),
      revisionActions: this.normalizeStringArray(output.revisionActions, 5),
      evidence: this.normalizeStoredEvidence(item.evidence),
      tokensUsed: item.tokensUsed,
      resultId: item.essayAIResultId ?? undefined,
    };
  }

  private async markGalleryInteractionFailed(
    interactionId: string,
    error: unknown,
    options: {
      refundStatus?: string;
      refundPointHistoryId?: string | null;
    } = {},
  ): Promise<void> {
    try {
      // governance: parent-scoped — private; marks the one interaction row the caller just created for this request
      await this.prisma.galleryEssayAIInteraction.update({
        where: { id: interactionId },
        data: {
          status: 'FAILED',
          refundStatus: options.refundStatus ?? 'REFUNDED',
          refundPointHistoryId: options.refundPointHistoryId ?? undefined,
          errorMessage: this.clip(
            error instanceof Error ? error.message : String(error),
            1000,
          ),
        },
      });
    } catch (updateError) {
      this.logger.warn(
        `Failed to mark gallery interaction ${interactionId} as failed: ${
          (updateError as Error).message
        }`,
      );
    }
  }

  private toGalleryInteractionItem(
    item: GalleryInteractionWithFeedback,
  ): GalleryEssayAIInteractionItem {
    const output = this.asJsonObject(item.output);
    const evidence = this.normalizeStoredEvidence(item.evidence);

    return {
      id: item.id,
      essayId: item.admissionCaseId,
      type: item.type === 'compare' ? 'compare' : 'question',
      status:
        item.status === 'SUCCEEDED' || item.status === 'FAILED'
          ? item.status
          : 'PENDING',
      locale: item.locale,
      question: item.question,
      paragraphIndex: item.paragraphIndex,
      selectedText: item.selectedText,
      focus: item.focus,
      userEssayId: item.userEssayId,
      essayAIResultId: item.essayAIResultId,
      resultId: item.essayAIResultId,
      answer: typeof output.answer === 'string' ? output.answer : null,
      followUps: this.normalizeStringArray(output.followUps, 4),
      referenceSignals: this.normalizeStringArray(output.referenceSignals, 6),
      gapAnalysis: this.normalizeStringArray(output.gapAnalysis, 6),
      overlapWarnings: this.normalizeStringArray(output.overlapWarnings, 4),
      overlapRisk: this.normalizeOverlapRisk(output.overlapRisk),
      overlapRiskReason:
        typeof output.overlapRiskReason === 'string'
          ? output.overlapRiskReason
          : undefined,
      revisionActions: this.normalizeStringArray(output.revisionActions, 5),
      evidence,
      tokensUsed: item.tokensUsed,
      pointsAction: item.pointsAction,
      pointsCharged: item.pointsCharged,
      pointsHistoryId: item.pointsHistoryId,
      refundPointHistoryId: item.refundPointHistoryId,
      refundStatus: item.refundStatus,
      errorMessage: item.errorMessage,
      feedback: item.feedback
        ? this.toGalleryInteractionFeedback(item.feedback)
        : null,
      createdAt: this.toIsoDate(item.createdAt),
      updatedAt: this.toIsoDate(item.updatedAt),
    };
  }

  private toGalleryInteractionFeedback(feedback: {
    id: string;
    interactionId: string;
    sentiment: string;
    category: string | null;
    notes: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }): GalleryEssayInteractionFeedbackResponse {
    return {
      id: feedback.id,
      interactionId: feedback.interactionId,
      sentiment: feedback.sentiment === 'HELPFUL' ? 'HELPFUL' : 'NOT_HELPFUL',
      category:
        feedback.category === 'wrong_evidence' ||
        feedback.category === 'too_generic' ||
        feedback.category === 'template_like' ||
        feedback.category === 'cost_not_worth' ||
        feedback.category === 'other'
          ? feedback.category
          : null,
      notes: feedback.notes,
      createdAt: this.toIsoDate(feedback.createdAt),
      updatedAt: this.toIsoDate(feedback.updatedAt),
    };
  }

  private asJsonObject(
    value: Prisma.JsonValue | null | undefined,
  ): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value;
  }

  private verifyEvidence(
    evidence: GalleryEssayEvidence[],
    sources: Partial<Record<GalleryEssayEvidence['source'], string>>,
    fallback: {
      fallbackSource: GalleryEssayEvidence['source'];
      fallbackQuote: string;
    },
  ): GalleryEssayEvidence[] {
    const verified = evidence
      .filter((item) =>
        this.sourceContainsQuote(sources[item.source], item.quote),
      )
      .map((item) => ({ ...item, verified: true }))
      .slice(0, 5);

    if (verified.length > 0) return verified;

    const quote = fallback.fallbackQuote.trim();
    if (!quote) return [];
    return [
      {
        source: fallback.fallbackSource,
        quote: this.clip(quote, 260),
        verified: true,
      },
    ];
  }

  private sourceContainsQuote(
    sourceText: string | undefined,
    quote: string,
  ): boolean {
    if (!sourceText?.trim() || !quote.trim()) return false;
    const normalize = (text: string) =>
      text
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    const normalizedSource = normalize(sourceText);
    const normalizedQuote = normalize(quote);
    const containsCjk = /[\u3400-\u9fff]/.test(normalizedQuote);
    const minLength = containsCjk ? 4 : 8;
    if (normalizedQuote.length < minLength) return false;
    return normalizedSource.includes(normalizedQuote);
  }

  private normalizeStoredEvidence(value: unknown): GalleryEssayEvidence[] {
    return this.normalizeEvidence(value, {
      fallbackQuote: '',
      allowedSources: ['essay', 'learning_notes', 'case_context', 'user_essay'],
    });
  }

  private toIsoDate(value: Date | string): string {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }

  private async getPublicGalleryCaseForAi(
    caseId: string,
  ): Promise<GalleryDetailCase> {
    // governance: public-feed — spreads CASE_PUBLIC_WHERE — AdmissionCase.visibility defaults to PRIVATE, so that spread is what keeps unpublished essays out
    const essay = await this.prisma.admissionCase.findFirst({
      where: {
        id: caseId,
        ...CASE_PUBLIC_WHERE,
      },
      select: GALLERY_DETAIL_SELECT,
    });

    if (!essay) {
      throw new NotFoundException('Essay not found or not public');
    }
    if (!essay.essayContent) {
      throw new BadRequestException('Essay content is empty');
    }
    return essay;
  }

  private getCachedLearningNotes(
    essay: GalleryDetailCase,
    locale: string,
  ): GalleryLearningNotesPayload | null {
    return (
      this.findLearningNotesCacheEntry(essay.aiAnalysisCache, locale)?.entry
        .payload ?? null
    );
  }

  private findLearningNotesCacheEntry(
    cacheBlob: Prisma.JsonValue | null | undefined,
    locale: string,
  ): {
    locale: string;
    entry: CachedAnalysisEntry & { payload: GalleryLearningNotesPayload };
  } | null {
    const requestedLocale = locale === 'en' ? 'en' : 'zh';
    const fallbackLocale = requestedLocale === 'en' ? 'zh' : 'en';

    for (const candidateLocale of [requestedLocale, fallbackLocale]) {
      const entry = this.readCacheEntry(cacheBlob, candidateLocale);
      if (
        entry?.promptVersion === PARAGRAPH_PROMPT_VERSION &&
        this.isLearningNotesPayload(entry.payload)
      ) {
        return {
          locale: candidateLocale,
          entry: {
            ...entry,
            payload: entry.payload,
          },
        };
      }
    }

    return null;
  }

  private hasCurrentLearningNotesForAnyLocale(
    cacheBlob: Prisma.JsonValue | null | undefined,
  ): boolean {
    return Boolean(this.findLearningNotesCacheEntry(cacheBlob, 'zh'));
  }

  private buildGalleryQuestionUserPrompt(
    essay: GalleryDetailCase,
    question: string,
    paragraphIndex: number | undefined,
    selectedText: string | undefined,
    learningNotes: GalleryLearningNotesPayload | null,
    locale: string,
  ): string {
    const isZh = locale === 'zh';
    return [
      isZh ? '公开范文信息：' : 'Public reference essay metadata:',
      JSON.stringify(this.galleryMetadata(essay), null, 2),
      '',
      isZh ? '题目：' : 'Prompt:',
      essay.essayPrompt || (isZh ? '未提供' : 'Not provided'),
      '',
      isZh ? '范文正文（按段落编号）：' : 'Reference essay text by paragraph:',
      this.formatParagraphs(essay.essayContent || ''),
      '',
      isZh ? '已缓存范文拆解：' : 'Cached learning notes:',
      learningNotes
        ? JSON.stringify(learningNotes, null, 2)
        : isZh
          ? '暂无缓存拆解'
          : 'No cached notes available',
      '',
      paragraphIndex !== undefined
        ? `${isZh ? '用户关注段落：' : 'Focused paragraph:'}${paragraphIndex + 1}`
        : '',
      selectedText
        ? `${isZh ? '用户选中文本：' : 'Selected text:'}\n${this.clip(selectedText, 1200)}`
        : '',
      '',
      isZh ? '用户问题：' : 'User question:',
      question,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildGalleryCompareUserPrompt(
    galleryEssay: GalleryDetailCase,
    userEssay: {
      id: string;
      title: string;
      prompt: string | null;
      content: string;
      wordCount: number | null;
      schoolId: string | null;
    },
    focus: GalleryEssayCompareRequest['focus'],
    learningNotes: GalleryLearningNotesPayload | null,
    locale: string,
  ): string {
    const isZh = locale === 'zh';
    return [
      isZh ? '公开范文信息：' : 'Public reference essay metadata:',
      JSON.stringify(this.galleryMetadata(galleryEssay), null, 2),
      '',
      isZh ? '公开范文题目：' : 'Reference prompt:',
      galleryEssay.essayPrompt || (isZh ? '未提供' : 'Not provided'),
      '',
      isZh
        ? '公开范文正文（按段落编号）：'
        : 'Reference essay text by paragraph:',
      this.formatParagraphs(galleryEssay.essayContent || ''),
      '',
      isZh ? '已缓存范文拆解：' : 'Cached learning notes:',
      learningNotes
        ? JSON.stringify(learningNotes, null, 2)
        : isZh
          ? '暂无缓存拆解'
          : 'No cached notes available',
      '',
      isZh ? '用户文书信息：' : 'User essay metadata:',
      JSON.stringify(
        {
          id: userEssay.id,
          title: userEssay.title,
          wordCount: userEssay.wordCount,
          schoolId: userEssay.schoolId,
          focus: focus ?? null,
        },
        null,
        2,
      ),
      '',
      isZh ? '用户文书题目：' : 'User essay prompt:',
      userEssay.prompt || (isZh ? '未提供' : 'Not provided'),
      '',
      isZh ? '用户文书正文：' : 'User essay text:',
      this.clip(userEssay.content, 7000),
    ].join('\n');
  }

  private galleryMetadata(essay: GalleryDetailCase) {
    return {
      id: essay.id,
      year: essay.year,
      round: essay.round,
      result: essay.result,
      essayType: essay.essayType,
      promptNumber: essay.promptNumber,
      school: essay.school
        ? {
            id: essay.school.id,
            name: essay.school.name,
            nameZh: essay.school.nameZh,
            usNewsRank: essay.school.usNewsRank,
          }
        : null,
      tags: essay.tags,
      isVerified: essay.isVerified,
    };
  }

  private formatParagraphs(text: string): string {
    return text
      .split(/\n\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph, index) => `[${index + 1}] ${this.clip(paragraph, 1400)}`)
      .join('\n\n');
  }

  private clip(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1)}…`;
  }

  private isLearningNotesPayload(
    payload: unknown,
  ): payload is GalleryLearningNotesPayload {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return false;
    }
    const value = payload as Record<string, unknown>;
    const structure = value.structure as Record<string, unknown> | undefined;
    return (
      Array.isArray(value.paragraphs) &&
      typeof value.overallScore === 'number' &&
      Boolean(structure) &&
      typeof structure?.hasStrongOpening === 'boolean' &&
      typeof structure?.hasClarity === 'boolean' &&
      typeof structure?.hasGoodConclusion === 'boolean' &&
      typeof structure?.feedback === 'string' &&
      typeof value.summary === 'string'
    );
  }

  private normalizeStringArray(value: unknown, maxItems: number): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .slice(0, maxItems);
  }

  /**
   * Coerce the LLM's similarity-risk field to a fixed band. Unknown/missing
   * defaults to 'low' (the safe, least-alarming bucket) so a malformed
   * response never shows a false "high plagiarism risk" banner.
   */
  private normalizeOverlapRisk(value: unknown): GalleryEssayOverlapRisk {
    if (typeof value !== 'string') return 'low';
    const v = value.trim().toLowerCase();
    if (v === 'high' || v === 'medium' || v === 'low') return v;
    return 'low';
  }

  private normalizeEvidence(
    value: unknown,
    options: {
      fallbackQuote: string;
      allowedSources: GalleryEssayEvidence['source'][];
    },
  ): GalleryEssayEvidence[] {
    const allowed = new Set(options.allowedSources);
    const evidence = Array.isArray(value) ? value : [];
    const normalized = evidence
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null;
        }
        const record = item as Record<string, unknown>;
        const source = allowed.has(
          record.source as GalleryEssayEvidence['source'],
        )
          ? (record.source as GalleryEssayEvidence['source'])
          : options.allowedSources[0];
        const quote =
          typeof record.quote === 'string'
            ? this.clip(record.quote.trim(), 260)
            : '';
        if (!quote) return null;

        const result: GalleryEssayEvidence = { source, quote };
        if (
          typeof record.paragraphIndex === 'number' &&
          Number.isInteger(record.paragraphIndex) &&
          record.paragraphIndex >= 0
        ) {
          result.paragraphIndex = record.paragraphIndex;
        }
        if (typeof record.note === 'string' && record.note.trim()) {
          result.note = this.clip(record.note.trim(), 220);
        }
        return result;
      })
      .filter((item): item is GalleryEssayEvidence => Boolean(item))
      .slice(0, 5);

    if (normalized.length > 0) return normalized;

    const fallback = options.fallbackQuote.trim();
    if (!fallback) return [];
    return [
      {
        source: options.allowedSources[0],
        quote: this.clip(fallback, 260),
      },
    ];
  }

  private ensureCompareEvidence(
    evidence: GalleryEssayEvidence[],
    referenceText: string,
    userText: string,
  ): GalleryEssayEvidence[] {
    const next = [...evidence];
    const hasReference = next.some((item) =>
      ['essay', 'learning_notes', 'case_context'].includes(item.source),
    );
    const hasUserEssay = next.some((item) => item.source === 'user_essay');

    if (!hasReference && referenceText.trim()) {
      next.unshift({
        source: 'essay',
        quote: this.clip(referenceText.trim(), 260),
      });
    }

    if (!hasUserEssay && userText.trim()) {
      const userEvidence: GalleryEssayEvidence = {
        source: 'user_essay',
        quote: this.clip(userText.trim(), 260),
      };
      if (next.length >= 5) {
        next[next.length - 1] = userEvidence;
      } else {
        next.push(userEvidence);
      }
    }

    return next.slice(0, 5);
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
