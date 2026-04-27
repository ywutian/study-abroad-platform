import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolWriteService } from '../school/school-write.service';
import { AdminSchoolRatesService } from './admin-school-rates.service';
import type { BulkUpdateSchoolRatesDto } from './dto/bulk-update-school-rates.dto';

/**
 * Coverage for bulk-update endpoint that ingests per-school admit rates from
 * IPEDS / CDS / curated sources. The service is the workhorse for PR-13 IPEDS
 * import (~234 schools in one call) and PR-14 top-30 CDS refinement.
 *
 * Critical behaviors tested:
 *   1. Rate normalization: input 0.418 OR 41.8 both stored as 41.80
 *   2. Idempotency: same input twice → second call updates 0 rows
 *   3. Provenance: source + sourceUrl + cycleYear written to AuditLog
 *   4. Error isolation: one bad row doesn't fail the whole batch
 *   5. dryRun: validates + counts without writing
 *   6. School lookup precedence: schoolId wins over schoolNameNorm
 */
describe('AdminSchoolRatesService', () => {
  let service: AdminSchoolRatesService;
  let prisma: {
    school: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let schoolWrite: { update: jest.Mock };

  const ucd = {
    id: 'ucd-id',
    name: 'University of California, Davis',
    nameNorm: 'university of california, davis',
    acceptanceRate: new Prisma.Decimal(37.0),
    intlAcceptanceRate: null,
    transferAcceptanceRate: null,
    needBlindInternational: false,
  };

  const ucm = {
    id: 'ucm-id',
    name: 'University of California, Merced',
    nameNorm: 'university of california, merced',
    acceptanceRate: new Prisma.Decimal(88.0),
    intlAcceptanceRate: null,
    transferAcceptanceRate: null,
    needBlindInternational: false,
  };

  beforeEach(async () => {
    prisma = {
      school: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    schoolWrite = {
      update: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSchoolRatesService,
        { provide: PrismaService, useValue: prisma },
        { provide: SchoolWriteService, useValue: schoolWrite },
      ],
    }).compile();

    service = module.get(AdminSchoolRatesService);
  });

  // ---------- Normalization ----------

  it('normalizes fraction input (0.418) into Decimal(5,2) percent (41.80)', async () => {
    prisma.school.findMany.mockImplementation(async (args: any) => {
      // by-id lookup
      if (args.where.id) return [ucd];
      return [];
    });
    const dto: BulkUpdateSchoolRatesDto = {
      rows: [
        {
          schoolId: 'ucd-id',
          acceptanceRate: 0.418, // fraction form
          source: 'cds-2024-25:uc-davis',
        },
      ],
    };

    const result = await service.runBulkUpdate(dto, 'admin-user-1');

    expect(result.updated).toBe(1);
    expect(result.skippedNoChange).toBe(0);
    // SchoolWriteService.update called with normalized 41.80 percent
    expect(schoolWrite.update).toHaveBeenCalledWith(
      'ucd-id',
      expect.objectContaining({
        fields: expect.objectContaining({
          acceptanceRate: new Prisma.Decimal(41.8),
        }),
      }),
    );
  });

  it('passes through percent input (41.8) unchanged', async () => {
    prisma.school.findMany.mockImplementation(async (args: any) => {
      if (args.where.id) return [ucd];
      return [];
    });
    await service.runBulkUpdate(
      {
        rows: [{ schoolId: 'ucd-id', acceptanceRate: 41.8, source: 'manual' }],
      },
      'admin-user-1',
    );

    expect(schoolWrite.update).toHaveBeenCalledWith(
      'ucd-id',
      expect.objectContaining({
        fields: expect.objectContaining({
          acceptanceRate: new Prisma.Decimal(41.8),
        }),
      }),
    );
  });

  // ---------- Idempotency ----------

  it('skipNoChange when proposed value equals current value', async () => {
    // Current acceptanceRate is 37.00; submit same value
    prisma.school.findMany.mockImplementation(async (args: any) => {
      if (args.where.id) return [ucd]; // current = 37.00
      return [];
    });

    const result = await service.runBulkUpdate(
      {
        rows: [{ schoolId: 'ucd-id', acceptanceRate: 37.0, source: 'manual' }],
      },
      'admin-user-1',
    );

    expect(result.updated).toBe(0);
    expect(result.skippedNoChange).toBe(1);
    expect(schoolWrite.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('treats values within 0.005 of current as unchanged (Decimal(5,2) precision)', async () => {
    prisma.school.findMany.mockImplementation(async (args: any) => {
      if (args.where.id) return [ucd]; // current = 37.00
      return [];
    });

    const result = await service.runBulkUpdate(
      {
        rows: [
          // 37.001 vs 37.00 — should be treated as no change
          { schoolId: 'ucd-id', acceptanceRate: 37.001, source: 'manual' },
        ],
      },
      'admin-user-1',
    );

    expect(result.skippedNoChange).toBe(1);
    expect(result.updated).toBe(0);
  });

  // ---------- Provenance / audit ----------

  it('writes AuditLog with source + sourceUrl + cycleYear + before/after on real update', async () => {
    prisma.school.findMany.mockImplementation(async (args: any) => {
      if (args.where.id) return [ucd];
      return [];
    });

    await service.runBulkUpdate(
      {
        rows: [
          {
            schoolId: 'ucd-id',
            acceptanceRate: 41.8,
            intlAcceptanceRate: 50.7,
            source: 'cds-2024-25:uc-davis',
            sourceUrl: 'https://aggiedata.ucdavis.edu/.../CDS_UCD.pdf',
            cycleYear: 2024,
          },
        ],
      },
      'admin-actor-1',
    );

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    const auditArg = prisma.auditLog.create.mock.calls[0][0];
    expect(auditArg.data.userId).toBe('admin-actor-1');
    expect(auditArg.data.action).toBe('SCHOOL_RATES_BULK_UPDATE');
    expect(auditArg.data.resource).toBe('school');
    expect(auditArg.data.resourceId).toBe('ucd-id');
    expect(auditArg.data.metadata.source).toBe('cds-2024-25:uc-davis');
    expect(auditArg.data.metadata.sourceUrl).toBe(
      'https://aggiedata.ucdavis.edu/.../CDS_UCD.pdf',
    );
    expect(auditArg.data.metadata.cycleYear).toBe(2024);
    expect(auditArg.data.metadata.changedFields).toEqual(
      expect.arrayContaining(['acceptanceRate', 'intlAcceptanceRate']),
    );
    expect(auditArg.data.metadata.before.acceptanceRate).toBe(37.0);
    expect(auditArg.data.metadata.after.acceptanceRate).toBe(41.8);
    expect(auditArg.data.metadata.after.intlAcceptanceRate).toBe(50.7);
  });

  // ---------- Error isolation ----------

  it('one bad row does not abort the whole batch', async () => {
    // Row 0: valid (UCD)
    // Row 1: missing both schoolId AND schoolNameNorm → error
    // Row 2: nonexistent school → notFound
    prisma.school.findMany.mockImplementation(async (args: any) => {
      if (args.where.id) {
        return [ucd]; // only ucd-id exists; missing-id-99 doesn't
      }
      return [];
    });

    const result = await service.runBulkUpdate(
      {
        rows: [
          {
            schoolId: 'ucd-id',
            acceptanceRate: 41.8,
            source: 'cds-2024-25:uc-davis',
          },
          {
            // No schoolId, no schoolNameNorm
            acceptanceRate: 50.0,
            source: 'manual',
          } as any,
          { schoolId: 'missing-id-99', acceptanceRate: 25.0, source: 'manual' },
        ],
      },
      'admin-1',
    );

    expect(result.scanned).toBe(3);
    expect(result.updated).toBe(1); // UCD
    expect(result.errors).toHaveLength(1); // row 1
    expect(result.errors[0].rowIndex).toBe(1);
    expect(result.errors[0].reason).toContain('schoolId or schoolNameNorm');
    expect(result.notFound).toHaveLength(1); // row 2
    expect(result.notFound[0].rowIndex).toBe(2);
    expect(result.notFound[0].schoolId).toBe('missing-id-99');
  });

  it('rejects rows missing all rate fields', async () => {
    const result = await service.runBulkUpdate(
      {
        rows: [
          {
            schoolId: 'ucd-id',
            source: 'manual',
            // No rate fields, no needBlindInternational
          },
        ],
      },
      'admin-1',
    );

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain('at least one of');
    expect(result.updated).toBe(0);
  });

  // ---------- dryRun ----------

  it('dryRun=true counts changes but does not call update or auditLog', async () => {
    prisma.school.findMany.mockImplementation(async (args: any) => {
      if (args.where.id) return [ucd];
      return [];
    });

    const result = await service.runBulkUpdate(
      {
        rows: [{ schoolId: 'ucd-id', acceptanceRate: 41.8, source: 'manual' }],
        dryRun: true,
      },
      'admin-1',
    );

    expect(result.dryRun).toBe(true);
    expect(result.updated).toBe(1); // would-update count
    expect(schoolWrite.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    // changes[] still populated for transparency
    expect(result.changes[0].changedFields).toContain('acceptanceRate');
    expect(result.changes[0].after.acceptanceRate).toBe(41.8);
  });

  // ---------- Lookup precedence ----------

  it('prefers schoolId over schoolNameNorm when both provided', async () => {
    prisma.school.findMany.mockImplementation(async (args: any) => {
      if (args.where.id) return [ucd];
      // Should not be called for nameNorm since schoolId set
      return [];
    });

    const result = await service.runBulkUpdate(
      {
        rows: [
          {
            schoolId: 'ucd-id',
            schoolNameNorm: 'university of california, davis',
            acceptanceRate: 41.8,
            source: 'manual',
          },
        ],
      },
      'admin-1',
    );

    expect(result.updated).toBe(1);
  });

  it('falls back to schoolNameNorm when schoolId not provided', async () => {
    prisma.school.findMany.mockImplementation(async (args: any) => {
      if (args.where.nameNorm) return [ucm];
      return [];
    });

    const result = await service.runBulkUpdate(
      {
        rows: [
          {
            schoolNameNorm: 'university of california, merced',
            acceptanceRate: 90.0,
            source: 'cds-2024-25:uc-merced',
          },
        ],
      },
      'admin-1',
    );

    expect(result.updated).toBe(1);
    expect(result.changes[0].schoolId).toBe('ucm-id');
    expect(result.changes[0].after.acceptanceRate).toBe(90.0);
  });

  // ---------- Multi-row batch ----------

  it('processes multi-row batch with mix of update / no-change / not-found', async () => {
    prisma.school.findMany.mockImplementation(async (args: any) => {
      if (args.where.id) return [ucd, ucm];
      return [];
    });

    const result = await service.runBulkUpdate(
      {
        rows: [
          { schoolId: 'ucd-id', acceptanceRate: 41.8, source: 'cds:ucd' },
          { schoolId: 'ucm-id', acceptanceRate: 88.0, source: 'cds:ucm' }, // same as current
          { schoolId: 'missing', acceptanceRate: 25.0, source: 'manual' },
        ],
      },
      'admin-1',
    );

    expect(result.scanned).toBe(3);
    expect(result.updated).toBe(1); // UCD
    expect(result.skippedNoChange).toBe(1); // UCM
    expect(result.notFound).toHaveLength(1); // missing
  });
});
