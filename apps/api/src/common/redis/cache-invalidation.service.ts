import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Invalidate all caches derived from a user's profile.
   * Called after any profile mutation (upsert, test scores, activities, awards, etc.)
   *
   * Failures are logged but never thrown — cache invalidation must not block business writes.
   * TTL provides a fallback guarantee for eventual consistency.
   */
  async onProfileChange(userId: string): Promise<void> {
    const keys = [
      `profile:${userId}`,
      `ai:recommend:${userId}`,
      `ai:profile-analysis:${userId}`,
    ];

    try {
      await Promise.all(keys.map((k) => this.redis.del(k)));

      // Invalidate prediction caches for all schools the user has predictions for
      await this.invalidatePredictionCaches(userId);

      this.logger.debug(`Invalidated caches for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache for user ${userId}: ${String(error instanceof Error ? error.message : error)}`,
      );
    }
  }

  /**
   * Invalidate all prediction caches for a user.
   * Looks up profileId from userId, then deletes all prediction:{profileId}:{schoolId} keys.
   */
  private async invalidatePredictionCaches(userId: string): Promise<void> {
    try {
      const profile = await this.prisma.profile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!profile) return;

      const predictions = await this.prisma.predictionResult.findMany({
        where: { profileId: profile.id },
        select: { schoolId: true },
      });

      if (predictions.length === 0) return;

      await Promise.all(
        predictions.map((p) =>
          this.redis.del(`prediction:${profile.id}:${p.schoolId}`),
        ),
      );

      this.logger.debug(
        `Invalidated ${predictions.length} prediction caches for profile ${profile.id}`,
      );
    } catch (error) {
      this.logger.warn('Failed to invalidate prediction caches', error);
    }
  }

  /**
   * Invalidate caches for a specific school.
   * Called after admin updates school data.
   */
  async onSchoolChange(schoolId: string): Promise<void> {
    try {
      await this.redis.del(`school:detail:${schoolId}`);
      this.logger.debug(`Invalidated cache for school ${schoolId}`);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate school cache ${schoolId}: ${String(error instanceof Error ? error.message : error)}`,
      );
    }
  }

  /**
   * Invalidate caches when a high school's evaluation changes.
   * Clears prediction caches for ALL users linked to this high school
   * via their Education records.
   */
  async onHighSchoolChange(highSchoolId: string): Promise<void> {
    try {
      // Find all users linked to this high school via Education → Profile → User
      const educations = await this.prisma.education.findMany({
        where: { highSchoolId },
        select: { profile: { select: { userId: true } } },
      });

      const userIds = [
        ...new Set(
          educations
            .map((e) => e.profile?.userId)
            .filter((id): id is string => !!id),
        ),
      ];

      if (userIds.length === 0) {
        this.logger.debug(
          `No users linked to high school ${highSchoolId}, skipping cache invalidation`,
        );
        return;
      }

      // Invalidate prediction caches for each affected user
      await Promise.all(
        userIds.map((uid) => this.invalidatePredictionCaches(uid)),
      );

      this.logger.debug(
        `Invalidated prediction caches for ${userIds.length} users linked to high school ${highSchoolId}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate caches for high school ${highSchoolId}: ${String(error instanceof Error ? error.message : error)}`,
      );
    }
  }
}
