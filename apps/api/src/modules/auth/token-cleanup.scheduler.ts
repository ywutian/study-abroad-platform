import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TokenCleanupScheduler {
  private readonly logger = new Logger(TokenCleanupScheduler.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Clean up expired refresh tokens every day at 3 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredTokens() {
    this.logger.log('Starting expired refresh token cleanup...');

    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      this.logger.log(`Cleaned up ${result.count} expired refresh tokens`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired refresh tokens', error);
    }
  }

  /**
   * Clean up orphaned tokens (tokens for deleted users) weekly
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOrphanedTokens() {
    this.logger.log('Starting orphaned refresh token cleanup...');

    try {
      // Find userIds of soft-deleted users
      const deletedUsers = await this.prisma.user.findMany({
        where: { deletedAt: { not: null } },
        select: { id: true },
      });

      if (deletedUsers.length === 0) {
        this.logger.log('No orphaned refresh tokens to cleanup');
        return;
      }

      const deletedUserIds = deletedUsers.map((u) => u.id);

      // Delete tokens for soft-deleted users
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          userId: { in: deletedUserIds },
        },
      });

      this.logger.log(`Cleaned up ${result.count} orphaned refresh tokens`);
    } catch (error) {
      this.logger.error('Failed to cleanup orphaned refresh tokens', error);
    }
  }
}
