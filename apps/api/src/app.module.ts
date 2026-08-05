import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { TimeoutMiddleware } from './common/middleware/timeout.middleware';
import { validateEnv } from './common/config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './common/logger/logger.module';
import { EmailModule } from './common/email/email.module';
import { RedisModule } from './common/redis/redis.module';
import { SentryModule } from './common/sentry/sentry.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ProfileModule } from './modules/profile/profile.module';
import { SchoolModule } from './modules/school/school.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { PredictionModule } from './modules/prediction/prediction.module';
import { ClosureModule } from './modules/prediction/closure/closure.module';
import { CaseModule } from './modules/case/case.module';
import { PointsModule } from './modules/points/points.module';
import { ChatModule } from './modules/chat/chat.module';
import { HallModule } from './modules/hall/hall.module';
import { AiModule } from './modules/ai/ai.module';
import { AiAgentModule } from './modules/ai-agent/ai-agent.module';
import { AgentSecurityModule } from './modules/ai-agent/security/security.module';
import { AdminModule } from './modules/admin/admin.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { VerificationModule } from './modules/verification/verification.module';
import { EssayModule } from './modules/essay/essay.module';
import { EssayDebateModule } from './modules/essay-debate/essay-debate.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { TimelineModule } from './modules/timeline/timeline.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { ForumModule } from './modules/forum/forum.module';
import { VaultModule } from './modules/vault/vault.module';
import { SettingsModule } from './modules/settings/settings.module';
import { NotificationModule } from './modules/notification/notification.module';
import { SchoolListModule } from './modules/school-list/school-list.module';
import { PeerReviewModule } from './modules/peer-review/peer-review.module';
import { ResumeModule } from './modules/resume/resume.module';
import { TeamModule } from './modules/team/team.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SanitizeInterceptor } from './common/interceptors/sanitize.interceptor';
import { LocaleInterceptor } from './common/interceptors/locale.interceptor';
import { SentryInterceptor } from './common/sentry/sentry.interceptor';
import { StorageModule } from './common/storage/storage.module';
import { AuthorizationModule } from './common/services/authorization.module';
import { AuditLogModule } from './common/services/audit-log.module';
import { FeatureFlagModule } from './common/feature-flags';
import { FeatureFlagGuard } from './common/feature-flags';
import { CronModule } from './common/cron/cron.module';

@Module({
  imports: [
    AuthorizationModule,
    AuditLogModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    // Rate Limiting [A5-017]
    // THROTTLE_TTL is validated as seconds in env.validation.ts (default: 60)
    // Multiply by 1000 to convert to ms for ThrottlerModule
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: (config.get<number>('THROTTLE_TTL') ?? 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT') ?? 100,
          },
        ],
        // Test-only escape hatch: the release-runtime CI job drives every route
        // as a single session, which trips per-user throttles (incl. strict
        // per-route @Throttle decorators) and floods the page audit with 429s.
        // Honoured ONLY when THROTTLE_DISABLED=true is explicitly set — the GCP
        // production deploy never sets it, so throttling stays fully active in
        // prod. Keeps the release-runtime audit measuring real page behaviour.
        skipIf: () => process.env.THROTTLE_DISABLED === 'true',
      }),
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    LoggerModule,
    EmailModule,
    RedisModule,
    SentryModule,
    StorageModule,
    CronModule,
    HealthModule,
    AuthModule,
    UserModule,
    ProfileModule,
    SchoolModule,
    RankingModule,
    PredictionModule,
    ClosureModule,
    CaseModule,
    PointsModule,
    ChatModule,
    HallModule,
    AiModule,
    AiAgentModule,
    AgentSecurityModule, // 企业级安全模块（Prompt 注入防护、内容审核、审计）
    FeatureFlagModule,
    AdminModule,
    SubscriptionModule,
    VerificationModule,
    EssayModule,
    EssayDebateModule,
    RecommendationModule,
    TimelineModule,
    AssessmentModule,
    ForumModule,
    VaultModule,
    SettingsModule,
    NotificationModule,
    SchoolListModule,
    PeerReviewModule,
    ResumeModule,
    TeamModule,
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
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: FeatureFlagGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LocaleInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SanitizeInterceptor,
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
    consumer.apply(CorrelationIdMiddleware, TimeoutMiddleware).forRoutes('*');
  }
}
