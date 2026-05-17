import { ClosureSchedulerService } from './closure-scheduler.service';
import type { PrismaService } from '../../../prisma/prisma.service';

/**
 * Unit tests for the Continuous Closure Engine Tier-1 scheduler.
 * PrismaService is mocked — these verify tick orchestration, closure-rate
 * arithmetic, the overlapping-tick guard, and the never-throw contract.
 */
describe('ClosureSchedulerService', () => {
  const makePrisma = (overrides: Record<string, unknown> = {}) =>
    ({
      closureTarget: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        groupBy: jest.fn().mockResolvedValue([
          { status: 'CLOSED', _count: { _all: 6298 } },
          { status: 'UNAVAILABLE', _count: { _all: 995 } },
          { status: 'PENDING', _count: { _all: 0 } },
        ]),
      },
      school: { findMany: jest.fn().mockResolvedValue([]) },
      highSchool: { findMany: jest.fn().mockResolvedValue([]) },
      ...overrides,
    }) as unknown as PrismaService;

  it('computes the closure rate (CLOSED + UNAVAILABLE are terminal)', async () => {
    const svc = new ClosureSchedulerService(makePrisma());
    const stats = await svc.closureStats();
    expect(stats.total).toBe(7293);
    expect(stats.closed).toBe(7293);
    expect(stats.pending).toBe(0);
    expect(stats.pct).toBe(100);
  });

  it('reports pending targets separately from the closure rate', async () => {
    const prisma = makePrisma();
    (prisma.closureTarget.groupBy as jest.Mock).mockResolvedValue([
      { status: 'CLOSED', _count: { _all: 50 } },
      { status: 'PENDING', _count: { _all: 50 } },
    ]);
    const stats = await new ClosureSchedulerService(prisma).closureStats();
    expect(stats.pct).toBe(50);
    expect(stats.pending).toBe(50);
  });

  it('runs a tick end-to-end and returns stats', async () => {
    const stats = await new ClosureSchedulerService(makePrisma()).tick();
    expect(stats).not.toBeNull();
    expect(stats?.pct).toBe(100);
  });

  it('never throws — a failing tick returns null instead of crashing', async () => {
    const prisma = makePrisma();
    (prisma.school.findMany as jest.Mock).mockRejectedValue(
      new Error('DB down'),
    );
    const result = await new ClosureSchedulerService(prisma).tick();
    expect(result).toBeNull();
  });

  it('skips an overlapping tick while one is already running', async () => {
    const prisma = makePrisma();
    let resolveSchools: (v: unknown[]) => void = () => {};
    (prisma.school.findMany as jest.Mock).mockReturnValue(
      new Promise((r) => {
        resolveSchools = r;
      }),
    );
    const svc = new ClosureSchedulerService(prisma);
    const first = svc.tick();
    const second = await svc.tick(); // second runs while first is mid-flight
    expect(second).toBeNull();
    resolveSchools([]);
    await first;
  });

  it('creates a missing target and flips a PENDING target to CLOSED on sync', async () => {
    const prisma = makePrisma();
    (prisma.closureTarget.findMany as jest.Mock).mockResolvedValue([
      {
        entityType: 'School',
        entityId: 's1',
        field: 'yieldRate',
        status: 'PENDING',
      },
    ]);
    (prisma.school.findMany as jest.Mock).mockResolvedValue([
      {
        id: 's1',
        name: 'Test U',
        usNewsRank: 10,
        isPrivate: true,
        yieldRate: 55,
      },
    ]);
    await new ClosureSchedulerService(prisma).tick();
    // yieldRate now has a value -> the PENDING target is flipped CLOSED
    expect(prisma.closureTarget.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entityType: 'School', entityId: 's1', field: 'yieldRate' },
        data: { status: 'CLOSED' },
      }),
    );
    // a target absent from the queue (e.g. acceptanceRate) gets created
    expect(prisma.closureTarget.create).toHaveBeenCalled();
  });
});
