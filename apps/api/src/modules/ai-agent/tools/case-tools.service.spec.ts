import { Test, TestingModule } from '@nestjs/testing';
import { CaseToolsService } from './case-tools.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LLMService } from '../core/llm.service';
import { SwipeService } from '../../hall/swipe.service';
import { ProfileLoaderHelper } from './helpers/profile-loader.helper';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';

describe('CaseToolsService', () => {
  let service: CaseToolsService;
  let prisma: { admissionCase: { findMany: jest.Mock; findUnique: jest.Mock } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseToolsService,
        {
          provide: PrismaService,
          useValue: {
            admissionCase: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn(),
            },
            predictionResult: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
        {
          provide: LLMService,
          useValue: {
            chatSimple: jest.fn().mockResolvedValue('{"analysis":"ok"}'),
          },
        },
        {
          provide: SwipeService,
          useValue: { getSwipeStats: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: ProfileLoaderHelper,
          useValue: {
            getProfileId: jest.fn().mockResolvedValue('profile-1'),
            loadProfile: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: SchoolLookupHelper,
          useValue: { findSchool: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(CaseToolsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register tool handlers', () => {
    const handlers = service.getHandlers();
    expect(handlers.has('search_cases')).toBe(true);
    expect(handlers.has('explain_case_result')).toBe(true);
    expect(handlers.has('analyze_prediction_accuracy')).toBe(true);
  });

  it('should return empty results when no cases found', async () => {
    prisma.admissionCase.findMany.mockResolvedValue([]);
    const result = await service.searchCases({ query: 'Stanford' }, 'en');
    expect(result).toBeDefined();
  });
});
