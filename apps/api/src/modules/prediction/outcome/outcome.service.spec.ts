import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { OutcomeService } from './outcome.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PointsService } from '../../points/incentive.service';

const mockPrisma = {
  predictionResult: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  predictionOutcomeLabelRecord: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
  school: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  schoolListItem: {
    findMany: jest.fn(),
  },
  schoolDeadline: {
    findMany: jest.fn(),
  },
  profile: {
    findUnique: jest.fn(),
  },
  admissionCase: {
    create: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(null),
  },
};

const mockIncentive = {
  adjustPoints: jest.fn().mockResolvedValue({ success: true, newBalance: 100 }),
};

describe('OutcomeService', () => {
  let service: OutcomeService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutcomeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PointsService, useValue: mockIncentive },
      ],
    }).compile();
    service = module.get<OutcomeService>(OutcomeService);
  });

  describe('submit', () => {
    it('creates a new SELF_REPORTED outcome', async () => {
      mockPrisma.predictionResult.findUnique.mockResolvedValue({
        id: 'pred1',
        profile: { userId: 'user1' },
        schoolId: 'school1',
        applicationRound: 'EA',
        probability: 0.3,
      });
      mockPrisma.school.findUnique.mockResolvedValue({ name: 'Stanford' });
      mockPrisma.predictionOutcomeLabelRecord.findFirst.mockResolvedValue(null);
      mockPrisma.predictionOutcomeLabelRecord.create.mockResolvedValue({
        id: 'out1',
        predictionResultId: 'pred1',
        result: 'ADMITTED',
        status: 'SELF_REPORTED',
        notes: null,
        evidenceUrl: null,
        round: 'EA',
        isFinal: true,
        reportedBy: 'user1',
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.submit('user1', {
        predictionResultId: 'pred1',
        result: 'ADMITTED',
      } as any);

      expect(result.result).toBe('ADMITTED');
      expect(result.status).toBe('SELF_REPORTED');
      expect(result.schoolName).toBe('Stanford');
      expect(
        mockPrisma.predictionOutcomeLabelRecord.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            predictionResultId: 'pred1',
            result: 'ADMITTED',
            status: 'SELF_REPORTED',
            reportedBy: 'user1',
          }),
        }),
      );
      // First-time report should award points
      expect(mockIncentive.adjustPoints).toHaveBeenCalledWith(
        'user1',
        'SUBMIT_CASE',
        expect.objectContaining({ source: 'outcome-report' }),
      );
    });

    it('rejects if prediction does not belong to user', async () => {
      mockPrisma.predictionResult.findUnique.mockResolvedValue({
        id: 'pred1',
        profile: { userId: 'other-user' },
        schoolId: 'school1',
      });

      await expect(
        service.submit('user1', {
          predictionResultId: 'pred1',
          result: 'ADMITTED',
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects if prediction does not exist', async () => {
      mockPrisma.predictionResult.findUnique.mockResolvedValue(null);

      await expect(
        service.submit('user1', {
          predictionResultId: 'missing',
          result: 'ADMITTED',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates existing record on re-submit (idempotent)', async () => {
      mockPrisma.predictionResult.findUnique.mockResolvedValue({
        id: 'pred1',
        profile: { userId: 'user1' },
        schoolId: 'school1',
        applicationRound: 'ED',
        probability: 0.15,
      });
      mockPrisma.school.findUnique.mockResolvedValue({ name: 'Harvard' });
      mockPrisma.predictionOutcomeLabelRecord.findFirst.mockResolvedValue({
        id: 'existing-out',
        status: 'SELF_REPORTED',
      });
      mockPrisma.predictionOutcomeLabelRecord.update.mockResolvedValue({
        id: 'existing-out',
        predictionResultId: 'pred1',
        result: 'REJECTED',
        status: 'SELF_REPORTED',
        notes: 'changed my mind',
        evidenceUrl: null,
        round: 'ED',
        isFinal: true,
        reportedBy: 'user1',
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.submit('user1', {
        predictionResultId: 'pred1',
        result: 'REJECTED',
        notes: 'changed my mind',
      } as any);

      expect(result.id).toBe('existing-out');
      expect(mockPrisma.predictionOutcomeLabelRecord.update).toHaveBeenCalled();
      expect(
        mockPrisma.predictionOutcomeLabelRecord.create,
      ).not.toHaveBeenCalled();
      // Re-submit should NOT award points again (anti-spam)
      expect(mockIncentive.adjustPoints).not.toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('upgrades SELF_REPORTED → COUNSELOR_VERIFIED with admin note', async () => {
      mockPrisma.predictionOutcomeLabelRecord.findUnique.mockResolvedValue({
        id: 'out1',
        status: 'SELF_REPORTED',
        notes: null,
        evidenceUrl: null,
        reportedBy: 'user1',
        predictionResult: {
          id: 'pred1',
          schoolId: 's1',
          probability: 0.3,
        },
      });
      mockPrisma.predictionOutcomeLabelRecord.update.mockResolvedValue({
        id: 'out1',
        status: 'COUNSELOR_VERIFIED',
        result: 'ADMITTED',
        notes: '[admin] looks good',
        evidenceUrl: null,
        round: 'EA',
        isFinal: true,
        reportedBy: 'user1',
        resolvedBy: 'admin1',
        resolvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        predictionResult: { schoolId: 's1', probability: 0.3 },
      });
      mockPrisma.school.findUnique.mockResolvedValue({ name: 'Yale' });

      const result = await service.verify('out1', 'admin1', {
        status: 'COUNSELOR_VERIFIED',
        reviewNote: 'looks good',
      } as any);

      expect(result.status).toBe('COUNSELOR_VERIFIED');
      expect(
        mockPrisma.predictionOutcomeLabelRecord.update,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COUNSELOR_VERIFIED',
            resolvedBy: 'admin1',
          }),
        }),
      );
      // Verification should award CASE_VERIFIED points
      expect(mockIncentive.adjustPoints).toHaveBeenCalledWith(
        'user1',
        'CASE_VERIFIED',
        expect.objectContaining({ source: 'outcome-verification' }),
      );
    });

    it('rejects DOCUMENT_VERIFIED upgrade without evidenceUrl', async () => {
      mockPrisma.predictionOutcomeLabelRecord.findUnique.mockResolvedValue({
        id: 'out1',
        status: 'SELF_REPORTED',
        evidenceUrl: null,
        predictionResult: { schoolId: 's1', probability: 0.3 },
      });

      await expect(
        service.verify('out1', 'admin1', {
          status: 'DOCUMENT_VERIFIED',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects re-verification of already-verified outcome', async () => {
      mockPrisma.predictionOutcomeLabelRecord.findUnique.mockResolvedValue({
        id: 'out1',
        status: 'COUNSELOR_VERIFIED',
        predictionResult: { schoolId: 's1', probability: 0.3 },
      });

      await expect(
        service.verify('out1', 'admin1', {
          status: 'DOCUMENT_VERIFIED',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('attachEvidence', () => {
    it("attaches evidence URL to user's own outcome", async () => {
      mockPrisma.predictionOutcomeLabelRecord.findUnique.mockResolvedValue({
        id: 'out1',
        status: 'SELF_REPORTED',
        reportedBy: 'user1',
        predictionResult: { schoolId: 's1', probability: 0.3 },
      });
      mockPrisma.predictionOutcomeLabelRecord.update.mockResolvedValue({
        id: 'out1',
        status: 'SELF_REPORTED',
        result: 'ADMITTED',
        notes: null,
        evidenceUrl: 'https://storage/letter.pdf',
        round: 'ED',
        isFinal: true,
        reportedBy: 'user1',
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        predictionResult: { schoolId: 's1', probability: 0.3 },
      });
      mockPrisma.school.findUnique.mockResolvedValue({ name: 'Yale' });

      const result = await service.attachEvidence(
        'user1',
        'out1',
        'https://storage/letter.pdf',
      );

      expect(result.evidenceUrl).toBe('https://storage/letter.pdf');
    });

    it("forbids attaching to others' outcomes", async () => {
      mockPrisma.predictionOutcomeLabelRecord.findUnique.mockResolvedValue({
        id: 'out1',
        status: 'SELF_REPORTED',
        reportedBy: 'other-user',
        predictionResult: { schoolId: 's1' },
      });

      await expect(
        service.attachEvidence('user1', 'out1', 'https://storage/x.pdf'),
      ).rejects.toThrow(/Cannot modify/);
    });

    it('rejects attaching to already-verified outcomes', async () => {
      mockPrisma.predictionOutcomeLabelRecord.findUnique.mockResolvedValue({
        id: 'out1',
        status: 'COUNSELOR_VERIFIED',
        reportedBy: 'user1',
        predictionResult: { schoolId: 's1' },
      });

      await expect(
        service.attachEvidence('user1', 'out1', 'https://storage/x.pdf'),
      ).rejects.toThrow(/SELF_REPORTED/);
    });
  });

  describe('listPendingDecisions', () => {
    it('returns predictions for saved schools whose decision day has passed', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({ id: 'prof1' });
      mockPrisma.schoolListItem.findMany.mockResolvedValue([
        { schoolId: 's1' },
        { schoolId: 's2' },
      ]);
      mockPrisma.schoolDeadline.findMany.mockResolvedValue([
        // year matters: the service pairs schoolId+season now, so bare
        // schoolIds would silently match nothing.
        { schoolId: 's1', year: 2027 },
        { schoolId: 's2', year: 2027 },
      ]);
      mockPrisma.predictionResult.findMany.mockResolvedValue([
        {
          id: 'p1',
          schoolId: 's1',
          probability: 0.3,
          tier: 'reach',
          applicationRound: 'EA',
          applicationYear: 2027,
          createdAt: new Date(),
        },
        {
          id: 'p2',
          schoolId: 's2',
          probability: 0.6,
          tier: 'match',
          applicationRound: 'RD',
          applicationYear: 2027,
          createdAt: new Date(),
        },
      ]);
      mockPrisma.school.findMany.mockResolvedValue([
        { id: 's1', name: 'Stanford' },
        { id: 's2', name: 'UCLA' },
      ]);

      const result = await service.listPendingDecisions('user1');

      expect(result).toHaveLength(2);
      expect(result[0].schoolName).toBe('Stanford');
      expect(result[1].schoolName).toBe('UCLA');
    });

    it('returns one row per school when two seasons exist', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({ id: 'prof1' });
      mockPrisma.schoolListItem.findMany.mockResolvedValue([
        { schoolId: 's1' },
      ]);
      mockPrisma.schoolDeadline.findMany.mockResolvedValue([
        { schoolId: 's1', year: 2027 },
        { schoolId: 's1', year: 2028 },
      ]);
      mockPrisma.predictionResult.findMany.mockResolvedValue([
        {
          id: 'p-new',
          schoolId: 's1',
          probability: 0.4,
          tier: 'reach',
          applicationRound: 'RD',
          applicationYear: 2028,
          createdAt: new Date('2026-08-01T00:00:00Z'),
        },
        {
          id: 'p-old',
          schoolId: 's1',
          probability: 0.3,
          tier: 'reach',
          applicationRound: 'RD',
          applicationYear: 2027,
          createdAt: new Date('2025-08-01T00:00:00Z'),
        },
      ]);
      mockPrisma.school.findMany.mockResolvedValue([
        { id: 's1', name: 'Stanford' },
      ]);

      const result = await service.listPendingDecisions('user1');
      expect(result).toHaveLength(1);
      expect(result[0].predictionResultId).toBe('p-new');
    });

    it('returns empty when no profile', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);
      const result = await service.listPendingDecisions('user1');
      expect(result).toEqual([]);
    });

    it('returns empty when the user has no saved school list (the "50 schools" bug)', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({ id: 'prof1' });
      mockPrisma.schoolListItem.findMany.mockResolvedValue([]);

      const result = await service.listPendingDecisions('user1');

      expect(result).toEqual([]);
      // Must never fall back to counting every school ever predicted.
      expect(mockPrisma.predictionResult.findMany).not.toHaveBeenCalled();
    });

    it('ignores a decision released in a DIFFERENT season (the historical-row bug)', async () => {
      // THE BUG: SchoolDeadline accumulates one row per school per season, and
      // the released check was a bare `decisionDate <= now`. So a school whose
      // 2024 round closed marked a 2027 applicant as "go report your result"
      // for an application they never submitted.
      mockPrisma.profile.findUnique.mockResolvedValue({ id: 'prof1' });
      mockPrisma.schoolListItem.findMany.mockResolvedValue([
        { schoolId: 's1' },
      ]);
      mockPrisma.predictionResult.findMany.mockResolvedValue([
        {
          id: 'p1',
          schoolId: 's1',
          probability: 0.3,
          tier: 'reach',
          applicationRound: 'RD',
          applicationYear: 2027,
          createdAt: new Date(),
        },
      ]);
      // Only the 2024 cycle has released. Same school, wrong season.
      mockPrisma.schoolDeadline.findMany.mockResolvedValue([
        { schoolId: 's1', year: 2024 },
      ]);

      const result = await service.listPendingDecisions('user1');

      expect(result).toEqual([]);
    });

    it('does not offer a prediction whose season is unknown (legacy null row)', async () => {
      // Rows written before prediction-persistence stamped applicationYear.
      // null means "season unknown", which cannot support "this decision is
      // out" — so they are withheld rather than matched against any season.
      mockPrisma.profile.findUnique.mockResolvedValue({ id: 'prof1' });
      mockPrisma.schoolListItem.findMany.mockResolvedValue([
        { schoolId: 's1' },
      ]);
      mockPrisma.predictionResult.findMany.mockResolvedValue([
        {
          id: 'legacy',
          schoolId: 's1',
          probability: 0.3,
          tier: 'reach',
          applicationRound: 'RD',
          applicationYear: null,
          createdAt: new Date(),
        },
      ]);

      const result = await service.listPendingDecisions('user1');

      expect(result).toEqual([]);
      // Withheld BEFORE querying deadlines — there is no season to query for.
      expect(mockPrisma.schoolDeadline.findMany).not.toHaveBeenCalled();
    });

    it('returns empty when no saved school has reached its decision day (pre-applicant)', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({ id: 'prof1' });
      mockPrisma.schoolListItem.findMany.mockResolvedValue([
        { schoolId: 's1' },
      ]);
      // The user HAS predicted; no deadline for that season has released yet.
      mockPrisma.predictionResult.findMany.mockResolvedValue([
        {
          id: 'p1',
          schoolId: 's1',
          probability: 0.2,
          tier: 'reach',
          applicationRound: 'RD',
          applicationYear: 2027,
          createdAt: new Date(),
        },
      ]);
      mockPrisma.schoolDeadline.findMany.mockResolvedValue([]);

      const result = await service.listPendingDecisions('user1');

      // Asserts the RESULT, not the call order. Predictions are fetched before
      // deadlines now so each row's own season can be matched; the old
      // `predictionResult.findMany not.toHaveBeenCalled()` was pinning that
      // ordering, not the behaviour anyone cares about.
      expect(result).toEqual([]);
    });
  });

  describe('getMyStats', () => {
    it('aggregates outcome counts and points by tier', async () => {
      mockPrisma.predictionOutcomeLabelRecord.groupBy.mockResolvedValue([
        { status: 'SELF_REPORTED', _count: 3 },
        { status: 'COUNSELOR_VERIFIED', _count: 1 },
        { status: 'DOCUMENT_VERIFIED', _count: 1 },
      ]);

      const result = await service.getMyStats('user1');
      expect(result.totalReported).toBe(5);
      expect(result.selfReported).toBe(3);
      expect(result.verified).toBe(2);
      // 3*50 + 1*150 + 1*300 = 600
      expect(result.pointsEarned).toBe(600);
    });
  });

  describe('share opt-in → AdmissionCase', () => {
    // The opt-in copy promises "匿名分享给学弟学妹 … 加入案例库". A case born
    // @default(PRIVATE) is served by no public surface, and admin approval only
    // moves reviewStatus — so the promise was never kept.
    const outcomeRecord = {
      id: 'out1',
      reportedBy: 'user-1',
      result: 'ADMITTED',
      round: 'ED',
      notes: 'got in [share=true]',
      predictionResult: {
        schoolId: 'school-1',
        applicationRound: 'ED',
        profile: {
          user: { id: 'user-1' },
          targetMajor: 'CS',
          testScores: [],
          activities: [],
          awards: [],
          education: [],
        },
      },
    };

    it('creates the case as ANONYMOUS and tags its source', async () => {
      mockPrisma.predictionOutcomeLabelRecord.findUnique.mockResolvedValue(
        outcomeRecord,
      );
      mockPrisma.admissionCase.create.mockResolvedValue({ id: 'case-1' });

      await (
        service as unknown as {
          createAdmissionCaseFromOutcome: (id: string) => Promise<void>;
        }
      ).createAdmissionCaseFromOutcome('out1');

      expect(mockPrisma.admissionCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            visibility: 'ANONYMOUS',
            source: 'outcome_self_report',
          }),
        }),
      );
    });
  });
});
