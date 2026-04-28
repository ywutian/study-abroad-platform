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
      expect.arrayContaining(['intlAcceptanceRate', 'sat25', 'sat75']),
    );
    expect(report.fieldTotals.acceptanceRate.filled).toBe(1);
  });

  it('dry-runs heuristic fallback without writing', async () => {
    const result = await service.heuristicFill({ dryRun: true }, 'admin-1');

    expect(result.updated).toBe(1);
    expect(result.changes[0].changedFields).toEqual(
      expect.arrayContaining(['intlAcceptanceRate', 'sat25', 'sat75']),
    );
    expect(result.changes[0].after.intlAcceptanceRate).toBe(38);
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
          }),
        ],
      }),
      'admin-1',
    );
  });
});
