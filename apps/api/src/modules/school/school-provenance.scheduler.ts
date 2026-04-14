import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as Sentry from '@sentry/node';
import { SchoolService } from './school.service';
import { SchoolDataService } from './school-data.service';
import { UrbanInstituteDataService } from './urban-institute-data.service';

@Injectable()
export class SchoolProvenanceScheduler {
  private readonly logger = new Logger(SchoolProvenanceScheduler.name);

  constructor(
    private readonly schoolService: SchoolService,
    private readonly schoolDataService: SchoolDataService,
    private readonly urbanInstituteService: UrbanInstituteDataService,
  ) {}

  @Cron('0 7 * * *')
  async monitorOfficialCoverage(): Promise<void> {
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
  }

  @Cron('0 8 * * 1')
  async refreshStaleOfficialFields(): Promise<void> {
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

    if (staleScorecardSchools.size > 0) {
      const limit = Math.min(staleScorecardSchools.size, 500);
      this.logger.log(
        `Refreshing College Scorecard data for stale official fields (batch limit ${limit})`,
      );
      await this.schoolDataService.syncSchoolsFromScorecard(limit);
    }

    if (staleIpedsSchools.size > 0) {
      const limit = Math.min(staleIpedsSchools.size, 500);
      this.logger.log(
        `Refreshing Urban Institute/IPEDS data for stale official fields (batch limit ${limit})`,
      );
      await this.urbanInstituteService.syncAll(undefined, limit);
    }
  }
}
