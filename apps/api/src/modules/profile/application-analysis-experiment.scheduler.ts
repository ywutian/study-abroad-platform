import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ApplicationAnalysisWorkflowService } from './application-analysis-workflow.service';

@Injectable()
export class ApplicationAnalysisExperimentScheduler {
  private readonly logger = new Logger(
    ApplicationAnalysisExperimentScheduler.name,
  );

  constructor(
    private readonly workflowService: ApplicationAnalysisWorkflowService,
  ) {}

  @Cron('17 * * * *')
  async runHourlyRolloutMonitor() {
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
}
