import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import { PredictionResultDto } from './dto';

const CACHE_TTL = 86400; // 24 hours — profile changes trigger invalidation via invalidateUserCache()
const CACHE_PREFIX = 'prediction:';

/**
 * Redis cache layer for prediction results.
 *
 * Handles cache key generation, profile data hashing for stale-on-read detection,
 * and read/write operations with graceful fallback on Redis failures.
 */
@Injectable()
export class PredictionCacheService {
  private readonly logger = new Logger(PredictionCacheService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Build a composite Redis cache key for a profile-school prediction pair.
   *
   * @param profileId - The profile identifier
   * @param schoolId - The school identifier
   * @returns Cache key in the format `prediction:{profileId}:{schoolId}`
   */
  getCacheKey(
    profileId: string,
    schoolId: string,
    policyVersionId?: string,
    engineMode?: string,
  ): string {
    const versionSuffix = policyVersionId || 'legacy';
    const modeSuffix = engineMode || 'v4';
    return `${CACHE_PREFIX}${profileId}:${schoolId}:${versionSuffix}:${modeSuffix}`;
  }

  /**
   * Hash prediction-relevant profile fields for cache key versioning.
   * Ensures stale cache is not served when profile data changes.
   */
  hashProfileData(profile: {
    gpa?: any;
    gpaScale?: any;
    testScores?: Array<{ type: string; score: number }>;
    activities?: any[];
    awards?: Array<{ level?: string }>;
    education?: Array<{
      schoolType?: string | null;
      highSchoolId?: string | null;
      highSchool?: { tier: number } | null;
    }>;
  }): string {
    // Extract high school info for cache key
    const hsEdu = (profile.education || []).find(
      (e) => e.schoolType === 'HIGH_SCHOOL',
    );
    const data = JSON.stringify({
      gpa: profile.gpa,
      gpaScale: profile.gpaScale,
      scores: (profile.testScores || []).map((s) => ({
        t: s.type,
        s: s.score,
      })),
      actCount: (profile.activities || []).length,
      awards: (profile.awards || []).map((a) => a.level).sort(),
      hsId: hsEdu?.highSchoolId || null,
      hsTier: hsEdu?.highSchool?.tier || null,
    });
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < data.length; i++) {
      hash ^= data.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    return hash.toString(36);
  }

  /**
   * Retrieve a cached prediction result from Redis.
   *
   * @param profileId - The profile identifier
   * @param schoolId - The school identifier
   * @param profileHash - Optional hash to detect stale cache entries
   * @returns The cached prediction with `fromCache: true`, or null on miss/error
   */
  async getFromCache(
    profileId: string,
    schoolId: string,
    profileHash?: string,
    policyVersionId?: string,
    engineMode?: string,
  ): Promise<PredictionResultDto | null> {
    try {
      const cached = await this.redis.getJSON<
        PredictionResultDto & { _profileHash?: string }
      >(this.getCacheKey(profileId, schoolId, policyVersionId, engineMode));
      if (cached) {
        // Hash-on-read: treat as cache miss if profile data changed
        if (
          profileHash &&
          cached._profileHash &&
          cached._profileHash !== profileHash
        ) {
          return null;
        }
        const { _profileHash: _, ...result } = cached;
        return { ...result, fromCache: true, cachedAt: result.cachedAt };
      }
    } catch (error) {
      this.logger.warn(`Cache read failed`, error);
    }
    return null;
  }

  /**
   * Persist a prediction result to Redis with a 24-hour TTL.
   *
   * @param profileId - The profile identifier
   * @param schoolId - The school identifier
   * @param result - The prediction result to cache
   * @param profileHash - Hash of profile data, stored inside the value for stale-on-read detection
   */
  async saveToCache(
    profileId: string,
    schoolId: string,
    result: PredictionResultDto,
    profileHash?: string,
    policyVersionId?: string,
    engineMode?: string,
  ): Promise<void> {
    try {
      await this.redis.setJSON(
        this.getCacheKey(profileId, schoolId, policyVersionId, engineMode),
        {
          ...result,
          cachedAt: new Date().toISOString(),
          _profileHash: profileHash,
        },
        CACHE_TTL,
      );
    } catch (error) {
      this.logger.warn(`Cache write failed`, error);
    }
  }

  /**
   * Invalidate all cached prediction results for a given profile.
   *
   * Looks up every school the profile has predictions for and deletes
   * the corresponding Redis keys. Should be called when profile data changes.
   *
   * @param profileId - The profile whose caches should be invalidated
   * @param schoolIds - Array of school IDs that have cached predictions
   */
  async invalidateUserCache(
    profileId: string,
    schoolIds: string[],
  ): Promise<void> {
    try {
      for (const schoolId of schoolIds) {
        await this.redis.delByPrefix(
          `${CACHE_PREFIX}${profileId}:${schoolId}:`,
        );
      }
      this.logger.log(
        `Invalidated ${schoolIds.length} prediction caches for profile ${profileId}`,
      );
    } catch (error) {
      this.logger.warn(`Cache invalidation failed`, error);
    }
  }
}
