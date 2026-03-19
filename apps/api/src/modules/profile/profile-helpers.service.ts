import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';

// 嵌套实体类型（通过 profile 关联到 user）
export interface ProfileOwnable {
  profile: { userId: string };
}

/**
 * Shared helper methods used by multiple profile sub-services.
 *
 * Provides profile ID resolution (with auto-creation) and nested entity
 * ownership verification.
 */
@Injectable()
export class ProfileHelpersService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthorizationService,
  ) {}

  /**
   * Get the profile ID for a user, auto-creating a blank profile if none exists.
   *
   * This is used internally before creating nested entities (test scores, activities, etc.)
   * to ensure a profile record exists.
   *
   * @param userId - The user identifier
   * @returns The profile ID (existing or newly created)
   */
  async getProfileId(userId: string): Promise<string> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      // Auto-create profile if not exists
      const newProfile = await this.prisma.profile.create({
        data: { user: { connect: { id: userId } } },
      });
      return newProfile.id;
    }

    return profile.id;
  }

  /**
   * Verify that a nested entity (test score, activity, award, etc.) belongs to the
   * requesting user by checking profile.userId.
   *
   * Delegates to AuthorizationService.verifyNestedOwnership for the actual check.
   *
   * @param entity - The entity with its profile relation loaded
   * @param userId - The requesting user's ID
   * @param entityName - Human-readable name for error messages (e.g. "Test score")
   * @returns The verified entity (non-null)
   * @throws {NotFoundException} When the entity is null
   * @throws {ForbiddenException} When the entity does not belong to the user
   */
  verifyProfileOwnership<T extends ProfileOwnable>(
    entity: T | null,
    userId: string,
    entityName: string,
  ): T {
    return this.auth.verifyNestedOwnership(
      entity,
      userId,
      (e) => e.profile?.userId,
      { entityName },
    );
  }
}
