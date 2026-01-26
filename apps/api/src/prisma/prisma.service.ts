import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

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
            : `${process.env.DATABASE_URL}${process.env.DATABASE_URL?.includes('?') ? '&' : '?'}connection_limit=10&pool_timeout=30`,
        },
      },
    });

    // Connection pool configuration via DATABASE_URL parameters:
    // ?connection_limit=10&pool_timeout=20
    this.logger.log('Prisma client initialized with connection pooling');
  }

  async onModuleInit() {
    // Query performance monitoring middleware
    this.$on('query' as never, (event: any) => {
      const duration = event.duration as number;

      if (duration > this.slowQueryThresholdMs) {
        this.logger.warn(
          `[SLOW QUERY] ${duration}ms | ${event.query} | params: ${event.params}`,
        );
      } else if (process.env.NODE_ENV === 'development' && duration > 50) {
        this.logger.debug(`[QUERY] ${duration}ms | ${event.query}`);
      }
    });

    await this.$connect();
    this.logger.log('Database connected successfully');
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
      this.review.deleteMany(),
      this.message.deleteMany(),
      this.conversationParticipant.deleteMany(),
      this.conversation.deleteMany(),
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
