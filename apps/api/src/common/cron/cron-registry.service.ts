import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';

/**
 * Metadata key owned by `@nestjs/schedule` (`dist/schedule.constants`). The
 * package does not export it from its index; restating the stable string beats
 * a deep `dist/` import that breaks on their next file move. The registry spec
 * pins it against the REAL `@Cron` decorator, so if an upgrade ever renames
 * the key, that spec goes red instead of jobs silently vanishing.
 */
const SCHEDULE_CRON_OPTIONS = 'SCHEDULE_CRON_OPTIONS';

/** Invalid scheduler metadata is a startup configuration failure, not an HTTP error. */
class CronRegistryConfigurationError extends Error {
  override readonly name = 'CronRegistryConfigurationError';
}

interface CronMetadata {
  cronTime: string | Date | object;
  name?: string;
  timeZone?: string;
}

export interface RegisteredCronJob {
  /** Stable id: `options.name`, else kebab-case `ClassName-methodName`. */
  name: string;
  cronExpression: string;
  timeZone?: string;
  className: string;
  methodName: string;
  run: () => Promise<void>;
}

/** `TokenCleanupScheduler` + `handleWeekly` → `token-cleanup-scheduler-handle-weekly` */
function deriveJobName(className: string, methodName: string): string {
  return `${className}-${methodName}`
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Discovers every `@Cron` method in the app — independently of whether
 * ScheduleModule registered a timer for it (`@Cron` stamps its metadata at
 * class-definition time; with `CRON_DRIVER=http` the timers are never created
 * but the metadata is still there). This is what lets Cloud Scheduler drive
 * the exact same methods over HTTP that the in-process timers drive in dev.
 *
 * `run()` deliberately does NOT catch: a throwing job must surface as a 5xx so
 * Cloud Scheduler records the failure and retries. Under `CRON_DRIVER=http`,
 * `runWithCronLock` rethrows a failed job for the same reason; timer mode
 * still catches so an in-process `@Cron` cannot unhandledRejection the replica.
 */
@Injectable()
export class CronRegistryService implements OnModuleInit {
  private readonly logger = new Logger(CronRegistryService.name);
  private readonly jobs = new Map<string, RegisteredCronJob>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  onModuleInit(): void {
    // Controllers too — @nestjs/schedule's own explorer scans both, so a @Cron
    // on a controller method would otherwise fire in dev (timer mode) and 404
    // forever in prod, which is the exact silent-divergence this driver exists
    // to remove.
    for (const wrapper of [
      ...this.discovery.getControllers(),
      ...this.discovery.getProviders(),
    ]) {
      const instance: unknown = wrapper.instance;
      if (!instance || typeof instance !== 'object') continue;
      const prototype: unknown = Object.getPrototypeOf(instance);
      if (!prototype) continue;

      for (const methodName of this.metadataScanner.getAllMethodNames(
        prototype,
      )) {
        const methodRef = (instance as Record<string, unknown>)[methodName];
        if (typeof methodRef !== 'function') continue;
        const metadata = Reflect.getMetadata(
          SCHEDULE_CRON_OPTIONS,
          methodRef,
        ) as CronMetadata | undefined;
        if (!metadata) continue;

        const className = instance.constructor.name;
        if (typeof metadata.cronTime !== 'string') {
          // Date/DateTime one-shots can't be expressed as a Cloud Scheduler
          // schedule; nothing in this repo uses them. Fail fast if one appears.
          throw new CronRegistryConfigurationError(
            `@Cron on ${className}.${methodName} uses a non-string cronTime; ` +
              `only cron expressions are supported (see cron-registry.service.ts).`,
          );
        }

        const name = metadata.name ?? deriveJobName(className, methodName);
        const existing = this.jobs.get(name);
        if (existing) {
          throw new CronRegistryConfigurationError(
            `Duplicate cron job name "${name}" ` +
              `(${existing.className}.${existing.methodName} vs ${className}.${methodName}). ` +
              `Give one an explicit { name } in its @Cron options.`,
          );
        }

        this.jobs.set(name, {
          name,
          cronExpression: metadata.cronTime,
          timeZone: metadata.timeZone,
          className,
          methodName,
          run: () => Promise.resolve(methodRef.call(instance)).then(() => {}),
        });
      }
    }
    this.logger.log(`Discovered ${this.jobs.size} @Cron job(s)`);
  }

  list(): Array<Omit<RegisteredCronJob, 'run'>> {
    return [...this.jobs.values()].map(({ run: _run, ...job }) => job);
  }

  async run(name: string): Promise<void> {
    const job = this.jobs.get(name);
    if (!job) {
      throw new NotFoundException(`Unknown cron job "${name}"`);
    }
    await job.run();
  }
}
