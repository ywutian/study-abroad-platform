import { Module, Global, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

@Global()
@Module({})
export class SentryModule implements OnModuleInit {
  private readonly logger = new Logger(SentryModule.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const dsn = this.configService.get<string>('SENTRY_DSN');
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    const isProduction = nodeEnv === 'production';
    const commitSha =
      this.configService.get<string>('GIT_COMMIT_SHA') ||
      this.configService.get<string>('RAILWAY_GIT_COMMIT_SHA');

    if (dsn) {
      Sentry.init({
        dsn,
        environment: nodeEnv,

        // Release tracking — ties errors to specific deployments
        release: commitSha ? `api@${commitSha.substring(0, 8)}` : undefined,

        // Server name for multi-instance identification
        serverName: this.configService.get<string>('HOSTNAME') || 'api',

        // Performance Monitoring
        tracesSampleRate: isProduction ? 0.1 : 1.0,

        // Filter out noisy errors
        ignoreErrors: [
          'NotFoundException',
          'UnauthorizedException',
          'BadRequestException',
          'ThrottlerException',
          'ForbiddenException',
        ],

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

          // Don't send 4xx errors (client errors)
          const statusCode = (hint.originalException as { status?: number })
            ?.status;
          if (statusCode && statusCode >= 400 && statusCode < 500) {
            return null;
          }

          // Scrub sensitive data from request headers
          if (event.request?.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
          }

          return event;
        },

        // Breadcrumb filtering — reduce noise
        beforeBreadcrumb(breadcrumb) {
          // Filter out health check noise
          if (
            breadcrumb.category === 'http' &&
            breadcrumb.data?.url?.includes('/health')
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
}
