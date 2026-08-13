import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Profile, Role, Visibility } from '@prisma/client';
import { CacheInvalidationService } from '../../common/redis/cache-invalidation.service';
import type { MaybeSerialized } from '../../common/redis/redis-json.types';
import { REDIS_TTL } from '../../common/redis/redis-ttl.constants';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateRecommendationLetterDto,
  UpdateProfileDto,
  UpdateRecommendationLetterDto,
} from './dto';

/**
 * Handles core profile CRUD operations: find, create, update, upsert,
 * visibility checks, and anonymization.
 */
/**
 * The include used by findByUserId. Named so the payload type below is derived
 * from the query rather than restated next to it.
 */
const PROFILE_INCLUDE = {
  testScores: { orderBy: { createdAt: 'desc' } },
  activities: {
    orderBy: { order: 'asc' },
    include: { activityTemplate: true },
  },
  awards: { orderBy: { order: 'asc' }, include: { competition: true } },
  education: { include: { highSchool: true } },
  essays: true,
  semesterGpas: { orderBy: { order: 'asc' } },
} as const satisfies Prisma.ProfileInclude;

export type ProfileWithRelations = Prisma.ProfileGetPayload<{
  include: typeof PROFILE_INCLUDE;
}>;

/**
 * What findByUserId actually hands back. The old `Profile` was wrong twice: it
 * dropped all six relations, and it promised Dates that a cache hit does not
 * have. Callers reading a DateTime off this must go through `new Date(...)`.
 */
export type CachedProfile = MaybeSerialized<ProfileWithRelations>;

@Injectable()
export class ProfileCrudService {
  private readonly logger = new Logger(ProfileCrudService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private cacheInvalidation: CacheInvalidationService,
  ) {}

  /**
   * Find a profile by user ID with all nested relations eagerly loaded.
   *
   * Includes testScores (desc by createdAt), activities (asc by order),
   * awards (asc by order), education, and essays.
   *
   * @param userId - The user identifier
   * @returns The full profile with relations, or null if not found
   */
  async findByUserId(userId: string): Promise<CachedProfile | null> {
    const cacheKey = `profile:${userId}`;
    const cached = await this.redis.getJSON<ProfileWithRelations>(cacheKey);
    if (cached) return cached;

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    });

    if (profile) {
      await this.redis.setJSON(cacheKey, profile, REDIS_TTL.PROFILE);
    }

    return profile;
  }

  /**
   * Find a profile by ID with visibility-based access control.
   *
   * Access rules (evaluated in order):
   * - Owner always has full access
   * - ADMIN role always has full access
   * - PRIVATE visibility: throws ForbiddenException
   * - VERIFIED_ONLY visibility: only VERIFIED role can access, else ForbiddenException
   * - ANONYMOUS visibility: returns anonymized profile (masked school name, bucketed GPA)
   * - PUBLIC visibility: full access
   *
   * @param profileId - The profile identifier to look up
   * @param requesterId - The requesting user's ID
   * @param requesterRole - The requesting user's role
   * @returns The profile (possibly anonymized) with test scores, activities, and awards
   * @throws {NotFoundException} When the profile does not exist
   * @throws {ForbiddenException} When the requester lacks access per visibility rules
   */
  async findByIdWithVisibilityCheck(
    profileId: string,
    requesterId: string,
    requesterRole: Role,
  ): Promise<Profile | null> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        testScores: true,
        activities: {
          orderBy: { order: 'asc' },
          include: { activityTemplate: true },
        },
        awards: { orderBy: { order: 'asc' }, include: { competition: true } },
        semesterGpas: { orderBy: { order: 'asc' } },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.userId === requesterId) {
      return profile;
    }

    if (requesterRole === Role.ADMIN) {
      return profile;
    }

    if (profile.visibility === Visibility.PRIVATE) {
      throw new ForbiddenException('This profile is private');
    }

    if (
      profile.visibility === Visibility.VERIFIED_ONLY &&
      requesterRole !== Role.VERIFIED
    ) {
      throw new ForbiddenException('Only verified users can view this profile');
    }

    if (profile.visibility === Visibility.ANONYMOUS) {
      return this.anonymizeProfile(profile);
    }

    return profile;
  }

  /**
   * Strip personally identifiable information from a profile for anonymous viewing.
   *
   * The user was told "他人可见但隐藏身份". Masking realName is not enough to keep
   * that promise, because the spread carried everything else through:
   *
   *  - `userId` is the join key. GET /forum/posts publishes it as author.id
   *    beside profile.realName, so one lookup undoes the whole masking — the
   *    same defect fixed in feaa8cce / afb38270 / 21d666d1.
   *  - `user` carries that same id one level down; the include is gone now, but
   *    the strip stays — this must hold for whatever it is handed.
   *  - `avatarUrl` is a photograph of the person.
   *  - `bio` is free text they wrote about themselves; it routinely contains a
   *    name or a school.
   *  - `birthday` is a date of birth.
   *
   * `nickname` stays: a pseudonymous handle is what an anonymous profile is for.
   * Academic fields stay — the point of the surface is comparing profiles.
   *
   * Deny-list, not an allow-list, for the same reason as stripCaseIdentity:
   * Profile has ~40 columns and enumerating them here would be the more
   * dangerous change.
   *
   * Replaces realName with null, school name with "Private School", and buckets GPA
   * into ranges (3.9+, 3.7+, 3.5+, 3.3+, 3.0+, 2.5+).
   *
   * @param profile - The full profile with optional relations
   * @returns A copy of the profile with PII removed
   */
  anonymizeProfile(
    profile: Profile & {
      testScores?: unknown[];
      activities?: unknown[];
      awards?: unknown[];
    },
  ): Profile & {
    testScores?: unknown[];
    activities?: unknown[];
    awards?: unknown[];
  } {
    const {
      userId: _userId,
      user: _user,
      avatarUrl: _avatarUrl,
      bio: _bio,
      birthday: _birthday,
      ...rest
    } = profile as typeof profile & { user?: unknown };
    return {
      ...rest,
      realName: null,
      currentSchool: this.anonymizeSchool(profile.currentSchool),
      gpa: profile.gpa ? this.anonymizeGpa(Number(profile.gpa)) : null,
    } as Profile & {
      testScores?: unknown[];
      activities?: unknown[];
      awards?: unknown[];
    };
  }

  private anonymizeSchool(school: string | null): string | null {
    if (!school) return null;
    return 'Private School';
  }

  private anonymizeGpa(gpa: number): Prisma.Decimal {
    if (gpa >= 3.9) return new Prisma.Decimal(3.9);
    if (gpa >= 3.7) return new Prisma.Decimal(3.7);
    if (gpa >= 3.5) return new Prisma.Decimal(3.5);
    if (gpa >= 3.3) return new Prisma.Decimal(3.3);
    if (gpa >= 3.0) return new Prisma.Decimal(3.0);
    return new Prisma.Decimal(2.5);
  }

  private toNullableDecimal(
    value: number | null | undefined,
  ): Prisma.Decimal | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return new Prisma.Decimal(value);
  }

  /**
   * Create a new profile for the given user.
   *
   * @param userId - The user identifier to associate the profile with
   * @param data - Profile creation data (without user relation)
   * @returns The created Profile record
   */
  async create(
    userId: string,
    data: Prisma.ProfileCreateWithoutUserInput,
  ): Promise<Profile> {
    return this.prisma.profile.create({
      data: {
        ...data,
        user: { connect: { id: userId } },
      },
    });
  }

  /**
   * Update an existing profile by user ID.
   *
   * Converts GPA and gpaScale from number to Prisma.Decimal before persisting.
   *
   * @param userId - The user identifier whose profile to update
   * @param data - Partial profile update DTO
   * @returns The updated Profile record
   */
  async update(userId: string, data: UpdateProfileDto): Promise<Profile> {
    return this.prisma.profile.update({
      where: { userId },
      data: {
        ...data,
        gpa: this.toNullableDecimal(data.gpa),
        weightedGpa: this.toNullableDecimal(data.weightedGpa),
        gpaScale:
          data.gpaScale === undefined
            ? undefined
            : new Prisma.Decimal(data.gpaScale),
        gpa9: this.toNullableDecimal(data.gpa9),
        gpa10: this.toNullableDecimal(data.gpa10),
        gpa11: this.toNullableDecimal(data.gpa11),
        gpa12: this.toNullableDecimal(data.gpa12),
      },
    });
  }

  /**
   * Create or update a profile for the given user (upsert).
   *
   * Uses Prisma upsert keyed on userId. On create, connects the user relation.
   * Cache invalidation is performed after persistence.
   *
   * @param userId - The user identifier
   * @param data - Profile data to create or merge
   * @returns The upserted Profile record
   */
  async upsert(userId: string, data: UpdateProfileDto): Promise<Profile> {
    const profileData = {
      ...data,
      gpa: this.toNullableDecimal(data.gpa),
      gpaScale:
        data.gpaScale === undefined
          ? undefined
          : new Prisma.Decimal(data.gpaScale),
      gpa9: this.toNullableDecimal(data.gpa9),
      gpa10: this.toNullableDecimal(data.gpa10),
      gpa11: this.toNullableDecimal(data.gpa11),
      gpa12: this.toNullableDecimal(data.gpa12),
    };

    let profile: Profile;
    try {
      profile = await this.prisma.profile.upsert({
        where: { userId },
        update: profileData,
        create: {
          ...profileData,
          user: { connect: { id: userId } },
        },
      });
    } catch (error) {
      const targets = Array.isArray(
        (error as { meta?: { target?: unknown } })?.meta?.target,
      )
        ? (
            (error as { meta?: { target?: unknown[] } }).meta?.target ?? []
          ).filter((target): target is string => typeof target === 'string')
        : typeof (error as { meta?: { target?: unknown } })?.meta?.target ===
            'string'
          ? [(error as { meta?: { target?: string } }).meta?.target ?? '']
          : [];
      const isUserIdRace =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        targets.some((target) => target.includes('userId'));

      if (!isUserIdRace) {
        throw error;
      }

      this.logger.warn(
        `Profile upsert hit a concurrent userId create for ${userId}; retrying as update`,
      );
      profile = await this.prisma.profile.update({
        where: { userId },
        data: profileData,
      });
    }

    // 失效所有依赖 profile 的缓存（含 AI 分析）
    await this.cacheInvalidation.onProfileChange(userId);

    return profile;
  }

  // ============================================
  // Recommendation Letters CRUD
  // ============================================

  async getRecommendationLetters(userId: string) {
    return this.prisma.recommendationLetter.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRecommendationLetter(
    userId: string,
    data: CreateRecommendationLetterDto,
  ) {
    const letter = await this.prisma.recommendationLetter.create({
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        user: { connect: { id: userId } },
      },
    });
    await this.cacheInvalidation.onProfileChange(userId);
    return letter;
  }

  async updateRecommendationLetter(
    userId: string,
    id: string,
    data: UpdateRecommendationLetterDto,
  ) {
    const letter = await this.prisma.recommendationLetter.findFirst({
      where: { id, userId },
    });
    if (!letter) {
      throw new NotFoundException('Recommendation letter not found');
    }
    const updated = await this.prisma.recommendationLetter.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate,
      },
    });
    await this.cacheInvalidation.onProfileChange(userId);
    return updated;
  }

  async deleteRecommendationLetter(userId: string, id: string) {
    const letter = await this.prisma.recommendationLetter.findFirst({
      where: { id, userId },
    });
    if (!letter) {
      throw new NotFoundException('Recommendation letter not found');
    }
    await this.prisma.recommendationLetter.delete({ where: { id } });
    await this.cacheInvalidation.onProfileChange(userId);
    return { success: true };
  }
}
