import { Test, TestingModule } from '@nestjs/testing';
import { SchoolScraperService } from './school-scraper.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SchoolScraperService', () => {
  let service: SchoolScraperService;
  let prisma: PrismaService;

  const mockPrisma = {
    school: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    schoolDeadline: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolScraperService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SchoolScraperService>(SchoolScraperService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getConfiguredSchools', () => {
    it('should return list of configured school names', () => {
      const schools = service.getConfiguredSchools();

      expect(schools.length).toBeGreaterThan(0);
      expect(schools).toContain('Harvard University');
      expect(schools).toContain('Stanford University');
    });
  });

  describe('addSchoolUrls', () => {
    it('should add new school configuration', () => {
      const initialCount = service.getConfiguredSchools().length;

      service.addSchoolUrls('Test University', {
        admissions: 'https://test.edu/apply',
      });

      expect(service.getConfiguredSchools().length).toBe(initialCount + 1);
      expect(service.getConfiguredSchools()).toContain('Test University');
    });
  });

  describe('scrapeSchool', () => {
    it('should return structured data on successful scrape', async () => {
      // Mock fetch globally for this test
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<html><body>Early Decision: November 1. Regular Decision: January 1.</body></html>',
          ),
      });

      const result = await service.scrapeSchool('Test University', {
        deadlines: 'https://test.edu/deadlines',
      });

      expect(result.deadlines).toBeDefined();
      global.fetch = originalFetch;
    });
  });
});
