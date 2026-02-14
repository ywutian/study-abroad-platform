import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import { safeDelete } from '../../common/utils/safe-delete';
import { randomBytes } from 'crypto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Find a user by their unique ID, excluding soft-deleted users
   * @param id - The unique identifier of the user
   * @returns The user if found, or null if not found or soft-deleted
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });
  }

  /**
   * Find a user by their email address
   * @param email - The email address to search for
   * @returns The user if found, or null if no user matches the email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Find a user by their unique ID, throwing if not found
   * @param id - The unique identifier of the user
   * @throws {NotFoundException} When no user exists with the given ID
   * @returns The user matching the given ID
   */
  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Create a new user record in the database
   * @param data - The user creation input data
   * @returns The newly created user
   */
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  /**
   * Update an existing user's data
   * @param id - The unique identifier of the user to update
   * @param data - The fields to update on the user record
   * @returns The updated user
   */
  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft-delete a user account by anonymizing sensitive data and marking the record as deleted (GDPR-compliant)
   * @param id - The unique identifier of the user to soft-delete
   * @returns The updated user record with anonymized data and a deletedAt timestamp
   */
  async softDelete(id: string): Promise<User> {
    this.logger.log(`Soft deleting user: ${id}`);

    // [A4-008] Use safeDelete utility instead of silent .catch(() => {})
    const ctx = (entity: string) => ({
      entity,
      userId: id,
      operation: 'softDelete' as const,
    });

    return this.prisma.$transaction(async (tx) => {
      const anonymizedEmail = `deleted_${id}@deleted.local`;

      // Clean up related data (non-critical: continue on failure)
      await safeDelete(
        tx.refreshToken.deleteMany({ where: { userId: id } }),
        ctx('refreshToken'),
      );
      await safeDelete(
        tx.message.updateMany({
          where: { senderId: id },
          data: { content: '[已删除]' },
        }),
        ctx('message'),
      );
      await safeDelete(
        tx.admissionCase.updateMany({
          where: { userId: id },
          data: { visibility: 'PRIVATE' },
        }),
        ctx('admissionCase'),
      );
      await safeDelete(
        tx.follow.deleteMany({
          where: { OR: [{ followerId: id }, { followingId: id }] },
        }),
        ctx('follow'),
      );
      await safeDelete(
        tx.block.deleteMany({
          where: { OR: [{ blockerId: id }, { blockedId: id }] },
        }),
        ctx('block'),
      );

      // Update user record (this is the critical operation)
      const deletedUser = await tx.user.update({
        where: { id },
        data: {
          email: anonymizedEmail,
          passwordHash: 'DELETED',
          deletedAt: new Date(),
        },
      });

      this.logger.log(`User ${id} soft deleted successfully`);
      return deletedUser;
    });
  }

  /**
   * Permanently delete a user and all associated data (irreversible operation)
   * @param id - The unique identifier of the user to permanently delete
   * @returns void
   */
  async hardDelete(id: string): Promise<void> {
    this.logger.warn(`Hard deleting user: ${id}`);

    // [A4-008] hardDelete uses critical=true — errors roll back the transaction
    const ctx = (entity: string) => ({
      entity,
      userId: id,
      operation: 'hardDelete' as const,
    });

    await this.prisma.$transaction(async (tx) => {
      await safeDelete(
        tx.refreshToken.deleteMany({ where: { userId: id } }),
        ctx('refreshToken'),
      );
      await safeDelete(
        tx.message.deleteMany({ where: { senderId: id } }),
        ctx('message'),
      );
      await safeDelete(
        tx.conversationParticipant.deleteMany({ where: { userId: id } }),
        ctx('conversationParticipant'),
      );
      await safeDelete(
        tx.follow.deleteMany({
          where: { OR: [{ followerId: id }, { followingId: id }] },
        }),
        ctx('follow'),
      );
      await safeDelete(
        tx.block.deleteMany({
          where: { OR: [{ blockerId: id }, { blockedId: id }] },
        }),
        ctx('block'),
      );
      await safeDelete(
        tx.admissionCase.deleteMany({ where: { userId: id } }),
        ctx('admissionCase'),
      );
      await safeDelete(
        tx.profile.deleteMany({ where: { userId: id } }),
        ctx('profile'),
      );

      await tx.user.delete({ where: { id } });
    });

    this.logger.warn(`User ${id} hard deleted`);
  }

  /**
   * Export all user data for GDPR compliance, excluding sensitive fields like passwordHash
   * @param id - The unique identifier of the user whose data to export
   * @throws {NotFoundException} When no user exists with the given ID
   * @returns An object containing the export date and the user's data (profile, cases, followers, following)
   */
  async exportUserData(id: string): Promise<Record<string, any>> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: {
          include: {
            essays: true,
          },
        },
        admissionCases: true,
        followers: true,
        following: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 移除敏感字段
    const { passwordHash, ...userData } = user;

    return {
      exportDate: new Date().toISOString(),
      user: userData,
    };
  }

  // ============ Referral System ============

  /**
   * Get or create a unique referral code for a user
   * @param userId - The unique identifier of the user
   * @returns The user's referral code (8-char hex string)
   */
  async getOrCreateReferralCode(userId: string): Promise<string> {
    const user = await this.findByIdOrThrow(userId);

    if (user.referralCode) {
      return user.referralCode;
    }

    // Generate a unique 8-char code
    let code: string;
    let attempts = 0;
    do {
      code = randomBytes(4).toString('hex').toUpperCase();
      const existing = await this.prisma.user.findUnique({
        where: { referralCode: code },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { referralCode: code },
    });

    return code;
  }

  /**
   * Get referral statistics for a user
   * @param userId - The unique identifier of the referrer
   * @returns Object with referral count and total points earned from referrals
   */
  async getReferralStats(userId: string): Promise<{
    referralCount: number;
    totalPointsEarned: number;
  }> {
    const referralCount = await this.prisma.user.count({
      where: { referredById: userId },
    });

    // Count points earned from referral actions
    const pointHistory = await this.prisma.pointHistory.findMany({
      where: {
        userId,
        action: 'REFER_USER',
      },
      select: { points: true },
    });

    const totalPointsEarned = pointHistory.reduce(
      (sum, h) => sum + h.points,
      0,
    );

    return { referralCount, totalPointsEarned };
  }

  /**
   * Get list of users referred by this user
   * @param userId - The unique identifier of the referrer
   * @returns Array of referred user objects with basic info
   */
  async getReferralList(userId: string): Promise<{
    referrals: Array<{
      id: string;
      email: string;
      joinedAt: Date;
      pointsEarned: number;
    }>;
    total: number;
  }> {
    const [referrals, referralRewards] = await Promise.all([
      this.prisma.user.findMany({
        where: { referredById: userId },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pointHistory.findMany({
        where: {
          userId,
          action: 'REFER_USER',
        },
        select: {
          points: true,
          metadata: true,
        },
      }),
    ]);

    const pointsByReferredId = new Map<string, number>();
    for (const reward of referralRewards) {
      const metadata = reward.metadata as { referredUserId?: string } | null;
      const referredUserId = metadata?.referredUserId;
      if (!referredUserId) continue;

      const current = pointsByReferredId.get(referredUserId) ?? 0;
      pointsByReferredId.set(referredUserId, current + reward.points);
    }

    return {
      referrals: referrals.map((r) => ({
        id: r.id,
        email: r.email,
        joinedAt: r.createdAt,
        pointsEarned: pointsByReferredId.get(r.id) ?? 0,
      })),
      total: referrals.length,
    };
  }

  /**
   * Validate a referral code and return the referrer user ID
   * @param referralCode - The referral code to validate
   * @returns The referrer's user ID if valid, null otherwise
   */
  async validateReferralCode(referralCode: string): Promise<string | null> {
    const normalizedCode = referralCode.trim().toUpperCase();
    if (!normalizedCode) return null;

    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: normalizedCode },
      select: { id: true },
    });
    return referrer?.id ?? null;
  }
}
