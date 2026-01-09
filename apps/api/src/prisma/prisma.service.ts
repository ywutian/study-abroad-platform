import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error'] 
        : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Connection pool configuration via DATABASE_URL parameters:
    // ?connection_limit=10&pool_timeout=20
    // Or set via environment:
    // - PRISMA_CONNECTION_LIMIT (default: 10)
    // - PRISMA_POOL_TIMEOUT (default: 10s)
    this.logger.log('Prisma client initialized with connection pooling');
  }

  async onModuleInit() {
    await this.$connect();
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

