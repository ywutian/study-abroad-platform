import { Test, TestingModule } from '@nestjs/testing';
import { RankingToolsService } from './ranking-tools.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LLMService } from '../core/llm.service';
import { HallService } from '../../hall/hall.service';
import { ProfileLoaderHelper } from './helpers/profile-loader.helper';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';

describe('RankingToolsService', () => {
  let service: RankingToolsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RankingToolsService,
        {
          provide: PrismaService,
          useValue: {
            admissionCase: { findMany: jest.fn().mockResolvedValue([]) },
            profile: { findUnique: jest.fn() },
            hallProfile: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
        {
          provide: LLMService,
          useValue: {
            chatSimple: jest.fn().mockResolvedValue('{"suggestions":[]}'),
          },
        },
        {
          provide: HallService,
          useValue: {
            getPublicProfiles: jest.fn().mockResolvedValue({ data: [] }),
          },
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

    service = module.get(RankingToolsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register tool handlers', () => {
    const handlers = service.getHandlers();
    expect(handlers.has('analyze_profile_ranking')).toBe(true);
    expect(handlers.has('suggest_profile_improvements')).toBe(true);
    expect(handlers.has('compare_with_admitted_profiles')).toBe(true);
  });
});
