import { Test, TestingModule } from '@nestjs/testing';
import { CaseQueryService } from './case-query.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CaseMemoryService } from './case-memory.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role, Visibility } from '@prisma/client';

describe('CaseQueryService', () => {
  let service: CaseQueryService;
  let prisma: PrismaService;

  const mockCase = {
    id: 'case-1',
    userId: 'user-1',
    schoolId: 'school-1',
    visibility: Visibility.ANONYMOUS,
    reviewStatus: 'AUTO_APPROVED',
    result: 'ADMITTED',
    year: 2025,
    school: { id: 'school-1', name: 'MIT', nameZh: '麻省理工' },
  };

  const mockPrisma = {
    admissionCase: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    profile: {
      findUnique: jest.fn(),
    },
  };

  const mockCaseMemoryService = {
    recordViewCaseToMemory: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseQueryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CaseMemoryService, useValue: mockCaseMemoryService },
      ],
    }).compile();

    service = module.get<CaseQueryService>(CaseQueryService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return case for owner', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue(mockCase);

      const result = await service.findById('case-1', 'user-1', Role.USER);

      expect(result.id).toBe('case-1');
    });

    it('should throw NotFoundException when case not found', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue(null);

      await expect(
        service.findById('nonexistent', 'user-1', Role.USER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for private case', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue({
        ...mockCase,
        userId: 'other-user',
        visibility: Visibility.PRIVATE,
      });

      await expect(
        service.findById('case-1', 'user-1', Role.USER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to view any case', async () => {
      mockPrisma.admissionCase.findUnique.mockResolvedValue({
        ...mockCase,
        userId: 'other-user',
        visibility: Visibility.PRIVATE,
      });

      const result = await service.findById('case-1', 'admin-1', Role.ADMIN);

      expect(result.id).toBe('case-1');
    });
  });

  describe('getMyCases', () => {
    it('should return user cases ordered by date', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([mockCase]);

      const result = await service.getMyCases('user-1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
        }),
      );
    });
  });

  describe('getAdminStats', () => {
    it('should return aggregate stats', async () => {
      mockPrisma.admissionCase.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(40)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(10);

      const result = await service.getAdminStats();

      expect(result.total).toBe(100);
      expect(result.withEssay).toBe(40);
      expect(result.verified).toBe(30);
      expect(result.pendingEssays).toBe(10);
    });
  });

  describe("identity is not served with other people's cases", () => {
    // AdmissionCase.userId is the same value the public forum feed publishes as
    // author.id next to profile.realName, so returning it here let anyone join
    // an ANONYMOUS case to a real name over two unauthenticated endpoints.
    const row = {
      id: 'case-1',
      userId: 'owner-1',
      verifiedBy: 'admin-9',
      result: 'ADMITTED',
      visibility: 'ANONYMOUS',
      reviewStatus: 'APPROVED',
      school: { id: 's1', name: 'X' },
    };

    it('omits userId from the public list', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([row]);
      mockPrisma.admissionCase.count.mockResolvedValue(1);

      const res = await service.findAll(
        { page: 1, pageSize: 20 },
        {},
        null,
        null,
      );

      expect(res.items[0]).not.toHaveProperty('userId');
      expect(res.items[0]).not.toHaveProperty('verifiedBy');
      expect(res.items[0].result).toBe('ADMITTED'); // display fields survive
    });

    it('keeps userId for the owner', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([row]);
      mockPrisma.admissionCase.count.mockResolvedValue(1);

      const res = await service.findAll(
        { page: 1, pageSize: 20 },
        {},
        'owner-1',
        null,
      );

      expect(res.items[0]).toHaveProperty('userId', 'owner-1');
    });
  });

  describe('unhonoured share consents', () => {
    // Counts cases written before ba725e79, when verifying an opted-in outcome
    // filed the case at @default(PRIVATE) and no surface ever served it. The
    // `source: null` half is what dates them: outcome_self_report was added in
    // the same commit, so nothing new can match. The number can only go down —
    // if it climbs, a new creation path is forgetting to set visibility.
    it('counts PRIVATE cases with no source, separately from the other stats', async () => {
      const count = mockPrisma.admissionCase.count as jest.Mock;
      count.mockResolvedValue(0);
      count.mockResolvedValueOnce(100); // total
      count.mockResolvedValueOnce(40); // withEssay
      count.mockResolvedValueOnce(25); // verified
      count.mockResolvedValueOnce(7); // pendingEssays
      count.mockResolvedValueOnce(13); // unhonoured share consents

      const stats = await service.getAdminStats();

      expect(stats.unhonouredShareConsents).toBe(13);
      expect(count).toHaveBeenCalledWith({
        where: { visibility: 'PRIVATE', source: null },
      });
    });
  });
});
