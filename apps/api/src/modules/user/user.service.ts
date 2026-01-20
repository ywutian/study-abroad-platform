import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';

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

    // 使用事务确保数据一致性
    return this.prisma.$transaction(async (tx) => {
      // 1. 匿名化用户敏感数据
      const anonymizedEmail = `deleted_${id}@deleted.local`;

      // 2. 清理用户 refresh tokens
      await tx.refreshToken
        .deleteMany({
          where: { userId: id },
        })
        .catch(() => {
          // 可能不存在
        });

      // 3. 清理用户的聊天消息（保留结构但删除内容）
      await tx.message
        .updateMany({
          where: { senderId: id },
          data: { content: '[已删除]' },
        })
        .catch(() => {});

      // 4. 匿名化用户的案例分享（设置 visibility 为 PRIVATE）
      await tx.admissionCase
        .updateMany({
          where: { userId: id },
          data: {
            visibility: 'PRIVATE',
          },
        })
        .catch(() => {});

      // 5. 删除用户的收藏和关注关系
      await tx.follow
        .deleteMany({
          where: { OR: [{ followerId: id }, { followingId: id }] },
        })
        .catch(() => {});

      await tx.block
        .deleteMany({
          where: { OR: [{ blockerId: id }, { blockedId: id }] },
        })
        .catch(() => {});

      // 6. 更新用户记录
      const deletedUser = await tx.user.update({
        where: { id },
        data: {
          email: anonymizedEmail,
          passwordHash: 'DELETED',
          deletedAt: new Date(),
          // 保留基本结构用于数据完整性
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

    await this.prisma.$transaction(async (tx) => {
      // 删除所有关联数据
      await tx.refreshToken
        .deleteMany({ where: { userId: id } })
        .catch(() => {});
      await tx.message.deleteMany({ where: { senderId: id } }).catch(() => {});
      // 删除用户参与的会话
      await tx.conversationParticipant
        .deleteMany({
          where: { userId: id },
        })
        .catch(() => {});
      await tx.follow
        .deleteMany({
          where: { OR: [{ followerId: id }, { followingId: id }] },
        })
        .catch(() => {});
      await tx.block
        .deleteMany({
          where: { OR: [{ blockerId: id }, { blockedId: id }] },
        })
        .catch(() => {});
      await tx.admissionCase
        .deleteMany({ where: { userId: id } })
        .catch(() => {});
      await tx.profile.deleteMany({ where: { userId: id } }).catch(() => {});

      // 最后删除用户
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
}
