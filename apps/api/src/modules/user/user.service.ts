import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TeamStatus, User } from '@prisma/client';
import { randomBytes } from 'crypto';
import { safeDelete } from '../../common/utils/safe-delete';
import { PrismaService } from '../../prisma/prisma.service';
import { PeerReviewService } from '../peer-review/peer-review.service';
import {
  extractOwnedObjectKey,
  StorageService,
} from '../../common/storage/storage.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private peerReviewService: PeerReviewService,
    private storage: StorageService,
  ) {}

  /**
   * Find a user by their unique ID, excluding soft-deleted users
   * @param id - The unique identifier of the user
   * @returns The user if found, or null if not found or soft-deleted
   */
  async findById(id: string): Promise<User | null> {
    // governance: parent-scoped — generic building blocks; user.controller passes @CurrentUser().id, never a path param
    return this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });
  }

  /**
   * Find a user by their email address, excluding soft-deleted users
   * @param email - The email address to search for
   * @returns The user if found, or null if no user matches the email or is soft-deleted
   */
  async findByEmail(email: string): Promise<User | null> {
    // governance: parent-scoped — generic building blocks; user.controller passes @CurrentUser().id, never a path param
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
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
    // governance: parent-scoped — generic building blocks; user.controller passes @CurrentUser().id, never a path param
    return this.prisma.user.create({ data });
  }

  /**
   * Update an existing user's data
   * @param id - The unique identifier of the user to update
   * @param data - The fields to update on the user record
   * @returns The updated user
   */
  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    // governance: parent-scoped — generic building blocks; user.controller passes @CurrentUser().id, never a path param
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  // Hall §7 Decision B: `getPeerReviewSetting` / `updatePeerReviewSetting`
  // (and the private `deriveAge` helper) were removed. They read/wrote the
  // dropped `User.acceptPeerReview` column for the retired Hall 锐评 opt-in.

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
      // The profile is where the identifiers actually live. softDelete
      // anonymised User.email and Message.content and then stopped, so after
      // "注销账号 — 永久删除您的账户和数据" the real name, photo, bio and date of
      // birth stayed on the profile — and nothing filters `deletedAt` when
      // serving it, so every forum post the account wrote kept rendering
      // author.name and author.avatar (mapForumAuthor reads exactly these two).
      // Same field set that anonymizeProfile strips for ANONYMOUS viewing.
      await safeDelete(
        tx.profile.updateMany({
          where: { userId: id },
          data: {
            realName: null,
            nickname: null,
            avatarUrl: null,
            bio: null,
            birthday: null,
          },
        }),
        ctx('profile'),
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

    const objectKeys = await this.collectOwnedObjectKeys(id);
    if (objectKeys.length > 0) {
      await this.storage.deleteFiles(objectKeys);
    }

    let ratingCounterparties: string[] = [];
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

      // ForumPost.currentSize is denormalised and TeamMember cascades off
      // User, so deleting an account silently removed someone from a team
      // without recounting: a FULL team stayed FULL forever, showing a
      // headcount that included the deleted member, and the freed slot never
      // reopened. leaveTeam already does this recount — the cascade cannot.
      // (Teams the user OWNED need no handling: ForumPost cascades off
      // authorId, so those posts go with them.)
      const memberships = await tx.teamMember.findMany({
        where: { userId: id },
        select: { postId: true },
      });
      if (memberships.length > 0) {
        await safeDelete(
          tx.teamMember.deleteMany({ where: { userId: id } }),
          ctx('teamMember'),
        );
        for (const postId of new Set(memberships.map((m) => m.postId))) {
          const memberCount = await tx.teamMember.count({ where: { postId } });
          const post = await tx.forumPost.findUnique({
            where: { id: postId },
            select: { teamStatus: true, teamSize: true },
          });
          await tx.forumPost.update({
            where: { id: postId },
            data: {
              currentSize: memberCount,
              // Only undo a FULL that is no longer true. CLOSED is the owner
              // deciding recruitment is over, and losing a member is not a
              // reason to overrule that.
              ...(post?.teamStatus === TeamStatus.FULL &&
              (!post.teamSize || memberCount < post.teamSize)
                ? { teamStatus: TeamStatus.RECRUITING }
                : {}),
            },
          });
        }
      }

      await this.recountForumDenormals(tx, id);

      // PeerReview cascades off BOTH sides, and a user's stored rating
      // (peerAvgRating/peerReviewCount, written whole by updateUserRating)
      // mixes forward scores from reviews they received with reverse scores
      // from reviews they gave. So deleting this account silently changes the
      // input set of every counterparty — collect them now, while the rows
      // still exist; recompute after commit, when the cascade has run and
      // updateUserRating reads the post-delete truth.
      const [given, received] = await Promise.all([
        tx.peerReview.findMany({
          where: { reviewerId: id },
          select: { revieweeId: true },
        }),
        tx.peerReview.findMany({
          where: { revieweeId: id },
          select: { reviewerId: true },
        }),
      ]);
      ratingCounterparties = [
        ...new Set([
          ...given.map((r) => r.revieweeId),
          ...received.map((r) => r.reviewerId),
        ]),
      ].filter((uid) => uid !== id);

      await this.deleteOrphanUserIdRows(tx, id);

      await tx.user.delete({ where: { id } });
    });

    // Post-commit, best-effort: the account is gone either way, and a missed
    // recompute here only re-freezes an aggregate nothing currently reads.
    for (const uid of ratingCounterparties) {
      await this.peerReviewService
        .updateUserRating(uid)
        .catch((err) =>
          this.logger.warn(
            `Rating recompute failed for ${uid} after deleting ${id}: ${String(err)}`,
          ),
        );
    }

    this.logger.warn(`User ${id} hard deleted`);
  }

  /**
   * Object keys this user owns in local/COS/S3. Collected before the
   * transaction so a blob failure leaves the account in place for retry.
   */
  private async collectOwnedObjectKeys(userId: string): Promise<string[]> {
    const keys: string[] = [];
    const add = (ref?: string | null) => {
      const key = extractOwnedObjectKey(ref);
      if (key) keys.push(key);
    };

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { avatarUrl: true },
    });
    add(profile?.avatarUrl);

    const verifications = await this.prisma.verificationRequest.findMany({
      where: { userId },
      select: { proofUrl: true },
    });
    for (const row of verifications) add(row.proofUrl);

    const outcomes = await this.prisma.predictionOutcomeLabelRecord.findMany({
      where: { reportedBy: userId },
      select: { evidenceUrl: true },
    });
    for (const row of outcomes) add(row.evidenceUrl);

    const images = await this.prisma.forumPostImage.findMany({
      where: { post: { authorId: userId } },
      select: { key: true, url: true },
    });
    for (const image of images) {
      if (image.key) keys.push(image.key);
      else add(image.url);
    }

    return [...new Set(keys)];
  }

  /**
   * Models with a bare userId (no User @relation). AuditLog / AgentAuditLog /
   * AgentSecurityEvent are retain-allowlisted — see check-orphan-userid.ts.
   */
  private async deleteOrphanUserIdRows(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<void> {
    const ctx = (entity: string) => ({
      entity,
      userId: id,
      operation: 'hardDelete' as const,
    });
    await safeDelete(
      tx.memory.deleteMany({ where: { userId: id } }),
      ctx('memory'),
    );
    await safeDelete(
      tx.agentConversation.deleteMany({ where: { userId: id } }),
      ctx('agentConversation'),
    );
    await safeDelete(
      tx.entity.deleteMany({ where: { userId: id } }),
      ctx('entity'),
    );
    await safeDelete(
      tx.userAIPreference.deleteMany({ where: { userId: id } }),
      ctx('userAIPreference'),
    );
    await safeDelete(
      tx.agentTokenUsage.deleteMany({ where: { userId: id } }),
      ctx('agentTokenUsage'),
    );
    await safeDelete(
      tx.agentQuota.deleteMany({ where: { userId: id } }),
      ctx('agentQuota'),
    );
    await safeDelete(
      tx.memoryCompaction.deleteMany({ where: { userId: id } }),
      ctx('memoryCompaction'),
    );
    await safeDelete(
      tx.agentTask.deleteMany({ where: { userId: id } }),
      ctx('agentTask'),
    );
    await safeDelete(
      tx.forumLike.deleteMany({ where: { userId: id } }),
      ctx('forumLike'),
    );
    await safeDelete(
      tx.caseSwipe.deleteMany({ where: { userId: id } }),
      ctx('caseSwipe'),
    );
    await safeDelete(
      tx.graphEntity.deleteMany({ where: { userId: id } }),
      ctx('graphEntity'),
    );
    await safeDelete(
      tx.entityRelationship.deleteMany({ where: { userId: id } }),
      ctx('entityRelationship'),
    );
    await safeDelete(
      tx.applicationAnalysisRun.deleteMany({ where: { userId: id } }),
      ctx('applicationAnalysisRun'),
    );
    await safeDelete(
      tx.applicationAnalysisExposureRecord.deleteMany({
        where: { userId: id },
      }),
      ctx('applicationAnalysisExposureRecord'),
    );
    await safeDelete(
      tx.applicationAnalysisFeedbackRecord.deleteMany({
        where: { userId: id },
      }),
      ctx('applicationAnalysisFeedbackRecord'),
    );
  }

  /**
   * Export all user data for GDPR compliance, excluding sensitive fields like passwordHash
   * @param id - The unique identifier of the user whose data to export
   * @throws {NotFoundException} When no user exists with the given ID
   * @returns An object containing the export date and the user's data (profile, cases, followers, following)
   */
  async exportUserData(id: string): Promise<Record<string, any>> {
    // governance: parent-scoped — GDPR export — reached only from @Get("me/export"), which passes @CurrentUser().id
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
    const { passwordHash: _passwordHash, ...userData } = user;

    return {
      exportDate: new Date().toISOString(),
      user: userData,
    };
  }

  // ============ Referral System ============

  /**
   * Get or create a unique referral code for a user
   * @param userId - The unique identifier of the user
   * @returns The user's referral code (12-char hex string)
   */
  async getOrCreateReferralCode(userId: string): Promise<string> {
    const user = await this.findByIdOrThrow(userId);

    if (user.referralCode) {
      return user.referralCode;
    }

    // Generate a unique 12-char code (6 bytes = 2^48 combinations)
    let code: string = '';
    let attempts = 0;
    do {
      code = randomBytes(6).toString('hex').toUpperCase();
      const existing = await this.prisma.user.findUnique({
        where: { referralCode: code },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new InternalServerErrorException(
        'Failed to generate unique referral code after 10 attempts',
      );
    }

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

    // governance: parent-scoped — keyed by a referral code, a value its owner hands out deliberately; returns only the referrer id, nothing else about them
    const referrer = await this.prisma.user.findUnique({
      where: { referralCode: normalizedCode },
      select: { id: true },
    });
    return referrer?.id ?? null;
  }

  /**
   * Repair the forum's denormalised counters before the account's rows vanish.
   *
   * ForumComment, ForumPost and ForumCommunityFollow all cascade off User, and
   * ForumPost.commentCount / ForumCommunity.postCount / .followerCount are
   * columns the application increments by hand. A database cascade runs no
   * application code, so every one of those counters kept counting rows that no
   * longer existed — permanently, and commentCount and postCount are both
   * indexed and used for ORDER BY.
   *
   * Recounts rather than decrementing by the number of rows removed: deleting
   * one of this user's comments also cascades away OTHER users' replies to it
   * (ForumComment.parent is Cascade too), so the rows that disappear are not
   * the rows we enumerated. Recounting is exact regardless of depth, and heals
   * any drift already on the row.
   *
   * ponytail: one UPDATE per affected parent. Account deletion is rare and
   * already a large transaction; if a user with thousands of comments ever
   * makes this slow, group the updates by resulting count.
   */
  private async recountForumDenormals(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    // Posts this user commented on. Their OWN posts cascade away with them, so
    // those counters go too — harmless to touch, not worth a second query.
    const commentedPostIds = [
      ...new Set(
        (
          await tx.forumComment.findMany({
            where: { authorId: userId },
            select: { postId: true },
          })
        ).map((c) => c.postId),
      ),
    ];
    const communityIds = [
      ...new Set(
        [
          ...(
            await tx.forumPost.findMany({
              where: { authorId: userId, communityId: { not: null } },
              select: { communityId: true },
            })
          ).map((p) => p.communityId),
          ...(
            await tx.forumCommunityFollow.findMany({
              where: { userId },
              select: { communityId: true },
            })
          ).map((f) => f.communityId),
        ].filter((c): c is string => c !== null),
      ),
    ];

    await safeDelete(
      tx.forumComment.deleteMany({ where: { authorId: userId } }),
      { entity: 'forumComment', userId, operation: 'hardDelete' as const },
    );
    await safeDelete(
      tx.forumCommunityFollow.deleteMany({ where: { userId } }),
      {
        entity: 'forumCommunityFollow',
        userId,
        operation: 'hardDelete' as const,
      },
    );
    await safeDelete(tx.forumPost.deleteMany({ where: { authorId: userId } }), {
      entity: 'forumPost',
      userId,
      operation: 'hardDelete' as const,
    });

    for (const postId of commentedPostIds) {
      const commentCount = await tx.forumComment.count({ where: { postId } });
      await tx.forumPost
        .update({ where: { id: postId }, data: { commentCount } })
        .catch(() => undefined); // the post itself may have just been deleted
    }
    for (const communityId of communityIds) {
      const [postCount, followerCount] = await Promise.all([
        tx.forumPost.count({ where: { communityId } }),
        tx.forumCommunityFollow.count({ where: { communityId } }),
      ]);
      await tx.forumCommunity.update({
        where: { id: communityId },
        data: { postCount, followerCount },
      });
    }
  }
}
