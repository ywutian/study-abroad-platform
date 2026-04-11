import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SchoolCommunityRatingService } from './school-community-rating.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  AuditAction,
  AuditLogService,
} from '../../common/services/audit-log.service';

describe('SchoolCommunityRatingService', () => {
  let service: SchoolCommunityRatingService;
  const mockPrisma = {
    school: {
      findUnique: jest.fn(),
    },
    schoolCommunityRating: {
      groupBy: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const mockRedis = {
    del: jest.fn().mockResolvedValue(1),
    delByPrefix: jest.fn().mockResolvedValue(1),
  };
  const mockAuditLogService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolCommunityRatingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<SchoolCommunityRatingService>(
      SchoolCommunityRatingService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should hide averages until the public threshold is met', async () => {
    mockPrisma.school.findUnique.mockResolvedValue({ id: 'school-1' });
    mockPrisma.schoolCommunityRating.groupBy.mockResolvedValue([
      {
        schoolId: 'school-1',
        _count: { _all: 4 },
        _avg: {
          safetyRating: 4,
          lifeRating: 3.5,
          foodRating: 3,
        },
      },
    ]);

    const result = await service.getSummary('school-1');

    expect(result).toEqual({
      count: 4,
      safetyAvg: null,
      lifeAvg: null,
      foodAvg: null,
      isPublic: false,
    });
  });

  it('should return empty summaries for schools without ratings', async () => {
    mockPrisma.schoolCommunityRating.groupBy.mockResolvedValue([]);

    const result = await service.getSummariesForSchools([
      'school-1',
      'school-2',
    ]);

    expect(result).toEqual({
      'school-1': {
        count: 0,
        safetyAvg: null,
        lifeAvg: null,
        foodAvg: null,
        isPublic: false,
      },
      'school-2': {
        count: 0,
        safetyAvg: null,
        lifeAvg: null,
        foodAvg: null,
        isPublic: false,
      },
    });
  });

  it('should degrade to empty summaries when the rating table is missing', async () => {
    mockPrisma.schoolCommunityRating.groupBy.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Table missing', {
        code: 'P2021',
        clientVersion: '5.22.0',
      }),
    );

    const result = await service.getSummariesForSchools(['school-1']);

    expect(result).toEqual({
      'school-1': {
        count: 0,
        safetyAvg: null,
        lifeAvg: null,
        foodAvg: null,
        isPublic: false,
      },
    });
  });

  it('should upsert a user rating and invalidate school caches', async () => {
    mockPrisma.school.findUnique.mockResolvedValue({ id: 'school-1' });
    mockPrisma.schoolCommunityRating.upsert.mockResolvedValue({
      id: 'rating-1',
      schoolId: 'school-1',
      userId: 'user-1',
      safetyRating: 5,
      lifeRating: 4,
      foodRating: 3,
      isHidden: false,
      hiddenReason: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-02T00:00:00.000Z'),
    });
    mockPrisma.schoolCommunityRating.groupBy.mockResolvedValue([
      {
        schoolId: 'school-1',
        _count: { _all: 5 },
        _avg: {
          safetyRating: 4.6,
          lifeRating: 4.2,
          foodRating: 3.8,
        },
      },
    ]);

    const result = await service.upsertMyRating('school-1', 'user-1', {
      safetyRating: 5,
      lifeRating: 4,
      foodRating: 3,
    });

    expect(mockPrisma.schoolCommunityRating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          schoolId_userId: {
            schoolId: 'school-1',
            userId: 'user-1',
          },
        },
      }),
    );
    expect(mockRedis.del).toHaveBeenCalledWith('school:detail:school-1');
    expect(mockRedis.delByPrefix).toHaveBeenCalledWith('school:list:');
    expect(result.summary).toEqual({
      count: 5,
      safetyAvg: 4.6,
      lifeAvg: 4.2,
      foodAvg: 3.8,
      isPublic: true,
    });
  });

  it('should hide a rating and write an audit log', async () => {
    mockPrisma.schoolCommunityRating.findUnique.mockResolvedValue({
      id: 'rating-1',
      schoolId: 'school-1',
      isHidden: false,
    });
    mockPrisma.schoolCommunityRating.update.mockResolvedValue({
      id: 'rating-1',
      schoolId: 'school-1',
      isHidden: true,
      hiddenAt: new Date('2026-04-02T00:00:00.000Z'),
      hiddenBy: 'admin-1',
      hiddenReason: 'spam',
    });

    const result = await service.hideRating('rating-1', 'admin-1', 'spam');

    expect(result.isHidden).toBe(true);
    expect(mockAuditLogService.log).toHaveBeenCalledWith({
      userId: 'admin-1',
      action: AuditAction.ADMIN_ACTION,
      resource: 'school-community-ratings',
      resourceId: 'rating-1',
      metadata: {
        action: 'hide',
        schoolId: 'school-1',
        reason: 'spam',
      },
    });
  });

  it('should throw when the school does not exist', async () => {
    mockPrisma.school.findUnique.mockResolvedValue(null);

    await expect(service.getSummary('missing-school')).rejects.toThrow(
      NotFoundException,
    );
  });
});
