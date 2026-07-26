import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CLOSURE_V2_SOURCE,
  DataSource,
  SchoolDataMerger,
} from './school-data-merger';
import { SchoolWriteService } from './school-write.service';

/**
 * Write-priority guard.
 *
 * `SOURCE_PRIORITY` used to be inverted against the DataSource enum declared
 * directly above it: COLLEGE_SCORECARD ranked 1 while MANUAL_ADMIN and SEED sat
 * at 4/5, so a bulk sync outranked every hand-verified value. closure-v2 entries
 * derive the source `CLOSURE_V2`, which is not an enum member, so they hit the
 * `?? 99` fallback and the overwrite was permitted outright.
 *
 * `MERGEABLE_FIELDS` includes `acceptanceRate` — the prediction anchor. Nothing
 * fired only because the prod deploy carries no COLLEGE_SCORECARD_API_KEY.
 * These tests are the thing that would have caught it, and they need no DB,
 * no seed and no network.
 */
describe('SchoolDataMerger · write priority', () => {
  let merger: SchoolDataMerger;
  let prisma: { school: { findUnique: jest.Mock; update: jest.Mock } };
  let writes: Record<string, unknown>;

  const FRESH = new Date().toISOString();

  const schoolWith = (source: string, fetchedAt = FRESH) => ({
    id: 'sch-1',
    name: 'Test U',
    acceptanceRate: 84.61, // the audited value
    metadata: {
      provenance: {
        acceptanceRate: {
          source,
          fetchedAt,
          tier: 'OFFICIAL',
        },
      },
    },
  });

  beforeEach(async () => {
    writes = {};
    prisma = {
      school: {
        findUnique: jest.fn(),
        update: jest.fn(async ({ data }: any) => {
          Object.assign(writes, data);
          return data;
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolDataMerger,
        { provide: PrismaService, useValue: prisma },
        {
          provide: SchoolWriteService,
          useValue: {
            update: jest.fn(async (_id: string, payload: any) => {
              Object.assign(writes, payload?.fields ?? {});
              return payload;
            }),
          },
        },
      ],
    }).compile();

    merger = module.get(SchoolDataMerger);
  });

  // The exact scenario: someone adds COLLEGE_SCORECARD_API_KEY to prod and the
  // monthly cron reverts the 2026-05-31 audit (SJSU 84.61 → Scorecard's stale
  // value) with no test failing.
  it('does not let a Scorecard sync revert a closure-v2 verified acceptanceRate', async () => {
    prisma.school.findUnique.mockResolvedValue(schoolWith(CLOSURE_V2_SOURCE));

    const result = await merger.merge(
      'sch-1',
      { acceptanceRate: 72.65 },
      DataSource.COLLEGE_SCORECARD,
    );

    expect(result.skippedFields).toContain('acceptanceRate');
    expect(result.updatedFields).not.toContain('acceptanceRate');
  });

  it('does not let a Scorecard sync revert a deliberate admin override', async () => {
    prisma.school.findUnique.mockResolvedValue(
      schoolWith(DataSource.MANUAL_ADMIN),
    );

    const result = await merger.merge(
      'sch-1',
      { acceptanceRate: 72.65 },
      DataSource.COLLEGE_SCORECARD,
    );

    expect(result.skippedFields).toContain('acceptanceRate');
  });

  it('does not let a Scorecard sync revert audited seed corrections', async () => {
    prisma.school.findUnique.mockResolvedValue(schoolWith(DataSource.SEED));

    const result = await merger.merge(
      'sch-1',
      { acceptanceRate: 72.65 },
      DataSource.COLLEGE_SCORECARD,
    );

    expect(result.skippedFields).toContain('acceptanceRate');
  });

  // Fail-safe: an unrecognized source is far likelier to be a pipeline this
  // table hasn't caught up with than junk. That is exactly how closure-v2 got
  // clobbered.
  it('protects a value whose source this table does not recognize', async () => {
    prisma.school.findUnique.mockResolvedValue(
      schoolWith('SOME_FUTURE_PIPELINE'),
    );

    const result = await merger.merge(
      'sch-1',
      { acceptanceRate: 72.65 },
      DataSource.COLLEGE_SCORECARD,
    );

    expect(result.skippedFields).toContain('acceptanceRate');
  });

  // The protection must not become a freeze — the staleness valve still opens.
  it('still allows a bulk source to replace a verified value once it is stale', async () => {
    const twoYearsAgo = new Date(
      Date.now() - 1000 * 60 * 60 * 24 * 730,
    ).toISOString();
    prisma.school.findUnique.mockResolvedValue(
      schoolWith(CLOSURE_V2_SOURCE, twoYearsAgo),
    );

    const result = await merger.merge(
      'sch-1',
      { acceptanceRate: 72.65 },
      DataSource.COLLEGE_SCORECARD,
    );

    expect(result.updatedFields).toContain('acceptanceRate');
  });

  it('lets a higher-priority source overwrite a lower-priority one', async () => {
    prisma.school.findUnique.mockResolvedValue(schoolWith(DataSource.SCRAPER));

    const result = await merger.merge(
      'sch-1',
      { acceptanceRate: 72.65 },
      DataSource.MANUAL_ADMIN,
    );

    expect(result.updatedFields).toContain('acceptanceRate');
  });
});
