import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ApplicationAnalysisWorkflowService } from './application-analysis-workflow.service';

@Injectable()
export class ApplicationAnalysisExperimentScheduler {
  private readonly logger = new Logger(
    ApplicationAnalysisExperimentScheduler.name,
  );

  constructor(
    private readonly workflowService: ApplicationAnalysisWorkflowService,
    private readonly configService: ConfigService,
  ) {}

  @Cron('17 * * * *')
  async runHourlyRolloutMonitor() {
    if (!this.automationEnabled()) return;
    try {
      const summary = await this.workflowService.runHourlyExperimentMonitor();
      this.logger.log(
        `Application-analysis rollout monitor completed: checked=${summary.checked}, stageAdvanced=${summary.stageAdvanced.length}, activated=${summary.activated.length}, retired=${summary.retired.length}`,
      );
    } catch (error) {
      this.logger.warn(
        `Application-analysis rollout monitor failed: ${String(
          error instanceof Error ? error.message : error,
        )}`,
      );
    }
  }

  @Cron('15 4 * * *')
  async runNightlyShadowRefresh() {
    if (!this.automationEnabled()) return;
    try {
      const summary = await this.workflowService.runNightlyShadowRefresh();
      this.logger.log(
        `Application-analysis nightly shadow refresh completed: checked=${summary.checked}, promotedToCanary=${summary.promotedToCanary.length}, retired=${summary.retired.length}`,
      );
    } catch (error) {
      this.logger.warn(
        `Application-analysis nightly shadow refresh failed: ${String(
          error instanceof Error ? error.message : error,
        )}`,
      );
    }
  }

  private automationEnabled(): boolean {
    // OPT-IN (default off). The experiment/governance automation promotes
    // analysis policies based on gate evaluations that require admission
    // OUTCOMES we do not yet collect — so on the current data it can only
    // produce empty no-op runs. It is explicitly enabled (=== 'true'), not
    // merely "not disabled", so the ungrounded cron never runs by default.
    // The global SCHEDULERS_ENABLED kill switch still applies.
    return (
      this.configService.get<string>('SCHEDULERS_ENABLED') !== 'false' &&
      this.configService.get<string>(
        'APPLICATION_ANALYSIS_AUTOMATION_ENABLED',
      ) === 'true'
    );
  }
}
