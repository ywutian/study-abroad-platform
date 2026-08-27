import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { formatPrismaQueryLog } from './prisma-query-log';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  /** True if pending/failed migrations detected at startup */
  hasPendingMigrations = false;

  /** Slow query threshold in milliseconds */
  private readonly slowQueryThresholdMs = Number(
    process.env.PRISMA_SLOW_QUERY_MS || 200,
  );

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'info' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'error' },
            ],
      datasources: {
        db: {
          url: process.env.DATABASE_URL?.includes('connection_limit')
            ? process.env.DATABASE_URL
            : `${process.env.DATABASE_URL}${process.env.DATABASE_URL?.includes('?') ? '&' : '?'}connection_limit=3&pool_timeout=30`,
        },
      },
    });

    // Connection pool configuration via DATABASE_URL parameters:
    // ?connection_limit=10&pool_timeout=20
    this.logger.log('Prisma client initialized with connection pooling');
  }

  async onModuleInit() {
    // Query performance monitoring middleware
    this.$on('query' as never, (event: Prisma.QueryEvent) => {
      const duration = event.duration;

      if (duration > this.slowQueryThresholdMs) {
        this.logger.warn(formatPrismaQueryLog(event, true));
      } else if (process.env.NODE_ENV === 'development' && duration > 50) {
        this.logger.debug(formatPrismaQueryLog(event, false));
      }
    });

    // Retry connection with exponential backoff (Cloud Run cold starts
    // may overlap with existing instances draining connections)
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Database connected successfully');
        await this.checkMigrationStatus();
        return;
      } catch (error: unknown) {
        this.logger.warn(
          `Database connection attempt ${attempt}/${maxRetries} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        if (attempt === maxRetries) {
          this.logger.error(
            'All database connection attempts failed. App will start but DB queries may fail.',
          );
          // Do NOT throw — let the app start so Cloud Run health check can pass.
          // Prisma will lazy-connect on the first query.
          return;
        }
        // Exponential backoff: 2s, 4s, 8s, 16s, 32s
        const delay = Math.pow(2, attempt) * 1000;
        this.logger.log(`Retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  /**
   * Check _prisma_migrations for pending or failed migrations.
   * Sets hasPendingMigrations flag so /health/ready can return 503.
   */
  private async checkMigrationStatus() {
    try {
      const result = await this.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count
        FROM "_prisma_migrations"
        WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL
      `;
      const pendingCount = Number(result[0]?.count ?? 0);
      if (pendingCount > 0) {
        this.logger.error(
          `CRITICAL: ${pendingCount} pending/failed migration(s) detected. Schema may be out of sync.`,
        );
        this.hasPendingMigrations = true;
      }
    } catch {
      // _prisma_migrations table may not exist on first run — not critical
      this.logger.warn('Could not check migration status');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * 清空测试数据库 - 仅用于测试环境
   * 使用 Prisma 原生 API 安全删除，避免 SQL 注入风险
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase is disabled in production');
    }

    this.logger.warn('Cleaning database - this will delete all data');

    // 使用 Prisma 原生 API 按依赖顺序删除
    // 注意：必须先删除有外键依赖的表
    await this.$transaction([
      // 先删除依赖表
      this.caseView.deleteMany(),
      this.caseSwipe.deleteMany(),
      this.swipeStats.deleteMany(),
      this.pointHistory.deleteMany(),
      this.verificationRequest.deleteMany(),
      this.assessmentResult.deleteMany(),
      this.teamApplication.deleteMany(),
      this.teamMember.deleteMany(),
      this.forumLike.deleteMany(),
      this.forumComment.deleteMany(),
      this.forumPost.deleteMany(),
      this.vaultItem.deleteMany(),
      this.userListVote.deleteMany(),
      this.userList.deleteMany(),
      this.report.deleteMany(),
      this.message.deleteMany(),
      this.conversationParticipant.deleteMany(),
      this.conversation.deleteMany(),
      this.agentApproval.deleteMany(),
      this.agentRun.deleteMany(),
      this.block.deleteMany(),
      this.follow.deleteMany(),
      this.agentMessage.deleteMany(),
      this.agentConversation.deleteMany(),
      this.memory.deleteMany(),
      this.entity.deleteMany(),
      this.userAIPreference.deleteMany(),
      this.applicationTask.deleteMany(),
      this.applicationTimeline.deleteMany(),
      this.schoolRecommendation.deleteMany(),
      this.galleryEssayAIInteractionFeedback.deleteMany(),
      this.galleryEssayAIInteraction.deleteMany(),
      this.essayAIResult.deleteMany(),
      this.essay.deleteMany(),
      this.predictionResult.deleteMany(),
      this.profileTargetSchool.deleteMany(),
      this.education.deleteMany(),
      this.award.deleteMany(),
      this.activity.deleteMany(),
      this.testScore.deleteMany(),
      this.profile.deleteMany(),
      this.admissionCase.deleteMany(),
      this.customRanking.deleteMany(),
      this.refreshToken.deleteMany(),
      this.user.deleteMany(),
      // School 和 SchoolMetric 通常保留，如需删除取消注释
      // this.schoolMetric.deleteMany(),
      // this.school.deleteMany(),
    ]);

    this.logger.log('Database cleaned successfully');
  }
}
