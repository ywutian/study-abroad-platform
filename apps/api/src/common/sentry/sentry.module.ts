import { Module, Global, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

@Global()
@Module({})
export class SentryModule implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const dsn = this.configService.get<string>('SENTRY_DSN');
    
    if (dsn) {
      Sentry.init({
        dsn,
        environment: this.configService.get<string>('NODE_ENV') || 'development',
        
        // Performance Monitoring
        tracesSampleRate: this.configService.get<string>('NODE_ENV') === 'production' ? 0.1 : 1.0,
        
        // Filter out noisy errors
        ignoreErrors: [
          'NotFoundException',
          'UnauthorizedException',
          'BadRequestException',
        ],
        
        // Before sending events
        beforeSend(event, hint) {
          // Don't send events in development
          if (process.env.NODE_ENV !== 'production') {
            return null;
          }
          
          // Don't send 4xx errors
          const statusCode = (hint.originalException as { status?: number })?.status;
          if (statusCode && statusCode >= 400 && statusCode < 500) {
            return null;
          }
          
          return event;
        },
      });
      
      console.log('Sentry initialized for API');
    }
  }
}









