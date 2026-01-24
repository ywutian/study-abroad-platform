import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AssessmentType, MemoryType } from '@prisma/client';
import {
  AssessmentTypeEnum,
  AssessmentDto,
  AssessmentResultDto,
  SubmitAssessmentDto,
  MbtiResultDto,
  HollandResultDto,
} from './dto';
import {
  MBTI_QUESTIONS,
  MBTI_INTERPRETATIONS,
  LIKERT_OPTIONS,
  MBTI_DISCLAIMER,
  MbtiQuestion,
} from './data/mbti-questions';
import { HOLLAND_QUESTIONS, HOLLAND_TYPE_INFO } from './data/holland-questions';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';

/**
 * Service for personality and career interest assessments.
 *
 * Supports two assessment types:
 * - MBTI (Jungian Type): 48 questions across 4 dimensions (EI, SN, TF, JP)
 *   using a 5-point Likert scale with positive/negative direction scoring.
 * - Holland (Career Interest): Calculates RIASEC scores and returns top-3 career codes
 *   with matched fields and recommended majors.
 *
 * Results are persisted to the database and recorded in the memory system for
 * downstream use by the AI agent and prediction services.
 */
@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);

  constructor(
    private prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => MemoryManagerService))
    private memoryManager?: MemoryManagerService,
  ) {}

  /**
   * Retrieve the question set for a given assessment type.
   *
   * Returns a shuffled list of questions with bilingual text and answer options.
   * MBTI questions include Likert scale options; Holland questions include their own options.
   *
   * @param type - The assessment type to retrieve (MBTI or HOLLAND)
   * @returns Assessment DTO containing shuffled questions, title, and description
   * @throws {BadRequestException} When an unsupported assessment type is provided
   */
  /**
   * 获取测评题目
   */
  async getAssessment(type: AssessmentTypeEnum): Promise<AssessmentDto> {
    let questions;
    let title: string;
    let titleZh: string;
    let description: string;
    let descriptionZh: string;

    switch (type) {
      case AssessmentTypeEnum.MBTI:
        questions = MBTI_QUESTIONS.map((q) => ({
          ...q,
          options: LIKERT_OPTIONS,
        }));
        title = 'Jungian Type Personality Test';
        titleZh = '荣格类型性格测试';
        description =
          'Discover your personality type based on Jungian psychology. ' +
          MBTI_DISCLAIMER.en;
        descriptionZh = '基于荣格心理学发现你的性格类型。' + MBTI_DISCLAIMER.zh;
        break;
      case AssessmentTypeEnum.HOLLAND:
        questions = HOLLAND_QUESTIONS;
        title = 'Holland Career Interest Test';
        titleZh = '霍兰德职业兴趣测试';
        description = 'Find careers and majors that match your interests';
        descriptionZh = '找到与你兴趣匹配的职业和专业';
        break;
      default:
        throw new BadRequestException('Unsupported assessment type');
    }

    // 随机打乱题目顺序
    const shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);

    return {
      id: type,
      type,
      title,
      titleZh,
      description,
      descriptionZh,
      questions: shuffledQuestions.map((q) => ({
        id: q.id,
        text: q.text,
        textZh: q.textZh,
        options: q.options.map((o) => ({
          value: o.value,
          text: o.text,
          textZh: o.textZh,
        })),
        dimension: (q as any).dimension || (q as any).type,
      })),
    };
  }

  /**
   * Submit assessment answers, compute the result, and persist it.
   *
   * Workflow:
   * 1. Calculate the typed result (MBTI type or Holland codes) from raw answers
   * 2. Find or create the Assessment record in the database
   * 3. Save the AssessmentResult with answers, computed result, and major recommendations
   * 4. Asynchronously record the result to the memory system (FACT + PREFERENCE memories)
   *
   * @param userId - The user submitting the assessment
   * @param dto - Submission DTO containing the assessment type and answer array
   * @returns Formatted assessment result DTO
   * @throws {BadRequestException} When an unsupported assessment type is provided
   */
  /**
   * 提交测评答案并计算结果
   */
  async submitAssessment(
    userId: string,
    dto: SubmitAssessmentDto,
  ): Promise<AssessmentResultDto> {
    let result: any;

    switch (dto.type) {
      case AssessmentTypeEnum.MBTI:
        result = this.calculateMbtiResult(dto.answers);
        break;
      case AssessmentTypeEnum.HOLLAND:
        result = this.calculateHollandResult(dto.answers);
        break;
      default:
        throw new BadRequestException('Unsupported assessment type');
    }

    // 查找或创建 Assessment 记录
    let assessment = await this.prisma.assessment.findFirst({
      where: { type: dto.type as unknown as AssessmentType },
    });

    if (!assessment) {
      // 创建 Assessment 记录
      const questionsJson =
        dto.type === AssessmentTypeEnum.MBTI
          ? JSON.parse(JSON.stringify(MBTI_QUESTIONS))
          : JSON.parse(JSON.stringify(HOLLAND_QUESTIONS));

      assessment = await this.prisma.assessment.create({
        data: {
          type: dto.type as unknown as AssessmentType,
          title:
            dto.type === AssessmentTypeEnum.MBTI
              ? 'Jungian Type Personality Test'
              : 'Holland Career Test',
          titleZh:
            dto.type === AssessmentTypeEnum.MBTI
              ? '荣格类型性格测试'
              : '霍兰德职业兴趣测试',
          questions: questionsJson,
        },
      });
    }

    // 保存结果
    const savedResult = await this.prisma.assessmentResult.create({
      data: {
        userId,
        assessmentId: assessment.id,
        answers: dto.answers as object[],
        result: result as object,
        majorRecommendations: result.majors
          ? result.majors.map((m: string) => ({
              major: m,
              score: 0,
              reasons: [],
            }))
          : null,
      },
    });

    // 记录到记忆系统
    await this.saveAssessmentToMemory(userId, dto.type, result);

    return this.formatResult(dto.type, savedResult);
  }

  /**
   * Save assessment results to the memory system for downstream AI agent use.
   *
   * For MBTI: records a FACT memory with the type code and personality description,
   * plus a PREFERENCE memory with recommended majors.
   * For Holland: records a FACT memory with the career code and dominant types,
   * plus a PREFERENCE memory with interest fields and recommended majors.
   * Failures are caught and logged without affecting the main flow.
   *
   * @param userId - The user identifier
   * @param type - The assessment type (MBTI or HOLLAND)
   * @param result - The computed assessment result object
   */
  /**
   * 保存测评结果到记忆系统
   */
  private async saveAssessmentToMemory(
    userId: string,
    type: AssessmentTypeEnum,
    result: MbtiResultDto | HollandResultDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      if (type === AssessmentTypeEnum.MBTI) {
        const mbti = result as MbtiResultDto;
        await this.memoryManager.remember(userId, {
          type: MemoryType.FACT,
          category: 'assessment',
          content: `用户完成 MBTI 测评，结果为 ${mbti.type} (${mbti.titleZh})。特点：${mbti.descriptionZh?.slice(0, 100) || mbti.description?.slice(0, 100)}`,
          importance: 0.8,
          metadata: {
            assessmentType: 'mbti',
            mbtiType: mbti.type,
            scores: mbti.scores,
            source: 'assessment_service',
          },
        });

        // 记录推荐的专业偏好
        if (mbti.majors && mbti.majors.length > 0) {
          await this.memoryManager.remember(userId, {
            type: MemoryType.PREFERENCE,
            category: 'major_preference',
            content: `基于 MBTI ${mbti.type} 类型，推荐专业：${mbti.majors.slice(0, 5).join('、')}`,
            importance: 0.7,
            metadata: {
              source: 'mbti_assessment',
              majors: mbti.majors,
            },
          });
        }
      } else if (type === AssessmentTypeEnum.HOLLAND) {
        const holland = result as HollandResultDto;
        await this.memoryManager.remember(userId, {
          type: MemoryType.FACT,
          category: 'assessment',
          content: `用户完成霍兰德职业测评，职业代码为 ${holland.codes}，主要类型：${holland.typesZh?.join('、') || holland.types?.join('、')}`,
          importance: 0.8,
          metadata: {
            assessmentType: 'holland',
            hollandCodes: holland.codes,
            scores: holland.scores,
            source: 'assessment_service',
          },
        });

        // 记录推荐的专业和领域偏好
        if (holland.majors && holland.majors.length > 0) {
          await this.memoryManager.remember(userId, {
            type: MemoryType.PREFERENCE,
            category: 'career_interest',
            content: `基于霍兰德 ${holland.codes} 代码，感兴趣领域：${holland.fieldsZh?.slice(0, 3).join('、') || holland.fields?.slice(0, 3).join('、')}；推荐专业：${holland.majors.slice(0, 5).join('、')}`,
            importance: 0.7,
            metadata: {
              source: 'holland_assessment',
              fields: holland.fields,
              majors: holland.majors,
            },
          });
        }
      }
    } catch (error) {
      this.logger.warn('Failed to save assessment to memory', error);
      // 不影响主流程
    }
  }

  /**
   * Record a "view assessment history" event to the memory system.
   *
   * Stores a low-importance FACT memory noting which assessment types were reviewed
   * and the total number of results. Skipped if no results or no memory manager.
   *
   * @param userId - The user identifier
   * @param results - The assessment results that were viewed (with assessment relation)
   */
  /**
   * 记录查看测评历史的行为
   */
  private async recordViewHistoryToMemory(
    userId: string,
    results: any[],
  ): Promise<void> {
    if (!this.memoryManager || results.length === 0) return;

    try {
      const types = [...new Set(results.map((r) => r.assessment.type))];
      await this.memoryManager.remember(userId, {
        type: MemoryType.FACT,
        category: 'view_history',
        content: `用户查看了测评历史，共有${results.length}条记录，包含${types.join('、')}类型测评`,
        importance: 0.2,
        metadata: {
          resultCount: results.length,
          types,
          viewedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record view history to memory', error);
    }
  }

  /**
   * Record a "view individual assessment result" event to the memory system.
   *
   * Creates a low-importance FACT memory with the specific result type and ID.
   *
   * @param userId - The user identifier
   * @param type - The assessment type (MBTI or HOLLAND)
   * @param result - The raw assessment result record
   */
  /**
   * 记录查看单个测评结果的行为
   */
  private async recordViewResultToMemory(
    userId: string,
    type: AssessmentTypeEnum,
    result: any,
  ): Promise<void> {
    if (!this.memoryManager) return;

    try {
      const parsedResult =
        typeof result.result === 'string'
          ? JSON.parse(result.result)
          : result.result;

      let content: string;
      if (type === AssessmentTypeEnum.MBTI) {
        content = `用户查看了 MBTI 测评结果 ${parsedResult.type}`;
      } else {
        content = `用户查看了霍兰德测评结果 ${parsedResult.codes}`;
      }

      await this.memoryManager.remember(userId, {
        type: MemoryType.FACT,
        category: 'view_history',
        content,
        importance: 0.2,
        metadata: {
          assessmentType: type,
          resultId: result.id,
          viewedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record view result to memory', error);
    }
  }

  /**
   * Retrieve all assessment results for a user, ordered by most recent first.
   *
   * Also asynchronously records the view-history event to the memory system
   * when results are found.
   *
   * @param userId - The user identifier
   * @returns Array of formatted assessment result DTOs
   */
  /**
   * 获取用户的测评历史
   */
  async getHistory(userId: string): Promise<AssessmentResultDto[]> {
    const results = await this.prisma.assessmentResult.findMany({
      where: { userId },
      include: { assessment: true },
      orderBy: { completedAt: 'desc' },
    });

    // 记录查看历史行为
    if (results.length > 0) {
      this.recordViewHistoryToMemory(userId, results).catch((err) => {
        this.logger.warn('Failed to record view history to memory', err);
      });
    }

    return results.map((r) =>
      this.formatResult(r.assessment.type as AssessmentTypeEnum, r),
    );
  }

  /**
   * Retrieve a single assessment result by ID, scoped to the requesting user.
   *
   * Also asynchronously records the view-result event to the memory system.
   *
   * @param userId - The user identifier (used for ownership check)
   * @param resultId - The assessment result identifier
   * @returns Formatted assessment result DTO
   * @throws {NotFoundException} When the result does not exist or does not belong to the user
   */
  /**
   * 获取单个测评结果
   */
  async getResult(
    userId: string,
    resultId: string,
  ): Promise<AssessmentResultDto> {
    const result = await this.prisma.assessmentResult.findFirst({
      where: { id: resultId, userId },
      include: { assessment: true },
    });

    if (!result) {
      throw new NotFoundException('Result not found');
    }

    // 记录查看详情行为
    this.recordViewResultToMemory(
      userId,
      result.assessment.type as AssessmentTypeEnum,
      result,
    ).catch((err) => {
      this.logger.warn('Failed to record view result to memory', err);
    });

    return this.formatResult(
      result.assessment.type as AssessmentTypeEnum,
      result,
    );
  }

  // ============ Private Methods ============

  /**
   * Calculate the MBTI personality type from raw answers using a 5-point Likert scale.
   *
   * Scoring algorithm:
   * - 4 dimensions (EI, SN, TF, JP), each with 12 questions (6 positive, 6 negative direction)
   * - Positive direction (+): raw score contributes to the first letter (E/S/T/J);
   *   inverse (6 - score) contributes to the second letter (I/N/F/P)
   * - Negative direction (-): raw score contributes to the second letter;
   *   inverse contributes to the first letter
   * - Final percentage = (first-letter score / dimension total) * 100
   * - Type is determined by whichever letter reaches >= 50% per dimension
   *
   * @param answers - Array of question-answer pairs where answer is "1"-"5"
   * @returns MbtiResultDto with type code, dimension percentages, title, description, strengths, careers, and majors
   */
  /**
   * 计算 MBTI 结果 (基于 5 点 Likert 量表)
   *
   * 评分逻辑：
   * - 每个维度 12 题，6 题正向(+)，6 题反向(-)
   * - 正向题：分数直接计入第一个字母 (E/S/T/J)
   * - 反向题：分数反转后计入第一个字母，或直接计入第二个字母 (I/N/F/P)
   * - 最终百分比 = (该维度第一个字母得分 / 该维度总分) * 100
   */
  private calculateMbtiResult(
    answers: { questionId: string; answer: string }[],
  ): MbtiResultDto {
    // 初始化各维度得分 (每个维度最高 60 分 = 12题 * 5分)
    const dimensionScores: Record<string, { first: number; second: number }> = {
      EI: { first: 0, second: 0 }, // E vs I
      SN: { first: 0, second: 0 }, // S vs N
      TF: { first: 0, second: 0 }, // T vs F
      JP: { first: 0, second: 0 }, // J vs P
    };

    // 计算各答案
    for (const answer of answers) {
      const question = MBTI_QUESTIONS.find((q) => q.id === answer.questionId);
      if (!question) continue;

      const score = parseInt(answer.answer, 10);
      if (isNaN(score) || score < 1 || score > 5) continue;

      const dimension = question.dimension;

      if (question.direction === '+') {
        // 正向题：高分偏向第一个字母
        dimensionScores[dimension].first += score;
        dimensionScores[dimension].second += 6 - score; // 反向计入第二个字母
      } else {
        // 反向题：高分偏向第二个字母
        dimensionScores[dimension].second += score;
        dimensionScores[dimension].first += 6 - score; // 反向计入第一个字母
      }
    }

    // 计算百分比
    const percentages: Record<string, number> = {};
    const dimensionMap: Record<string, [string, string]> = {
      EI: ['E', 'I'],
      SN: ['S', 'N'],
      TF: ['T', 'F'],
      JP: ['J', 'P'],
    };

    for (const dim of ['EI', 'SN', 'TF', 'JP']) {
      const [first, second] = dimensionMap[dim];
      const total =
        dimensionScores[dim].first + dimensionScores[dim].second || 1;
      percentages[first] = Math.round(
        (dimensionScores[dim].first / total) * 100,
      );
      percentages[second] = 100 - percentages[first];
    }

    // 确定类型
    const type =
      (percentages.E >= 50 ? 'E' : 'I') +
      (percentages.S >= 50 ? 'S' : 'N') +
      (percentages.T >= 50 ? 'T' : 'F') +
      (percentages.J >= 50 ? 'J' : 'P');

    const interpretation = MBTI_INTERPRETATIONS[type];

    return {
      type,
      scores: percentages,
      title: interpretation?.title || type,
      titleZh: interpretation?.titleZh || type,
      description: interpretation?.description || '',
      descriptionZh: interpretation?.descriptionZh || '',
      strengths: interpretation?.strengthsZh || [],
      careers: interpretation?.careers || [],
      majors: interpretation?.majors || [],
    };
  }

  /**
   * Calculate the Holland career interest profile from raw answers.
   *
   * Scoring algorithm:
   * - Sums answer values per RIASEC type (Realistic, Investigative, Artistic,
   *   Social, Enterprising, Conventional)
   * - Selects top-3 types by score to form the Holland code (e.g., "RIA")
   * - Merges fields and majors from the top-3 types using HOLLAND_TYPE_INFO lookup
   *
   * @param answers - Array of question-answer pairs where answer is a numeric string
   * @returns HollandResultDto with codes, per-type scores, type names, fields, and majors
   */
  private calculateHollandResult(
    answers: { questionId: string; answer: string }[],
  ): HollandResultDto {
    // 初始化各类型得分
    const scores: Record<string, number> = {
      R: 0,
      I: 0,
      A: 0,
      S: 0,
      E: 0,
      C: 0,
    };

    // 计算各答案
    for (const answer of answers) {
      const question = HOLLAND_QUESTIONS.find(
        (q) => q.id === answer.questionId,
      );
      if (!question) continue;

      scores[question.type] += parseInt(answer.answer, 10);
    }

    // 按得分排序获取前三个代码
    const sortedTypes = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);

    const codes = sortedTypes.join('');

    // 获取类型信息
    const types = sortedTypes.map((t) => HOLLAND_TYPE_INFO[t].name);
    const typesZh = sortedTypes.map((t) => HOLLAND_TYPE_INFO[t].nameZh);

    // 合并字段和专业
    const fields = [
      ...new Set(sortedTypes.flatMap((t) => HOLLAND_TYPE_INFO[t].fields)),
    ];
    const fieldsZh = [
      ...new Set(sortedTypes.flatMap((t) => HOLLAND_TYPE_INFO[t].fieldsZh)),
    ];
    const majors = [
      ...new Set(sortedTypes.flatMap((t) => HOLLAND_TYPE_INFO[t].majors)),
    ];

    return {
      codes,
      scores,
      types,
      typesZh,
      fields,
      fieldsZh,
      majors,
    };
  }

  /**
   * Format a raw database assessment result into the public DTO shape.
   *
   * Parses the JSON `result` column and attaches it under `mbtiResult` or
   * `hollandResult` depending on the assessment type.
   *
   * @param type - The assessment type to determine which DTO field to populate
   * @param result - Raw Prisma record (may have stringified `result` column)
   * @returns Formatted AssessmentResultDto with type-specific nested result
   */
  private formatResult(
    type: AssessmentTypeEnum,
    result: any,
  ): AssessmentResultDto {
    const baseResult: AssessmentResultDto = {
      id: result.id,
      type,
      completedAt: result.completedAt,
    };

    const parsedResult =
      typeof result.result === 'string'
        ? JSON.parse(result.result)
        : result.result;

    if (type === AssessmentTypeEnum.MBTI) {
      baseResult.mbtiResult = parsedResult as MbtiResultDto;
    } else if (type === AssessmentTypeEnum.HOLLAND) {
      baseResult.hollandResult = parsedResult as HollandResultDto;
    }

    return baseResult;
  }
}
