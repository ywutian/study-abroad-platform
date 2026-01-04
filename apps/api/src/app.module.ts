import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './common/logger/logger.module';
import { EmailModule } from './common/email/email.module';
import { SentryModule } from './common/sentry/sentry.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ProfileModule } from './modules/profile/profile.module';
import { SchoolModule } from './modules/school/school.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { PredictionModule } from './modules/prediction/prediction.module';
import { CaseModule } from './modules/case/case.module';
import { ChatModule } from './modules/chat/chat.module';
import { HallModule } from './modules/hall/hall.module';
import { AiModule } from './modules/ai/ai.module';
import { AiAgentModule } from './modules/ai-agent/ai-agent.module';
import { AdminModule } from './modules/admin/admin.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SentryInterceptor } from './common/sentry/sentry.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get('THROTTLE_TTL', 60) * 1000,
            limit: config.get('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),
    PrismaModule,
    LoggerModule,
    EmailModule,
    SentryModule,
    HealthModule,
    AuthModule,
    UserModule,
    ProfileModule,
    SchoolModule,
    RankingModule,
    PredictionModule,
    CaseModule,
    ChatModule,
    HallModule,
    AiModule,
    AiAgentModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
