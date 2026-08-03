import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PointsService } from './incentive.service';
import { PointsConfigService, PointAction } from './points-config.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PointsService', () => {
  let service: PointsService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    pointHistory: {
      create: jest.fn().mockResolvedValue({ id: 'point-history-1' }),
      findMany: jest.fn(),
    },
    caseView: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockPointsConfig = {
    isEnabled: jest.fn(),
    getPointValue: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PointsConfigService, useValue: mockPointsConfig },
      ],
    }).compile();

    service = module.get<PointsService>(PointsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserPoints', () => {
    it('should return user points', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ points: 150 });

      const result = await service.getUserPoints('user-1');

      expect(result).toBe(150);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { points: true },
      });
    });

    it('should return 0 when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getUserPoints('nonexistent');

      expect(result).toBe(0);
    });
  });

  describe('adjustPoints', () => {
    it('should skip adjustment when points system is disabled', async () => {
      mockPointsConfig.isEnabled.mockResolvedValue(false);

      const result = await service.adjustPoints(
        'user-1',
        PointAction.SUBMIT_CASE,
      );

      expect(result).toEqual({ success: true, newBalance: 0, points: 0 });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should add points for earn actions', async () => {
      mockPointsConfig.isEnabled.mockResolvedValue(true);
      mockPointsConfig.getPointValue.mockResolvedValue(50);
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.findUnique.mockResolvedValue({ points: 150 });

      const result = await service.adjustPoints(
        'user-1',
        PointAction.SUBMIT_CASE,
      );

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(150);
      expect(result.pointHistoryId).toBe('point-history-1');
      expect(result.points).toBe(50);
      // A credit needs no precondition — only the row must exist.
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { points: { increment: 50 } },
      });
      expect(mockPrisma.pointHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'SUBMIT_CASE',
          points: 50,
        }),
      });
    });

    it('carries the balance precondition in the debit WHERE, not a prior read', async () => {
      // This is the whole fix. The old code read the balance, compared, then
      // incremented unconditionally — so two concurrent debits both saw the
      // pre-spend balance and both went through, taking `User.points` negative
      // (no CHECK constraint backstops it). Sharing a `tx` does not help under
      // READ COMMITTED; only the WHERE makes the check and the write one lock.
      //
      // Asserting the WHERE is what fails if anyone moves the guard back into
      // a preceding read: the call still succeeds, but the precondition is gone.
      mockPointsConfig.isEnabled.mockResolvedValue(true);
      mockPointsConfig.getPointValue.mockResolvedValue(-30);
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.findUnique.mockResolvedValue({ points: 70 });

      const result = await service.adjustPoints(
        'user-1',
        PointAction.AI_ANALYSIS,
      );

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(70);
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', points: { gte: 30 } },
        data: { points: { increment: -30 } },
      });
    });

    it('should fail when insufficient points for deduction', async () => {
      mockPointsConfig.isEnabled.mockResolvedValue(true);
      mockPointsConfig.getPointValue.mockResolvedValue(-30);
      // The database matched no row: the balance was below the cost, or another
      // debit got there first. Nothing was written either way.
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.findUnique.mockResolvedValue({ points: 20 });

      const result = await service.adjustPoints(
        'user-1',
        PointAction.AI_ANALYSIS,
      );

      expect(result.success).toBe(false);
      expect(result.newBalance).toBe(20);
      expect(result.message).toBe('积分不足');
      // No history row for a spend that did not happen.
      expect(mockPrisma.pointHistory.create).not.toHaveBeenCalled();
    });

    it('should return current balance when point value is 0', async () => {
      mockPointsConfig.isEnabled.mockResolvedValue(true);
      mockPointsConfig.getPointValue.mockResolvedValue(0);
      mockPrisma.user.findUnique.mockResolvedValue({ points: 100 });

      const result = await service.adjustPoints(
        'user-1',
        PointAction.SUBMIT_CASE,
      );

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(100);
      expect(result.points).toBe(0);
      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('should use pointsOverride when provided', async () => {
      mockPointsConfig.isEnabled.mockResolvedValue(true);
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.findUnique.mockResolvedValue({ points: 110 });

      const result = await service.adjustPoints(
        'user-1',
        'CUSTOM_ACTION',
        {},
        10,
      );

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(110);
    });
  });

  describe('charge', () => {
    it('should allow charged features for free when points are disabled', async () => {
      mockPointsConfig.isEnabled.mockResolvedValue(false);

      const result = await service.charge(
        'zero-balance-user',
        PointAction.AI_ANALYSIS,
      );

      expect(result).toEqual({
        newBalance: 0,
        pointHistoryId: undefined,
        points: 0,
      });
      expect(mockPointsConfig.getPointValue).not.toHaveBeenCalled();
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.pointHistory.create).not.toHaveBeenCalled();
    });

    it('should deduct points and return new balance', async () => {
      mockPointsConfig.isEnabled.mockResolvedValue(true);
      mockPointsConfig.getPointValue.mockResolvedValue(-20);
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.findUnique.mockResolvedValue({ points: 80 });

      const result = await service.charge(
        'user-1',
        PointAction.VIEW_CASE_DETAIL,
      );

      expect(result.newBalance).toBe(80);
      expect(result.pointHistoryId).toBe('point-history-1');
      expect(result.points).toBe(-20);
    });

    it('should throw BadRequestException when insufficient points', async () => {
      mockPointsConfig.isEnabled.mockResolvedValue(true);
      mockPointsConfig.getPointValue.mockResolvedValue(-30);
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.findUnique.mockResolvedValue({ points: 10 });

      await expect(
        service.charge('user-1', PointAction.AI_ANALYSIS),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reward', () => {
    it('should add points and return new balance', async () => {
      mockPointsConfig.isEnabled.mockResolvedValue(true);
      mockPointsConfig.getPointValue.mockResolvedValue(50);
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.findUnique.mockResolvedValue({ points: 150 });

      const result = await service.reward('user-1', PointAction.SUBMIT_CASE);

      expect(result.newBalance).toBe(150);
    });
  });

  describe('canPerformAction', () => {
    it('should return true when points system is disabled', async () => {
      mockPointsConfig.isEnabled.mockResolvedValue(false);

      const result = await service.canPerformAction(
        'user-1',
        PointAction.AI_ANALYSIS,
      );

      expect(result).toBe(true);
      expect(mockPointsConfig.getPointValue).not.toHaveBeenCalled();
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should return true for earn actions', async () => {
      mockPointsConfig.isEnabled.mockResolvedValue(true);
      mockPointsConfig.getPointValue.mockResolvedValue(50);

      const result = await service.canPerformAction(
        'user-1',
        PointAction.SUBMIT_CASE,
      );

      expect(result).toBe(true);
    });

    it('should return false when insufficient points for spend action', async () => {
      mockPointsConfig.isEnabled.mockResolvedValue(true);
      mockPointsConfig.getPointValue.mockResolvedValue(-30);
      mockPrisma.user.findUnique.mockResolvedValue({ points: 10 });

      const result = await service.canPerformAction(
        'user-1',
        PointAction.AI_ANALYSIS,
      );

      expect(result).toBe(false);
    });
  });

  describe('getPointHistory', () => {
    it('should return point history', async () => {
      const mockHistory = [
        { id: 'h1', action: 'SUBMIT_CASE', points: 50 },
        { id: 'h2', action: 'AI_ANALYSIS', points: -30 },
      ];
      mockPrisma.pointHistory.findMany.mockResolvedValue(mockHistory);

      const result = await service.getPointHistory('user-1', 10);

      expect(result).toHaveLength(2);
      expect(mockPrisma.pointHistory.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });
  });

  describe('chargeViewCaseDetail', () => {
    it('should return true without charging if already viewed', async () => {
      mockPrisma.caseView.findUnique.mockResolvedValue({
        userId: 'user-1',
        caseId: 'case-1',
      });

      const result = await service.chargeViewCaseDetail('user-1', 'case-1');

      expect(result).toBe(true);
      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('should charge and create view record on first view', async () => {
      mockPrisma.caseView.findUnique.mockResolvedValue(null);
      mockPointsConfig.isEnabled.mockResolvedValue(true);
      mockPointsConfig.getPointValue.mockResolvedValue(-20);
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.findUnique.mockResolvedValue({ points: 80 });

      const result = await service.chargeViewCaseDetail('user-1', 'case-1');

      expect(result).toBe(true);
      expect(mockPrisma.caseView.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', caseId: 'case-1' },
      });
    });

    it('should return false when insufficient points', async () => {
      mockPrisma.caseView.findUnique.mockResolvedValue(null);
      mockPointsConfig.isEnabled.mockResolvedValue(true);
      mockPointsConfig.getPointValue.mockResolvedValue(-20);
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.findUnique.mockResolvedValue({ points: 5 });

      const result = await service.chargeViewCaseDetail('user-1', 'case-1');

      expect(result).toBe(false);
      expect(mockPrisma.caseView.create).not.toHaveBeenCalled();
    });
  });
});
