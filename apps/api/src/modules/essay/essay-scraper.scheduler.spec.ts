import { Test, TestingModule } from '@nestjs/testing';
import { EssayScraperScheduler } from './essay-scraper.scheduler';
import { EssayScraperService } from './essay-scraper.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

describe('EssayScraperScheduler', () => {
  let scheduler: EssayScraperScheduler;

  const mockScraper = {
    getConfiguredSchools: jest.fn().mockResolvedValue([]),
    scrapeAndLinkCommonApp: jest.fn().mockResolvedValue({
      schoolName: 'CommonApp',
      success: true,
      essaysFound: 0,
    }),
    scrapeSchool: jest
      .fn()
      .mockResolvedValue({ success: true, essaysFound: 0 }),
  };

  const mockPrisma = {
    essayPipelineRun: {
      create: jest.fn().mockResolvedValue({ id: 'run-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
  };

  const mockRedis = { setNXStrict: jest.fn() };

  // Let the fire-and-forget executePipeline microtasks settle so its mocked
  // deps don't resolve after the test finishes.
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.setNXStrict.mockResolvedValue(true);
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EssayScraperScheduler,
        { provide: EssayScraperService, useValue: mockScraper },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();
    scheduler = moduleRef.get(EssayScraperScheduler);
  });

  it('skips the scrape entirely when the single-flight lock is held (multi-instance)', async () => {
    mockRedis.setNXStrict.mockResolvedValue(false);

    await scheduler.annualPreSeasonScrape();

    // No pipeline run row created and no scraping kicked off — so concurrent
    // replicas can't both race the non-atomic prompt insert.
    expect(mockPrisma.essayPipelineRun.create).not.toHaveBeenCalled();
    expect(mockScraper.getConfiguredSchools).not.toHaveBeenCalled();
  });

  it('runs the pipeline when the lock is acquired', async () => {
    mockRedis.setNXStrict.mockResolvedValue(true);

    await scheduler.annualPreSeasonScrape();
    await flush();

    expect(mockPrisma.essayPipelineRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ trigger: 'SCHEDULED_PRE_SEASON' }),
      }),
    );
  });

  it('uses the same lock key for both scheduled crons', async () => {
    mockRedis.setNXStrict.mockResolvedValue(false);

    await scheduler.annualPreSeasonScrape();
    await scheduler.postRdDeadlineVerify();

    const keys = mockRedis.setNXStrict.mock.calls.map((c) => c[0]);
    expect(new Set(keys)).toEqual(new Set(['essay-scraper:cron-lock']));
  });
});
