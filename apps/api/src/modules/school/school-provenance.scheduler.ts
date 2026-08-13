import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as Sentry from '@sentry/node';
import { runWithCronLock } from '../../common/redis/cron-lock.util';
import { REDIS_TTL } from '../../common/redis/redis-ttl.constants';
import { RedisService } from '../../common/redis/redis.service';
import { SchoolService } from './school.service';
import { SchoolDataService } from './school-data.service';
import { UrbanInstituteDataService } from './urban-institute-data.service';

const COVERAGE_MONITOR_LOCK_KEY = 'cron:school:coverage-monitor';
const STALE_REFRESH_LOCK_KEY = 'cron:school:stale-refresh';

@Injectable()
export class SchoolProvenanceScheduler {
  private readonly logger = new Logger(SchoolProvenanceScheduler.name);

  constructor(
    private readonly schoolService: SchoolService,
    private readonly schoolDataService: SchoolDataService,
    private readonly urbanInstituteService: UrbanInstituteDataService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  @Cron('0 7 * * *')
  async monitorOfficialCoverage(): Promise<void> {
    // Single-flight: Cloud Run fires this on every replica, and the SLO breach
    // path reports to Sentry — without the lock one breach becomes N alerts.
    await runWithCronLock(
      this.redis,
      COVERAGE_MONITOR_LOCK_KEY,
      REDIS_TTL.SCHOOL_COVERAGE_MONITOR_CRON_LOCK,
      async () => {
        const report = await this.schoolService.getDataQualityReport({
          bypassCache: true,
        });
        const coverage = report.top200OfficialCoverage;

        this.logger.log(
          `Top 200 official coverage: ${coverage.percent}% (${coverage.covered}/${coverage.totalSlots})`,
        );

        if (coverage.percent >= coverage.threshold) {
          return;
        }

        const message =
          `School official coverage SLO breached: ${coverage.percent}% ` +
          `(${coverage.covered}/${coverage.totalSlots}) below ${coverage.threshold}%`;

        this.logger.warn(message);
        Sentry.withScope((scope) => {
          scope.setLevel('warning');
          scope.setTag('school_data_slo', 'top200_official_coverage');
          scope.setContext('top200OfficialCoverage', coverage);
          Sentry.captureMessage(message);
        });
      },
      this.logger,
    );
  }

  @Cron('0 8 * * 1')
  async refreshStaleOfficialFields(): Promise<void> {
    // Single-flight: this one calls external bulk APIs, so a duplicate run
    // burns third-party quota on every extra replica.
    await runWithCronLock(
      this.redis,
      STALE_REFRESH_LOCK_KEY,
      REDIS_TTL.SCHOOL_STALE_REFRESH_CRON_LOCK,
      () => this.runStaleRefresh(),
      this.logger,
    );
  }

  private async runStaleRefresh(): Promise<void> {
    const report = await this.schoolService.getDataQualityReport({
      bypassCache: true,
    });
    type StaleField = (typeof report.staleFields)[number];
    const staleOfficialFields = report.staleFields.filter(
      (field: StaleField) => field.tier === 'OFFICIAL',
    );

    if (staleOfficialFields.length === 0) {
      this.logger.log('No stale official school fields detected');
      return;
    }

    const staleSchoolIds = new Set(
      staleOfficialFields.map((field: StaleField) => field.schoolId),
    );
    const staleScorecardSchools = new Set(
      staleOfficialFields
        .filter((field: StaleField) =>
          field.source.includes('COLLEGE_SCORECARD'),
        )
        .map((field: StaleField) => field.schoolId),
    );
    const staleIpedsSchools = new Set(
      staleOfficialFields
        .filter(
          (field: StaleField) =>
            field.source.includes('IPEDS') ||
            field.source.includes('URBAN_INSTITUTE'),
        )
        .map((field: StaleField) => field.schoolId),
    );

    this.logger.warn(
      `Detected ${staleOfficialFields.length} stale official fields across ${staleSchoolIds.size} schools`,
    );

    // Keep the ids in logs so an operator can reconcile the targeted refresh.
    this.logger.warn(
      `Stale scorecard schools: ${[...staleScorecardSchools].join(', ') || 'none'}`,
    );
    this.logger.warn(
      `Stale IPEDS/Urban Institute schools: ${[...staleIpedsSchools].join(', ') || 'none'}`,
    );

    // Each sync is isolated: Scorecard throws outright when
    // COLLEGE_SCORECARD_API_KEY is unset (which is the case in prod today), and
    // an unguarded throw here took the whole job down every Monday as an
    // unhandled rejection. One dead source must not stop the other.
    if (staleScorecardSchools.size > 0) {
      this.logger.log(
        `Refreshing ${staleScorecardSchools.size} stale College Scorecard schools`,
      );
      try {
        await this.schoolDataService.syncSchoolsFromScorecardBySchoolIds([
          ...staleScorecardSchools,
        ]);
      } catch (error) {
        this.logger.error(
          `College Scorecard refresh failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (staleIpedsSchools.size > 0) {
      this.logger.log(
        `Refreshing ${staleIpedsSchools.size} stale Urban Institute/IPEDS schools`,
      );
      try {
        await this.urbanInstituteService.syncSchoolsByIds([
          ...staleIpedsSchools,
        ]);
      } catch (error) {
        this.logger.error(
          `Urban Institute/IPEDS refresh failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
