import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { PredictionBenchmarkService } from './benchmark.service';

describe('PredictionBenchmarkService', () => {
  let service: PredictionBenchmarkService;

  const mockPrisma = {
    $transaction: jest.fn(),
    predictionBenchmarkRun: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    predictionBenchmarkComment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionBenchmarkService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<PredictionBenchmarkService>(
      PredictionBenchmarkService,
    );
  });

  describe('listRuns', () => {
    it('returns paginated runs with totals', async () => {
      mockPrisma.$transaction.mockResolvedValue([
        2,
        [
          {
            id: 'run-1',
            ranAt: new Date('2026-05-23'),
            label: null,
            engineVersion: 'm3-v1.3',
            testsPassed: 7,
            testsTotal: 7,
            summary: {},
            notes: null,
            _count: { comments: 0 },
          },
        ],
      ]);

      const result = await service.listRuns({ page: 1, pageSize: 20 });

      expect(result.runs).toHaveLength(1);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('clamps invalid page to 1 and pageSize to 100', async () => {
      mockPrisma.$transaction.mockResolvedValue([0, []]);
      await service.listRuns({ page: 0, pageSize: 999 });
      expect(mockPrisma.predictionBenchmarkRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 100 }),
      );
    });
  });

  describe('getLatestRun', () => {
    it('returns null when no runs exist', async () => {
      mockPrisma.predictionBenchmarkRun.findFirst.mockResolvedValue(null);
      const result = await service.getLatestRun();
      expect(result).toBeNull();
    });

    it('returns the latest run with comments hydrated', async () => {
      mockPrisma.predictionBenchmarkRun.findFirst.mockResolvedValue({
        id: 'run-1',
      });
      const fullRun = {
        id: 'run-1',
        ranAt: new Date(),
        label: null,
        engineVersion: 'm3-v1.3',
        testsPassed: 7,
        testsTotal: 7,
        summary: {},
        tests: [],
        cases: [],
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        comments: [],
      };
      mockPrisma.predictionBenchmarkRun.findUnique.mockResolvedValue(fullRun);
      const result = await service.getLatestRun();
      expect(result?.id).toBe('run-1');
    });
  });

  describe('getRun', () => {
    it('throws 404 when run not found', async () => {
      mockPrisma.predictionBenchmarkRun.findUnique.mockResolvedValue(null);
      await expect(service.getRun('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addComment', () => {
    it('creates comment with trimmed body and null anchor when empty', async () => {
      mockPrisma.predictionBenchmarkRun.findUnique.mockResolvedValue({
        id: 'run-1',
      });
      mockPrisma.predictionBenchmarkComment.create.mockResolvedValue({
        id: 'c1',
        body: 'looks good',
        anchor: null,
        createdAt: new Date(),
        author: {
          id: 'u1',
          email: 'a@b.com',
          role: 'ADMIN',
          profile: { nickname: 'Alice' },
        },
      });

      const created = await service.addComment('run-1', 'u1', {
        body: '  looks good  ',
        anchor: '   ',
      });

      expect(created.body).toBe('looks good');
      expect(mockPrisma.predictionBenchmarkComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            body: 'looks good',
            anchor: null,
          }),
        }),
      );
    });

    it('throws 404 when run does not exist', async () => {
      mockPrisma.predictionBenchmarkRun.findUnique.mockResolvedValue(null);
      await expect(
        service.addComment('missing', 'u1', { body: 'hi' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteComment', () => {
    it('only deletes if requester is the author', async () => {
      mockPrisma.predictionBenchmarkComment.findUnique.mockResolvedValue({
        authorId: 'u2',
      });
      await expect(service.deleteComment('c1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
      expect(
        mockPrisma.predictionBenchmarkComment.delete,
      ).not.toHaveBeenCalled();
    });

    it('deletes when requester is the author', async () => {
      mockPrisma.predictionBenchmarkComment.findUnique.mockResolvedValue({
        authorId: 'u1',
      });
      mockPrisma.predictionBenchmarkComment.delete.mockResolvedValue({});
      const result = await service.deleteComment('c1', 'u1');
      expect(result).toEqual({ deleted: true });
    });
  });
});
