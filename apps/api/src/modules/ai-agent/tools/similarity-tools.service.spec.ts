import { Test, TestingModule } from '@nestjs/testing';
import { SimilarityToolsService } from './similarity-tools.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileLoaderHelper } from './helpers/profile-loader.helper';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';
import { PersistentMemoryService } from '../memory/persistent-memory.service';

describe('SimilarityToolsService', () => {
  let service: SimilarityToolsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimilarityToolsService,
        {
          provide: PrismaService,
          useValue: {
            admissionCase: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
        {
          provide: ProfileLoaderHelper,
          useValue: {
            getProfileId: jest.fn().mockResolvedValue('profile-1'),
            loadProfile: jest.fn().mockResolvedValue({
              gpa: '3.8',
              gpaScale: '4.0',
              nationality: 'Chinese',
            }),
          },
        },
        {
          provide: SchoolLookupHelper,
          useValue: { findSchool: jest.fn() },
        },
        {
          provide: PersistentMemoryService,
          useValue: {
            searchEntities: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get(SimilarityToolsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register find_similar_applicants handler', () => {
    const handlers = service.getHandlers();
    expect(handlers.has('find_similar_applicants')).toBe(true);
  });
});
