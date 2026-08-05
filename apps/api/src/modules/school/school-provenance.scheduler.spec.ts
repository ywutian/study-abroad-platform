import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../common/redis/redis.service';
import { SchoolProvenanceScheduler } from './school-provenance.scheduler';
import { SchoolService } from './school.service';
import { SchoolDataService } from './school-data.service';
import { UrbanInstituteDataService } from './urban-institute-data.service';

/**
 * Guards for the two school @Cron jobs.
 *
 * Both defects here are invisible in normal operation and only bite in prod:
 * Cloud Run runs N replicas so an unlocked cron fans out N×, and the Scorecard
 * sync throws outright when COLLEGE_SCORECARD_API_KEY is unset — which it is —
 * so an unguarded call took the whole weekly job down as an unhandled
 * rejection and stopped the IPEDS half from ever running.
 */
describe('SchoolProvenanceScheduler', () => {
  let scheduler: SchoolProvenanceScheduler;
  const redis = {
    setNXStrict: jest.fn(),
    tryAcquireLock: jest.fn().mockResolvedValue({ acquired: true }),
  };
  const schoolService = { getDataQualityReport: jest.fn() };
  const schoolDataService = { syncSchoolsFromScorecard: jest.fn() };
  const urbanInstituteService = { syncAll: jest.fn() };

  const staleReport = {
    top200OfficialCoverage: {
      percent: 99,
      covered: 99,
      totalSlots: 100,
      threshold: 90,
    },
    staleFields: [
      { tier: 'OFFICIAL', schoolId: 'sch-a', source: 'COLLEGE_SCORECARD' },
      { tier: 'OFFICIAL', schoolId: 'sch-b', source: 'URBAN_INSTITUTE' },
      { tier: 'SEED', schoolId: 'sch-c', source: 'SEED' },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    redis.setNXStrict.mockResolvedValue(true);
    redis.tryAcquireLock.mockResolvedValue({ acquired: true });
    schoolService.getDataQualityReport.mockResolvedValue(staleReport);
    schoolDataService.syncSchoolsFromScorecard.mockResolvedValue({
      synced: 1,
      errors: 0,
    });
    urbanInstituteService.syncAll.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolProvenanceScheduler,
        { provide: SchoolService, useValue: schoolService },
        { provide: SchoolDataService, useValue: schoolDataService },
        { provide: UrbanInstituteDataService, useValue: urbanInstituteService },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    scheduler = module.get(SchoolProvenanceScheduler);
  });

  describe('single-flight', () => {
    it('skips the stale refresh when another replica holds the lock', async () => {
      redis.setNXStrict.mockResolvedValue(false);
      redis.tryAcquireLock.mockResolvedValue({
        acquired: false,
        reason: 'held',
      });

      await scheduler.refreshStaleOfficialFields();

      expect(schoolService.getDataQualityReport).not.toHaveBeenCalled();
      expect(schoolDataService.syncSchoolsFromScorecard).not.toHaveBeenCalled();
      expect(urbanInstituteService.syncAll).not.toHaveBeenCalled();
    });

    it('skips the coverage monitor when another replica holds the lock', async () => {
      redis.setNXStrict.mockResolvedValue(false);
      redis.tryAcquireLock.mockResolvedValue({
        acquired: false,
        reason: 'held',
      });

      await scheduler.monitorOfficialCoverage();

      expect(schoolService.getDataQualityReport).not.toHaveBeenCalled();
    });

    it('runs when it wins the lock', async () => {
      await scheduler.refreshStaleOfficialFields();

      expect(schoolDataService.syncSchoolsFromScorecard).toHaveBeenCalled();
    });
  });

  describe('external-source failures', () => {
    // Scorecard throws when the API key is unset — true in prod today. Before
    // this, that took down the whole job and the IPEDS half never ran.
    it('does not let a failing Scorecard sync stop the IPEDS sync', async () => {
      schoolDataService.syncSchoolsFromScorecard.mockRejectedValue(
        new Error('COLLEGE_SCORECARD_API_KEY not configured'),
      );

      await expect(
        scheduler.refreshStaleOfficialFields(),
      ).resolves.toBeUndefined();

      expect(urbanInstituteService.syncAll).toHaveBeenCalled();
    });

    it('does not throw when the IPEDS sync fails', async () => {
      urbanInstituteService.syncAll.mockRejectedValue(
        new Error('upstream 500'),
      );

      await expect(
        scheduler.refreshStaleOfficialFields(),
      ).resolves.toBeUndefined();
    });
  });

  it('only considers OFFICIAL-tier stale fields', async () => {
    await scheduler.refreshStaleOfficialFields();

    // sch-c is SEED tier — it must not pull either source into the run.
    expect(schoolDataService.syncSchoolsFromScorecard).toHaveBeenCalledTimes(1);
    expect(urbanInstituteService.syncAll).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no official field is stale', async () => {
    schoolService.getDataQualityReport.mockResolvedValue({
      ...staleReport,
      staleFields: [],
    });

    await scheduler.refreshStaleOfficialFields();

    expect(schoolDataService.syncSchoolsFromScorecard).not.toHaveBeenCalled();
    expect(urbanInstituteService.syncAll).not.toHaveBeenCalled();
  });
});
