import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentService } from './assessment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AssessmentType } from '@prisma/client';

// Mock the question data modules
jest.mock('./data/mbti-questions', () => ({
  MBTI_QUESTIONS: Array.from({ length: 48 }, (_, i) => ({
    id: `mbti-${i + 1}`,
    text: `MBTI Question ${i + 1}`,
    textZh: `MBTI 问题 ${i + 1}`,
    dimension: ['EI', 'SN', 'TF', 'JP'][i % 4],
    direction: i % 2 === 0 ? '+' : '-',
  })),
  MBTI_INTERPRETATIONS: {
    INTJ: {
      type: 'INTJ',
      name: 'Architect',
      nameZh: '建筑师',
      description: 'Imaginative and strategic thinkers',
      descriptionZh: '想象力丰富的战略思考者',
      strengths: ['Strategic'],
      careers: ['Engineer'],
      majors: ['CS'],
    },
    ENFP: {
      type: 'ENFP',
      name: 'Campaigner',
      nameZh: '竞选者',
      description: 'Enthusiastic, creative and sociable',
      descriptionZh: '热情、有创意、善于交际',
      strengths: ['Creative'],
      careers: ['Designer'],
      majors: ['Art'],
    },
    ESTJ: {
      type: 'ESTJ',
      name: 'Executive',
      nameZh: '执行者',
      description: 'Organized and logical',
      descriptionZh: '有组织性和逻辑性',
      strengths: ['Leadership'],
      careers: ['Manager'],
      majors: ['Business'],
    },
    INFP: {
      type: 'INFP',
      name: 'Mediator',
      nameZh: '调解者',
      description: 'Imaginative idealist',
      descriptionZh: '富有想象力的理想主义者',
      strengths: ['Empathy'],
      careers: ['Writer'],
      majors: ['Literature'],
    },
  },
  LIKERT_OPTIONS: [
    { value: 1, text: 'Strongly Disagree', textZh: '非常不同意' },
    { value: 2, text: 'Disagree', textZh: '不同意' },
    { value: 3, text: 'Neutral', textZh: '中立' },
    { value: 4, text: 'Agree', textZh: '同意' },
    { value: 5, text: 'Strongly Agree', textZh: '非常同意' },
  ],
  MBTI_DISCLAIMER: {
    en: 'For educational purposes only.',
    zh: '仅供教育参考。',
  },
  MbtiQuestion: {},
}));

jest.mock('./data/holland-questions', () => ({
  HOLLAND_QUESTIONS: Array.from({ length: 30 }, (_, i) => ({
    id: `holland-${i + 1}`,
    text: `Holland Question ${i + 1}`,
    textZh: `Holland 问题 ${i + 1}`,
    type: ['R', 'I', 'A', 'S', 'E', 'C'][i % 6],
    options: [
      { value: 1, text: 'Yes', textZh: '是' },
      { value: 0, text: 'No', textZh: '否' },
    ],
  })),
  HOLLAND_TYPE_INFO: {
    R: {
      name: 'Realistic',
      nameZh: '现实型',
      description: 'Practical, hands-on',
      descriptionZh: '务实',
      fields: ['Engineering'],
      fieldsZh: ['工程'],
      majors: ['Mechanical Engineering'],
    },
    I: {
      name: 'Investigative',
      nameZh: '研究型',
      description: 'Analytical',
      descriptionZh: '分析型',
      fields: ['Science'],
      fieldsZh: ['科学'],
      majors: ['Physics'],
    },
    A: {
      name: 'Artistic',
      nameZh: '艺术型',
      description: 'Creative',
      descriptionZh: '创意型',
      fields: ['Art'],
      fieldsZh: ['艺术'],
      majors: ['Fine Arts'],
    },
    S: {
      name: 'Social',
      nameZh: '社会型',
      description: 'Helpful',
      descriptionZh: '乐于助人',
      fields: ['Education'],
      fieldsZh: ['教育'],
      majors: ['Psychology'],
    },
    E: {
      name: 'Enterprising',
      nameZh: '企业型',
      description: 'Ambitious',
      descriptionZh: '有抱负',
      fields: ['Business'],
      fieldsZh: ['商业'],
      majors: ['MBA'],
    },
    C: {
      name: 'Conventional',
      nameZh: '常规型',
      description: 'Organized',
      descriptionZh: '有组织性',
      fields: ['Accounting'],
      fieldsZh: ['会计'],
      majors: ['Finance'],
    },
  },
}));

describe('AssessmentService', () => {
  let service: AssessmentService;
  let prisma: PrismaService;

  const mockAssessment = {
    id: 'assessment-1',
    type: AssessmentType.MBTI,
    title: 'MBTI Test',
    titleZh: 'MBTI 测试',
    questions: [],
  };

  const mockAssessmentResult = {
    id: 'result-1',
    userId: 'user-1',
    assessmentId: 'assessment-1',
    answers: [],
    result: { type: 'INTJ' },
    majorRecommendations: null,
    completedAt: new Date(),
    createdAt: new Date(),
    assessment: mockAssessment,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentService,
        {
          provide: PrismaService,
          useValue: {
            assessment: {
              findFirst: jest.fn().mockResolvedValue(mockAssessment),
              create: jest.fn().mockResolvedValue(mockAssessment),
            },
            assessmentResult: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn().mockResolvedValue(mockAssessmentResult),
            },
            assessmentDraft: {
              findUnique: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
              upsert: jest.fn(),
              delete: jest.fn().mockResolvedValue(undefined),
            },
          },
        },
        {
          provide: MemoryManagerService,
          useValue: {
            remember: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AssessmentService>(AssessmentService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAssessment', () => {
    it('should return MBTI assessment with questions and Likert options', async () => {
      const result = await service.getAssessment('MBTI' as any);

      expect(result.title).toContain('Jungian');
      expect(result.questions).toBeDefined();
      expect(result.questions.length).toBe(48);
      expect(result.questions[0].options).toBeDefined();
    });

    it('should return Holland assessment with questions', async () => {
      const result = await service.getAssessment('HOLLAND' as any);

      expect(result.title).toContain('Holland');
      expect(result.questions).toBeDefined();
      expect(result.questions.length).toBe(30);
    });

    it('should throw BadRequestException for unsupported type', async () => {
      await expect(service.getAssessment('INVALID' as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should shuffle questions (randomize order)', async () => {
      const result1 = await service.getAssessment('MBTI' as any);
      const result2 = await service.getAssessment('MBTI' as any);

      expect(result1.questions.length).toBe(result2.questions.length);
    });
  });

  describe('submitAssessment', () => {
    it('should process MBTI answers and return result', async () => {
      // answers is SubmitAnswerDto[] = { questionId, answer }[]
      const answers = Array.from({ length: 48 }, (_, i) => ({
        questionId: `mbti-${i + 1}`,
        answer: String(i % 2 === 0 ? 4 : 2),
      }));

      const result = await service.submitAssessment('user-1', {
        type: 'MBTI' as any,
        answers,
      });

      expect(result).toBeDefined();
      expect(prisma.assessmentResult.create).toHaveBeenCalled();
      expect(prisma.assessmentDraft.delete).toHaveBeenCalled();
    });

    it('should process Holland answers and return result', async () => {
      const answers = Array.from({ length: 30 }, (_, i) => ({
        questionId: `holland-${i + 1}`,
        answer: String(i % 2 === 0 ? 1 : 0),
      }));

      const result = await service.submitAssessment('user-1', {
        type: 'HOLLAND' as any,
        answers,
      });

      expect(result).toBeDefined();
      expect(prisma.assessmentResult.create).toHaveBeenCalled();
    });

    it('should reject incomplete submissions', async () => {
      await expect(
        service.submitAssessment('user-1', {
          type: 'MBTI' as any,
          answers: [{ questionId: 'mbti-1', answer: '4' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject answers for unknown questions', async () => {
      await expect(
        service.submitAssessment('user-1', {
          type: 'HOLLAND' as any,
          answers: Array.from({ length: 30 }, (_, i) => ({
            questionId: i === 0 ? 'bad-question' : `holland-${i + 1}`,
            answer: '1',
          })),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('drafts', () => {
    it('should save an assessment draft', async () => {
      const updatedAt = new Date('2026-05-15T12:00:00Z');
      (prisma.assessmentDraft.upsert as jest.Mock).mockResolvedValue({
        id: 'draft-1',
        userId: 'user-1',
        type: AssessmentType.MBTI,
        answers: [{ questionId: 'mbti-1', answer: '4' }],
        currentQuestionIndex: 1,
        expiresAt: new Date('2026-06-14T12:00:00Z'),
        updatedAt,
      });

      const result = await service.saveDraft('user-1', 'MBTI' as any, {
        answers: [{ questionId: 'mbti-1', answer: '4' }],
        currentQuestionIndex: 1,
      });

      expect(result.id).toBe('draft-1');
      expect(result.answers).toEqual([{ questionId: 'mbti-1', answer: '4' }]);
      expect(prisma.assessmentDraft.upsert).toHaveBeenCalled();
    });

    it('should return null and delete expired drafts', async () => {
      (prisma.assessmentDraft.findUnique as jest.Mock).mockResolvedValue({
        id: 'draft-1',
        userId: 'user-1',
        type: AssessmentType.MBTI,
        answers: [],
        currentQuestionIndex: 0,
        expiresAt: new Date('2020-01-01T00:00:00Z'),
        updatedAt: new Date(),
      });

      const result = await service.getDraft('user-1', 'MBTI' as any);

      expect(result).toBeNull();
      expect(prisma.assessmentDraft.delete).toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('should return user assessment history', async () => {
      (prisma.assessmentResult.findMany as jest.Mock).mockResolvedValue([
        mockAssessmentResult,
      ]);

      const result = await service.getHistory('user-1');

      expect(result).toHaveLength(1);
      expect(prisma.assessmentResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
        }),
      );
    });
  });

  describe('getResult', () => {
    it('should return a specific assessment result', async () => {
      (prisma.assessmentResult.findFirst as jest.Mock).mockResolvedValue(
        mockAssessmentResult,
      );

      const result = await service.getResult('user-1', 'result-1');
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if result not found', async () => {
      (prisma.assessmentResult.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getResult('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
