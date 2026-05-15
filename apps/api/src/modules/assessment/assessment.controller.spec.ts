import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AssessmentTypeEnum } from './dto';

describe('AssessmentController', () => {
  let controller: AssessmentController;
  let assessmentService: jest.Mocked<AssessmentService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };

  const mockAssessment = {
    id: 'assessment-1',
    type: AssessmentTypeEnum.MBTI,
    title: 'MBTI Assessment',
    titleZh: 'MBTI 测评',
    questions: [
      {
        id: 'q1',
        text: 'Do you prefer...',
        textZh: '你更喜欢...',
        options: [
          { value: 'E', text: 'Social events', textZh: '社交活动' },
          { value: 'I', text: 'Quiet time', textZh: '安静时光' },
        ],
      },
    ],
  };

  const mockResult = {
    id: 'result-1',
    type: AssessmentTypeEnum.MBTI,
    mbtiResult: {
      type: 'INTJ',
      scores: { E: 30, I: 70, S: 40, N: 60, T: 65, F: 35, J: 55, P: 45 },
      title: 'Architect',
      titleZh: '建筑师',
      description: 'Strategic thinker',
      descriptionZh: '战略思考者',
      strengths: ['Strategic', 'Independent'],
      careers: ['Engineer', 'Scientist'],
      majors: ['CS', 'Physics'],
    },
    completedAt: new Date('2025-01-15'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentController],
      providers: [
        {
          provide: AssessmentService,
          useValue: {
            getAssessment: jest.fn().mockResolvedValue(mockAssessment),
            submitAssessment: jest.fn().mockResolvedValue(mockResult),
            getHistory: jest.fn().mockResolvedValue([mockResult]),
            getResult: jest.fn().mockResolvedValue(mockResult),
            getSummary: jest.fn().mockResolvedValue({
              latestMbti: mockResult,
              latestHolland: undefined,
              drafts: [],
              historyCount: 1,
              completedTypes: [AssessmentTypeEnum.MBTI],
              majorSuggestions: [{ major: 'CS', sources: ['MBTI'] }],
            }),
            getDraft: jest.fn().mockResolvedValue(null),
            saveDraft: jest.fn().mockResolvedValue({
              id: 'draft-1',
              type: AssessmentTypeEnum.MBTI,
              answers: [{ questionId: 'q1', answer: 'I' }],
              currentQuestionIndex: 0,
              updatedAt: new Date('2025-01-15'),
            }),
            deleteDraft: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AssessmentController>(AssessmentController);
    assessmentService = module.get(AssessmentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAssessment', () => {
    it('should return assessment questions for the given type', async () => {
      const result = await controller.getAssessment(AssessmentTypeEnum.MBTI);

      expect(assessmentService.getAssessment).toHaveBeenCalledWith(
        AssessmentTypeEnum.MBTI,
      );
      expect(result).toEqual(mockAssessment);
    });

    it('should support HOLLAND type', async () => {
      await controller.getAssessment(AssessmentTypeEnum.HOLLAND);

      expect(assessmentService.getAssessment).toHaveBeenCalledWith(
        AssessmentTypeEnum.HOLLAND,
      );
    });

    it('should support MAJOR_MATCH type', async () => {
      await controller.getAssessment(AssessmentTypeEnum.MAJOR_MATCH);

      expect(assessmentService.getAssessment).toHaveBeenCalledWith(
        AssessmentTypeEnum.MAJOR_MATCH,
      );
    });
  });

  describe('submitAssessment', () => {
    it('should submit answers and return assessment result', async () => {
      const dto = {
        type: AssessmentTypeEnum.MBTI,
        answers: [
          { questionId: 'q1', answer: 'I' },
          { questionId: 'q2', answer: 'N' },
        ],
      };

      const result = await controller.submitAssessment(mockUser, dto);

      expect(assessmentService.submitAssessment).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getHistory', () => {
    it('should return assessment history for current user', async () => {
      const result = await controller.getHistory(mockUser);

      expect(assessmentService.getHistory).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockResult]);
    });
  });

  describe('summary and drafts', () => {
    it('should return assessment summary for current user', async () => {
      const result = await controller.getSummary(mockUser);

      expect(assessmentService.getSummary).toHaveBeenCalledWith('user-1');
      expect(result.historyCount).toBe(1);
    });

    it('should get, save, and delete a draft', async () => {
      await controller.getDraft(mockUser, AssessmentTypeEnum.MBTI);
      expect(assessmentService.getDraft).toHaveBeenCalledWith(
        'user-1',
        AssessmentTypeEnum.MBTI,
      );

      await controller.saveDraft(mockUser, AssessmentTypeEnum.MBTI, {
        answers: [{ questionId: 'q1', answer: 'I' }],
        currentQuestionIndex: 0,
      });
      expect(assessmentService.saveDraft).toHaveBeenCalledWith(
        'user-1',
        AssessmentTypeEnum.MBTI,
        {
          answers: [{ questionId: 'q1', answer: 'I' }],
          currentQuestionIndex: 0,
        },
      );

      await controller.deleteDraft(mockUser, AssessmentTypeEnum.MBTI);
      expect(assessmentService.deleteDraft).toHaveBeenCalledWith(
        'user-1',
        AssessmentTypeEnum.MBTI,
      );
    });
  });

  describe('getResult', () => {
    it('should return a single assessment result by id', async () => {
      const result = await controller.getResult(mockUser, 'result-1');

      expect(assessmentService.getResult).toHaveBeenCalledWith(
        'user-1',
        'result-1',
      );
      expect(result).toEqual(mockResult);
    });
  });
});
