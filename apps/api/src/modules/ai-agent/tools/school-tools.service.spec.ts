import { Test, TestingModule } from '@nestjs/testing';
import { SchoolToolsService } from './school-tools.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SchoolLookupHelper } from './helpers/school-lookup.helper';

describe('SchoolToolsService', () => {
  let service: SchoolToolsService;
  let schoolLookup: jest.Mocked<SchoolLookupHelper>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolToolsService,
        {
          provide: PrismaService,
          useValue: {
            school: {
              findUnique: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
        {
          provide: SchoolLookupHelper,
          useValue: {
            findSchool: jest.fn(),
            searchSchools: jest.fn().mockResolvedValue([]),
            sortByRelevance: jest.fn().mockReturnValue([]),
          },
        },
      ],
    }).compile();

    service = module.get(SchoolToolsService);
    schoolLookup = module.get(SchoolLookupHelper);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register tool handlers', () => {
    const handlers = service.getHandlers();
    expect(handlers.has('search_schools')).toBe(true);
    expect(handlers.has('get_school_details')).toBe(true);
    expect(handlers.has('compare_schools')).toBe(true);
  });

  it('should search schools via lookup helper', async () => {
    schoolLookup.searchSchools.mockResolvedValue([
      { id: 's1', name: 'MIT', usNewsRank: 2 } as any,
    ]);
    schoolLookup.sortByRelevance.mockReturnValue([
      { id: 's1', name: 'MIT', usNewsRank: 2 } as any,
    ]);

    const result = await service.searchSchools({ query: 'MIT' });
    expect(schoolLookup.searchSchools).toHaveBeenCalledWith({ query: 'MIT' });
    expect(result).toBeDefined();
  });
});
