import {
  Module,
  Global,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { CRON_SECRET_HEADER } from '../cron/cron-secret.guard';

@Global()
@Module({})
export class SentryModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SentryModule.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const dsn = this.configService.get<string>('SENTRY_DSN');
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const isProduction = nodeEnv === 'production';
    const commitSha =
      this.configService.get<string>('GIT_COMMIT_SHA') ||
      this.configService.get<string>('RAILWAY_GIT_COMMIT_SHA') ||
      this.configService.get<string>('RENDER_GIT_COMMIT') ||
      this.configService.get<string>('VERCEL_GIT_COMMIT_SHA');

    if (dsn) {
      // When OTel SDK is active, disable Sentry's built-in OTel integration
      // to prevent double tracing. Sentry continues to capture errors normally.
      const otelActive = !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

      Sentry.init({
        dsn,
        environment: nodeEnv,
        skipOpenTelemetrySetup: otelActive,

        // Release tracking — ties errors to specific deployments
        release: commitSha ? `api@${commitSha.substring(0, 8)}` : undefined,

        // Server name for multi-instance identification
        serverName: this.configService.get<string>('HOSTNAME') || 'api',

        // Performance Monitoring
        tracesSampleRate: isProduction ? 0.1 : 1.0,

        // Filter out expected client errors (4xx are already filtered in beforeSend)
        // Keep ForbiddenException visible — may indicate authorization bypass attempts
        ignoreErrors: ['ThrottlerException'],

        // Custom tags for filtering in Sentry dashboard
        initialScope: {
          tags: {
            service: 'api',
            version: process.env.npm_package_version || '1.0.0',
          },
        },

        // Before sending events
        beforeSend(event, hint) {
          // Don't send events in development
          if (!isProduction) {
            return null;
          }

          // Don't send 4xx errors (client errors) — EXCEPT a whitelist
          // of business-critical codes we explicitly want to observe.
          // 2026-05 Phase 1.5 #19: dashboard data-integrity codes added
          // so we can see how often users hit the new prediction guards
          // (412 PROFILE_INSUFFICIENT, 400 INVALID_SCHOOL_IDS) without
          // drowning Sentry in routine validation noise.
          const statusCode = (hint.originalException as { status?: number })
            ?.status;
          const errorCode = (
            hint.originalException as { response?: { code?: string } }
          )?.response?.code;
          const observed4xxCodes = new Set([
            'PREDICTION_PROFILE_INSUFFICIENT',
            'PREDICTION_INVALID_SCHOOL_IDS',
          ]);
          if (
            statusCode &&
            statusCode >= 400 &&
            statusCode < 500 &&
            !(errorCode && observed4xxCodes.has(errorCode))
          ) {
            return null;
          }

          // Scrub sensitive data from request headers
          if (event.request?.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
            // A failing cron run 5xxes BY DESIGN (Cloud Scheduler retries on
            // it), and Sentry's default requestData integration copies the
            // whole header map — without this line every failed run would ship
            // the production cron secret to Sentry.
            delete event.request.headers[CRON_SECRET_HEADER];
          }

          return event;
        },

        // Breadcrumb filtering — reduce noise
        beforeBreadcrumb(breadcrumb) {
          const breadcrumbUrl = breadcrumb.data?.url;
          // Filter out health check noise
          if (
            breadcrumb.category === 'http' &&
            typeof breadcrumbUrl === 'string' &&
            breadcrumbUrl.includes('/health')
          ) {
            return null;
          }
          return breadcrumb;
        },
      });

      this.logger.log(
        `Sentry initialized (env: ${nodeEnv}${commitSha ? `, release: api@${commitSha.substring(0, 8)}` : ''})`,
      );
    } else {
      this.logger.warn('SENTRY_DSN not configured — error tracking disabled');
    }
  }

  async onModuleDestroy() {
    await Sentry.close(2000);
  }
}
