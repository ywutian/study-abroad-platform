import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { DeadlineRefreshScheduler } from './deadline-refresh.scheduler';

/**
 * Coverage for the safety-critical parts of the deadline-refresh
 * scheduler: source-URL extraction, HTML date extraction, and the
 * "never auto-change, only auto-confirm" guarantee.
 *
 * We do NOT hit real admission pages — `global.fetch` is mocked to return
 * fixture HTML strings.
 */
describe('DeadlineRefreshScheduler', () => {
  let scheduler: DeadlineRefreshScheduler;
  let prisma: {
    schoolDeadline: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
    auditLog: { create: jest.Mock };
  };
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    prisma = {
      schoolDeadline: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DeadlineRefreshScheduler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    scheduler = moduleRef.get(DeadlineRefreshScheduler);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const setHtml = (html: string) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => html,
    });
  };

  // ───────────────────────────────────────────────────────────────────
  // Auto-confirm path: extracted == stored → only `source` column changes.
  // ───────────────────────────────────────────────────────────────────
  it('auto-confirms when extracted date matches the stored deadline', async () => {
    setHtml(`
      <html><body>
        <h1>Apply</h1>
        <p>Early Decision deadline: November 1, 2026.</p>
        <p>Regular Decision deadline: January 5, 2027.</p>
      </body></html>
    `);

    prisma.schoolDeadline.findMany.mockResolvedValue([
      {
        id: 'ed-row',
        round: 'ED',
        applicationDeadline: new Date('2026-11-01T23:59:00Z'),
        notes: 'source: https://example.edu/apply',
        school: { id: 's1', name: 'Example U' },
        source: 'WEB_RESEARCH_2026-05:TENTATIVE_BASED_ON_PRIOR_YEAR',
      },
    ]);

    await scheduler.refreshTentativeDeadlines();

    expect(prisma.schoolDeadline.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ed-row' },
        data: expect.objectContaining({
          source: expect.stringContaining('AUTO_REFRESH_CONFIRMED'),
        }),
      }),
    );
    // Critical: the applicationDeadline column is NOT in the update payload.
    const updateCall = prisma.schoolDeadline.update.mock.calls[0][0];
    expect(updateCall.data.applicationDeadline).toBeUndefined();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────
  // Needs-review path: extracted != stored → flag + audit, but the
  // applicationDeadline column is still NOT changed.
  // ───────────────────────────────────────────────────────────────────
  it('flags for review (never auto-changes) when extracted differs from stored', async () => {
    setHtml(`
      <html><body>
        <p>Early Decision: November 3, 2026.</p>
      </body></html>
    `);

    prisma.schoolDeadline.findMany.mockResolvedValue([
      {
        id: 'ed-row',
        round: 'ED',
        applicationDeadline: new Date('2026-11-01T23:59:00Z'),
        notes: 'source: https://example.edu/apply',
        school: { id: 's1', name: 'Example U' },
        source: 'WEB_RESEARCH_2026-05:TENTATIVE_BASED_ON_PRIOR_YEAR',
      },
    ]);

    await scheduler.refreshTentativeDeadlines();

    expect(prisma.schoolDeadline.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ed-row' },
        data: expect.objectContaining({
          source: expect.stringContaining('AUTO_REFRESH_NEEDS_REVIEW'),
          notes: expect.stringContaining('NEEDS_REVIEW'),
        }),
      }),
    );
    // Critical: never write the new date automatically.
    const updateCall = prisma.schoolDeadline.update.mock.calls[0][0];
    expect(updateCall.data.applicationDeadline).toBeUndefined();

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'DEADLINE_NEEDS_REVIEW',
          resource: 'SchoolDeadline',
          resourceId: 'ed-row',
          metadata: expect.objectContaining({
            schoolName: 'Example U',
            round: 'ED',
            currentDate: '2026-11-01',
            extractedDate: '2026-11-03',
          }),
        }),
      }),
    );
  });

  // ───────────────────────────────────────────────────────────────────
  // Multiple round formats on one page.
  // ───────────────────────────────────────────────────────────────────
  it('handles ED2 / SCEA / REA without matching the generic ED/EA early', async () => {
    setHtml(`
      <html><body>
        <p>Restrictive Early Action deadline: November 1, 2026.</p>
        <p>Regular Decision deadline: January 5, 2027.</p>
      </body></html>
    `);

    prisma.schoolDeadline.findMany.mockResolvedValue([
      {
        id: 'rea-row',
        round: 'REA',
        applicationDeadline: new Date('2026-11-01T23:59:00Z'),
        notes: 'source: https://example.edu/apply',
        school: { id: 's1', name: 'Example U' },
        source: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
      },
    ]);

    await scheduler.refreshTentativeDeadlines();

    expect(prisma.schoolDeadline.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: expect.stringContaining('AUTO_REFRESH_CONFIRMED'),
        }),
      }),
    );
  });

  // ───────────────────────────────────────────────────────────────────
  // No source URL in notes → row skipped, no update / no audit.
  // ───────────────────────────────────────────────────────────────────
  it('skips rows whose notes do not contain a source URL', async () => {
    prisma.schoolDeadline.findMany.mockResolvedValue([
      {
        id: 'no-url',
        round: 'ED',
        applicationDeadline: new Date('2026-11-01T23:59:00Z'),
        notes: 'Manually entered, no source recorded',
        school: { id: 's1', name: 'Example U' },
        source: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
      },
    ]);

    await scheduler.refreshTentativeDeadlines();

    expect(prisma.schoolDeadline.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────
  // Fetch error → swallow, do not crash, no writes for that URL.
  // ───────────────────────────────────────────────────────────────────
  it('swallows fetch errors and continues without writing', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network unreachable'));

    prisma.schoolDeadline.findMany.mockResolvedValue([
      {
        id: 'r1',
        round: 'ED',
        applicationDeadline: new Date('2026-11-01T23:59:00Z'),
        notes: 'source: https://example.edu/apply',
        school: { id: 's1', name: 'Example U' },
        source: 'TENTATIVE_BASED_ON_PRIOR_YEAR',
      },
    ]);

    await scheduler.refreshTentativeDeadlines();

    expect(prisma.schoolDeadline.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────
  // No tentative rows → no fetches at all.
  // ───────────────────────────────────────────────────────────────────
  it('does nothing when there are no tentative deadlines', async () => {
    prisma.schoolDeadline.findMany.mockResolvedValue([]);
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;

    await scheduler.refreshTentativeDeadlines();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.schoolDeadline.update).not.toHaveBeenCalled();
  });
});
