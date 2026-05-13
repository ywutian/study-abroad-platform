import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolDataService } from '../school/school-data.service';
import { UrbanInstituteDataService } from '../school/urban-institute-data.service';
import { BigFutureScrapeService } from '../school/scrapers/bigfuture.scraper';
import { AppilyScrapeService } from '../school/scrapers/appily.scraper';
import { CampusLifeIngestionService } from '../school/campus-life-ingestion.service';

const DATA_SYNC_ACTION = 'DATA_SYNC';

export interface DataSyncJobInfo {
  id: string;
  name: string;
  description: string;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'failure' | null;
  lastRunMessage: string | null;
  nextScheduledRun?: string | null;
}

const JOB_DEFINITIONS: Record<
  string,
  { name: string; description: string; nextScheduledRun?: string }
> = {
  COLLEGE_SCORECARD: {
    name: 'College Scorecard',
    description:
      'Sync school-level acceptance rate and metrics from College Scorecard API',
    nextScheduledRun: 'Monthly on 1st at 03:00',
  },
  IPEDS_CHECK: {
    name: 'IPEDS Check',
    description: 'Reminder to manually check IPEDS data updates',
    nextScheduledRun: 'Quarterly (Mar/Jun/Sep/Dec 1st at 04:00)',
  },
  RANKINGS_REMINDER: {
    name: 'Rankings Reminder',
    description: 'Reminder to update US News rankings',
    nextScheduledRun: 'Yearly on Sep 15 at 05:00',
  },
  URBAN_INSTITUTE: {
    name: 'Urban Institute IPEDS',
    description:
      'Sync enrollment, financial aid, demographics from Urban Institute API',
    nextScheduledRun: 'Quarterly (Jan/Apr/Jul/Oct 1st at 04:00)',
  },
  BIGFUTURE: {
    name: 'BigFuture Scrape',
    description:
      'Scrape retention rate, financial aid, Common App status from BigFuture',
    nextScheduledRun: 'Quarterly (Jan/Apr/Jul/Oct 1st at 05:00)',
  },
  APPILY: {
    name: 'Appily Scrape',
    description:
      'Scrape net price, post-grad salary, loan data, campus life from Appily',
    nextScheduledRun: 'Quarterly (Jan/Apr/Jul/Oct 1st at 06:00)',
  },
  CAMPUS_LIFE: {
    name: 'Campus Life Ingestion',
    description:
      'Fill Appily campus-life fields and Niche safety/life/food grades with provenance',
    nextScheduledRun: 'Manual or quarterly after Appily refresh',
  },
};

type TriggerParams = Record<string, number | string | boolean>;

function parseLimitParam(
  params: TriggerParams,
  defaultValue: number,
  maxValue: number,
): number {
  const raw = params.limit;
  const parsed =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? parseInt(raw, 10)
        : defaultValue;
  return Number.isNaN(parsed) ? defaultValue : Math.min(parsed, maxValue);
}

function parseBooleanParam(
  value: number | string | boolean | undefined,
  defaultValue: boolean,
): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return defaultValue;
}

@Injectable()
export class AdminDataSyncService {
  private readonly logger = new Logger(AdminDataSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly schoolDataService: SchoolDataService,
    private readonly urbanInstituteService: UrbanInstituteDataService,
    private readonly bigFutureService: BigFutureScrapeService,
    private readonly appilyService: AppilyScrapeService,
    private readonly campusLifeIngestionService: CampusLifeIngestionService,
  ) {}

  /**
   * List all data-sync jobs with last run info from AuditLog.
   */
  async getDataSyncJobs(): Promise<DataSyncJobInfo[]> {
    const jobIds = Object.keys(JOB_DEFINITIONS);
    const jobs: DataSyncJobInfo[] = [];

    for (const id of jobIds) {
      const def = JOB_DEFINITIONS[id];
      const lastRun = await this.prisma.auditLog.findFirst({
        where: {
          action: DATA_SYNC_ACTION,
          resource: id,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          createdAt: true,
          metadata: true,
        },
      });

      let lastRunStatus: 'success' | 'failure' | null = null;
      let lastRunMessage: string | null = null;
      if (lastRun?.metadata && typeof lastRun.metadata === 'object') {
        const meta = lastRun.metadata as Record<string, unknown>;
        const errCount =
          typeof meta.errorCount === 'number' ? meta.errorCount : 0;
        lastRunStatus = errCount > 0 ? 'failure' : 'success';
        const parts: string[] = [];
        if (typeof meta.successCount === 'number')
          parts.push(`Synced: ${meta.successCount}`);
        if (errCount > 0) parts.push(`Errors: ${errCount}`);
        if (typeof meta.message === 'string') parts.push(meta.message);
        lastRunMessage = parts.length > 0 ? parts.join('; ') : null;
      }

      jobs.push({
        id,
        name: def.name,
        description: def.description,
        lastRunAt: lastRun?.createdAt?.toISOString() ?? null,
        lastRunStatus,
        lastRunMessage,
        nextScheduledRun: def.nextScheduledRun ?? null,
      });
    }

    return jobs;
  }

  /**
   * Trigger a data-sync job. Writes AuditLog with admin userId.
   */
  async triggerDataSync(
    jobId: string,
    params: TriggerParams | undefined,
    userId: string,
  ): Promise<{ synced?: number; errors?: number; message?: string }> {
    const def = JOB_DEFINITIONS[jobId];
    if (!def) {
      throw new BadRequestException(`Unknown data-sync job: ${jobId}`);
    }

    const runParams: TriggerParams = params ?? {};
    this.eventEmitter.emit('admin.job.started', { jobId });
    try {
      if (jobId === 'COLLEGE_SCORECARD') {
        const limit = parseLimitParam(runParams, 500, 5000);
        const result =
          await this.schoolDataService.syncSchoolsFromScorecard(limit);
        await this.logSync(
          userId,
          jobId,
          result.synced,
          result.errors,
          undefined,
        );
        const response = {
          synced: result.synced,
          errors: result.errors,
          message: `Synced ${result.synced} schools, ${result.errors} errors`,
        };
        this.eventEmitter.emit('admin.job.completed', { jobId, ...response });
        return response;
      }

      if (jobId === 'URBAN_INSTITUTE') {
        const limit = parseLimitParam(runParams, 500, 2000);
        const result = await this.urbanInstituteService.syncAll(
          undefined,
          limit,
          userId,
        );
        await this.logSync(
          userId,
          jobId,
          result.total.synced,
          result.total.errors,
        );
        const response = {
          synced: result.total.synced,
          errors: result.total.errors,
          message: `Synced ${result.total.synced} schools, ${result.total.errors} failed`,
        };
        this.eventEmitter.emit('admin.job.completed', { jobId, ...response });
        return response;
      }

      if (jobId === 'BIGFUTURE') {
        const limit = parseLimitParam(runParams, 200, 500);
        const result = await this.bigFutureService.scrapeSchools(limit, userId);
        await this.logSync(userId, jobId, result.updated, result.failed);
        const response = {
          synced: result.updated,
          errors: result.failed,
          message: `Scraped ${result.scraped}, updated ${result.updated}, ${result.failed} failed`,
        };
        this.eventEmitter.emit('admin.job.completed', { jobId, ...response });
        return response;
      }

      if (jobId === 'APPILY') {
        const limit = parseLimitParam(runParams, 200, 500);
        const result = await this.appilyService.scrapeSchools(limit, userId);
        await this.logSync(userId, jobId, result.updated, result.failed);
        const appilyResponse = {
          synced: result.updated,
          errors: result.failed,
          message: `Scraped ${result.scraped}, updated ${result.updated}, ${result.failed} failed`,
        };
        this.eventEmitter.emit('admin.job.completed', {
          jobId,
          ...appilyResponse,
        });
        return appilyResponse;
      }

      if (jobId === 'CAMPUS_LIFE') {
        const limit = parseLimitParam(runParams, 200, 500);
        const dryRun = parseBooleanParam(runParams.dryRun, true);
        const onlyMissing = parseBooleanParam(runParams.onlyMissing, true);
        const result = await this.campusLifeIngestionService.ingest(
          { limit, dryRun, onlyMissing },
          userId,
        );
        const synced = result.appily.updated + result.tavily.updatedFields;
        const errors = result.appily.failed + result.tavily.failed;
        await this.logSync(
          userId,
          jobId,
          synced,
          errors,
          `dryRun=${dryRun}; terminalMarked=${result.tavily.terminalMarked}`,
        );
        const response = {
          synced,
          errors,
          message: `Campus life ${dryRun ? 'dry-run' : 'sync'} scanned ${result.tavily.scanned}; updated ${synced}; terminal marked ${result.tavily.terminalMarked}; ${errors} failed`,
        };
        this.eventEmitter.emit('admin.job.completed', { jobId, ...response });
        return response;
      }

      if (jobId === 'IPEDS_CHECK' || jobId === 'RANKINGS_REMINDER') {
        await this.logSync(userId, jobId, 0, 0, 'Manual check/update required');
        return { message: 'Reminder job logged; no automatic sync performed.' };
      }

      throw new BadRequestException(
        `Job ${jobId} does not support trigger yet`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Data-sync job ${jobId} failed: ${message}`);
      this.eventEmitter.emit('admin.job.failed', { jobId, error: message });
      await this.logSync(userId, jobId, 0, 1, message);
      throw error;
    }
  }

  private async logSync(
    userId: string,
    resource: string,
    successCount: number,
    errorCount: number,
    message?: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: DATA_SYNC_ACTION,
        resource,
        metadata: {
          successCount,
          errorCount,
          message,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }
}
