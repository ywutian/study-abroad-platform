import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentToolsService } from './assessment-tools.service';
import { LLMService } from '../core/llm.service';
import { AssessmentService } from '../../assessment/assessment.service';

describe('AssessmentToolsService', () => {
  let service: AssessmentToolsService;
  let assessmentService: jest.Mocked<AssessmentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentToolsService,
        {
          provide: LLMService,
          useValue: {
            chatSimple: jest
              .fn()
              .mockResolvedValue('{"interpretation":"result"}'),
          },
        },
        {
          provide: AssessmentService,
          useValue: {
            getResults: jest.fn().mockResolvedValue([]),
            getResultById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AssessmentToolsService);
    assessmentService = module.get(AssessmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register tool handlers', () => {
    const handlers = service.getHandlers();
    expect(handlers.has('get_assessment_results')).toBe(true);
    expect(handlers.has('interpret_assessment')).toBe(true);
    expect(handlers.has('suggest_activities_from_assessment')).toBe(true);
  });

  it('should fetch assessment results', async () => {
    assessmentService.getResults.mockResolvedValue([
      { id: 'r1', type: 'mbti', result: { type: 'INTJ' } },
    ] as any);
    const result = await service.getAssessmentResults('user-1', 'mbti', 'en');
    expect(result).toBeDefined();
  });
});
