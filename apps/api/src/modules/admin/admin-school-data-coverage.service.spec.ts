import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolWriteService } from '../school/school-write.service';
import { UrbanInstituteDataService } from '../school/urban-institute-data.service';
import { AdminSchoolRatesService } from './admin-school-rates.service';
import { AdminSchoolDataCoverageService } from './admin-school-data-coverage.service';

describe('AdminSchoolDataCoverageService', () => {
  let service: AdminSchoolDataCoverageService;
  let prisma: {
    school: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let schoolWrite: { update: jest.Mock };
  let urban: { syncAdmissions: jest.Mock };
  let schoolRates: { runBulkUpdate: jest.Mock };

  const school = {
    id: 'school-1',
    name: 'Example University',
    nameZh: null,
    country: 'US',
    state: 'CA',
    isPrivate: false,
    usNewsRank: 50,
    acceptanceRate: new Prisma.Decimal(40),
    intlAcceptanceRate: null,
    oosAcceptanceRate: null,
    sat25: null,
    satAvg: null,
    sat75: null,
    act25: null,
    actAvg: null,
    act75: null,
    testOptional: null,
    testingPolicy: 'UNKNOWN',
    needBlindInternational: false,
    metadata: {
      provenance: {
        acceptanceRate: {
          source: 'COLLEGE_SCORECARD',
          fetchedAt: '2026-01-01T00:00:00.000Z',
          tier: 'OFFICIAL',
        },
      },
    },
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    scorecardId: '123',
    ipedsId: '456',
  };

  beforeEach(async () => {
    prisma = {
      school: { findMany: jest.fn().mockResolvedValue([school]) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    schoolWrite = { update: jest.fn().mockResolvedValue({}) };
    urban = { syncAdmissions: jest.fn().mockResolvedValue({ synced: 1 }) };
    schoolRates = {
      runBulkUpdate: jest.fn().mockResolvedValue({ updated: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSchoolDataCoverageService,
        { provide: PrismaService, useValue: prisma },
        { provide: SchoolWriteService, useValue: schoolWrite },
        { provide: UrbanInstituteDataService, useValue: urban },
        { provide: AdminSchoolRatesService, useValue: schoolRates },
      ],
    }).compile();

    service = module.get(AdminSchoolDataCoverageService);
  });

  it('reports missing critical prediction fields', async () => {
    const report = await service.getCoverage();

    expect(report.totals.schools).toBe(1);
    expect(report.totals.missingAnyCritical).toBe(1);
    expect(report.items[0].missingCritical).toEqual(
      expect.arrayContaining([
        'intlAcceptanceRate',
        'oosAcceptanceRate',
        'sat25',
        'sat75',
      ]),
    );
    expect(report.fieldTotals.acceptanceRate.filled).toBe(1);
    expect(report.fieldTotals.acceptanceRate.official).toBe(1);
    expect(report.totals.officialFields).toBeGreaterThanOrEqual(1);
  });

  it('buckets terminal unavailable fields without treating them as missing', async () => {
    prisma.school.findMany.mockResolvedValueOnce([
      {
        ...school,
        metadata: {
          provenance: {
            ...((school.metadata as any).provenance ?? {}),
            intlAcceptanceRate: {
              source: 'OFFICIAL_BLOCKED',
              fetchedAt: '2026-01-03T00:00:00.000Z',
              tier: 'UNAVAILABLE',
              realDataStatus: 'OFFICIAL_BLOCKED',
              reason: 'Official IR page blocks automated access.',
            },
          },
        },
      },
    ]);

    const report = await service.getCoverage();
    const terminalField = report.items[0].fields.find(
      (field) => field.field === 'intlAcceptanceRate',
    );

    expect(report.items[0].missingCritical).not.toContain('intlAcceptanceRate');
    expect(report.items[0].terminalCritical).toContain('intlAcceptanceRate');
    expect(report.fieldTotals.intlAcceptanceRate.terminal).toBe(1);
    expect(terminalField).toEqual(
      expect.objectContaining({
        bucket: 'terminal',
        isTerminal: true,
        terminalStatus: 'OFFICIAL_BLOCKED',
      }),
    );
  });

  it('dry-runs heuristic fallback without writing', async () => {
    const result = await service.heuristicFill({ dryRun: true }, 'admin-1');

    expect(result.updated).toBe(1);
    expect(result.changes[0].changedFields).toEqual(
      expect.arrayContaining([
        'intlAcceptanceRate',
        'oosAcceptanceRate',
        'sat25',
        'sat75',
      ]),
    );
    expect(result.changes[0].after.intlAcceptanceRate).toBe(38);
    expect(result.changes[0].after.oosAcceptanceRate).toBe(38);
    expect(schoolWrite.update).not.toHaveBeenCalled();
  });

  it('writes low-confidence HEURISTIC provenance on live fill', async () => {
    await service.heuristicFill({ dryRun: false }, 'admin-1');

    expect(schoolWrite.update).toHaveBeenCalledWith(
      'school-1',
      expect.objectContaining({
        provenance: expect.objectContaining({
          intlAcceptanceRate: expect.objectContaining({
            source: 'HEURISTIC:PR-15',
            confidence: 0.55,
            verifiedBy: 'admin-1',
          }),
        }),
      }),
    );
  });

  it('falls back to schoolNameNorm when importing IPEDS rows without local ipedsId', async () => {
    prisma.school.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'school-by-name', nameNorm: 'example university' },
      ]);

    await service.importIpedsCsvRows(
      {
        dryRun: true,
        cycleYear: 2023,
        rows: [
          {
            unitid: '999999',
            schoolNameNorm: 'example university',
            acceptanceRate: 42,
          },
        ],
      },
      'admin-1',
    );

    expect(schoolRates.runBulkUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: true,
        rows: [
          expect.objectContaining({
            schoolId: 'school-by-name',
            unitid: '999999',
            source: 'IPEDS_CSV:2023:unitid-999999',
            sourceUrl: 'https://nces.ed.gov/ipeds/use-the-data',
          }),
        ],
      }),
      'admin-1',
    );
  });

  it('returns coverage diff after a live IPEDS import', async () => {
    const beforeSchool = {
      ...school,
      intlAcceptanceRate: new Prisma.Decimal(38),
      metadata: {
        provenance: {
          ...((school.metadata as any).provenance ?? {}),
          intlAcceptanceRate: {
            source: 'HEURISTIC:PR-15',
            fetchedAt: '2026-01-01T00:00:00.000Z',
            tier: 'INFERRED',
            confidence: 0.55,
          },
        },
      },
    };
    const afterSchool = {
      ...beforeSchool,
      metadata: {
        provenance: {
          ...((beforeSchool.metadata as any).provenance ?? {}),
          intlAcceptanceRate: {
            source: 'IPEDS_CSV:2024:unitid-456',
            sourceUrl: 'https://nces.ed.gov/ipeds/use-the-data',
            fetchedAt: '2026-01-02T00:00:00.000Z',
            tier: 'OFFICIAL',
            cycleYear: 2024,
          },
        },
      },
    };

    prisma.school.findMany
      .mockResolvedValueOnce([beforeSchool])
      .mockResolvedValueOnce([{ id: 'school-1', ipedsId: '456' }])
      .mockResolvedValueOnce([afterSchool]);
    schoolRates.runBulkUpdate.mockResolvedValueOnce({ updated: 1 });

    const result = await service.importIpedsCsvRows(
      {
        dryRun: false,
        cycleYear: 2024,
        rows: [{ unitid: '456', intlAcceptanceRate: 38 }],
      },
      'admin-1',
    );

    expect(result.coverageDiff).toEqual(
      expect.objectContaining({
        totals: expect.objectContaining({
          officialFields: 1,
          heuristicFields: -1,
        }),
      }),
    );
    expect(result.coverageDiff?.fields.intlAcceptanceRate).toEqual(
      expect.objectContaining({
        official: 1,
        heuristic: -1,
      }),
    );
  });
});
