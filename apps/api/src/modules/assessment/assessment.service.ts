import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AssessmentType } from '@prisma/client';
import {
  AssessmentTypeEnum,
  AssessmentDto,
  AssessmentResultDto,
  SubmitAssessmentDto,
  MbtiResultDto,
  HollandResultDto,
} from './dto';
import { MBTI_QUESTIONS, MBTI_INTERPRETATIONS, LIKERT_OPTIONS, MBTI_DISCLAIMER, MbtiQuestion } from './data/mbti-questions';
import { HOLLAND_QUESTIONS, HOLLAND_TYPE_INFO } from './data/holland-questions';

@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);

  constructor(private prisma: PrismaService) {}

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
        description = 'Discover your personality type based on Jungian psychology. ' + MBTI_DISCLAIMER.en;
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
   * 提交测评答案并计算结果
   */
  async submitAssessment(userId: string, dto: SubmitAssessmentDto): Promise<AssessmentResultDto> {
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
      where: { type: dto.type as AssessmentType },
    });

    if (!assessment) {
      // 创建 Assessment 记录
      const questionsJson = dto.type === AssessmentTypeEnum.MBTI 
        ? JSON.parse(JSON.stringify(MBTI_QUESTIONS)) 
        : JSON.parse(JSON.stringify(HOLLAND_QUESTIONS));
      
      assessment = await this.prisma.assessment.create({
        data: {
          type: dto.type as AssessmentType,
          title: dto.type === AssessmentTypeEnum.MBTI ? 'Jungian Type Personality Test' : 'Holland Career Test',
          titleZh: dto.type === AssessmentTypeEnum.MBTI ? '荣格类型性格测试' : '霍兰德职业兴趣测试',
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
          ? result.majors.map((m: string) => ({ major: m, score: 0, reasons: [] }))
          : null,
      },
    });

    return this.formatResult(dto.type, savedResult);
  }

  /**
   * 获取用户的测评历史
   */
  async getHistory(userId: string): Promise<AssessmentResultDto[]> {
    const results = await this.prisma.assessmentResult.findMany({
      where: { userId },
      include: { assessment: true },
      orderBy: { completedAt: 'desc' },
    });

    return results.map((r) => this.formatResult(r.assessment.type as AssessmentTypeEnum, r));
  }

  /**
   * 获取单个测评结果
   */
  async getResult(userId: string, resultId: string): Promise<AssessmentResultDto> {
    const result = await this.prisma.assessmentResult.findFirst({
      where: { id: resultId, userId },
      include: { assessment: true },
    });

    if (!result) {
      throw new NotFoundException('Result not found');
    }

    return this.formatResult(result.assessment.type as AssessmentTypeEnum, result);
  }

  // ============ Private Methods ============

  /**
   * 计算 MBTI 结果 (基于 5 点 Likert 量表)
   *
   * 评分逻辑：
   * - 每个维度 12 题，6 题正向(+)，6 题反向(-)
   * - 正向题：分数直接计入第一个字母 (E/S/T/J)
   * - 反向题：分数反转后计入第一个字母，或直接计入第二个字母 (I/N/F/P)
   * - 最终百分比 = (该维度第一个字母得分 / 该维度总分) * 100
   */
  private calculateMbtiResult(answers: { questionId: string; answer: string }[]): MbtiResultDto {
    // 初始化各维度得分 (每个维度最高 60 分 = 12题 * 5分)
    const dimensionScores: Record<string, { first: number; second: number }> = {
      EI: { first: 0, second: 0 }, // E vs I
      SN: { first: 0, second: 0 }, // S vs N
      TF: { first: 0, second: 0 }, // T vs F
      JP: { first: 0, second: 0 }, // J vs P
    };

    // 计算各答案
    for (const answer of answers) {
      const question = MBTI_QUESTIONS.find((q) => q.id === answer.questionId) as MbtiQuestion | undefined;
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
      const total = dimensionScores[dim].first + dimensionScores[dim].second || 1;
      percentages[first] = Math.round((dimensionScores[dim].first / total) * 100);
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

  private calculateHollandResult(answers: { questionId: string; answer: string }[]): HollandResultDto {
    // 初始化各类型得分
    const scores: Record<string, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

    // 计算各答案
    for (const answer of answers) {
      const question = HOLLAND_QUESTIONS.find((q) => q.id === answer.questionId);
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
    const fields = [...new Set(sortedTypes.flatMap((t) => HOLLAND_TYPE_INFO[t].fields))];
    const fieldsZh = [...new Set(sortedTypes.flatMap((t) => HOLLAND_TYPE_INFO[t].fieldsZh))];
    const majors = [...new Set(sortedTypes.flatMap((t) => HOLLAND_TYPE_INFO[t].majors))];

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

  private formatResult(type: AssessmentTypeEnum, result: any): AssessmentResultDto {
    const baseResult: AssessmentResultDto = {
      id: result.id,
      type,
      completedAt: result.completedAt,
    };

    const parsedResult = typeof result.result === 'string' 
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

