/**
 * 通用权限验证服务
 *
 * 统一处理实体所有权验证，减少重复代码
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

/**
 * 可拥有实体接口
 */
export interface Ownable {
  userId?: string;
  authorId?: string;
  [key: string]: unknown;
}

/**
 * 验证选项
 */
export interface VerifyOptions {
  /** 实体名称，用于错误消息 */
  entityName?: string;
  /** 所有者字段名，默认 'userId' */
  ownerField?: string;
  /** 是否在实体不存在时抛出异常，默认 true */
  throwOnNotFound?: boolean;
}

@Injectable()
export class AuthorizationService {
  /**
   * 验证实体所有权
   *
   * @example
   * // 验证帖子所有权
   * const post = this.auth.verifyOwnership(
   *   await this.prisma.forumPost.findUnique({ where: { id } }),
   *   userId,
   *   { entityName: 'Post', ownerField: 'authorId' }
   * );
   *
   * @example
   * // 验证用户资源
   * const vault = this.auth.verifyOwnership(
   *   await this.prisma.vaultItem.findUnique({ where: { id } }),
   *   userId,
   *   { entityName: 'Vault item' }
   * );
   */
  verifyOwnership<T extends Ownable>(
    entity: T | null,
    userId: string,
    options: VerifyOptions = {},
  ): T {
    const {
      entityName = 'Resource',
      ownerField = 'userId',
      throwOnNotFound = true,
    } = options;

    if (!entity) {
      if (throwOnNotFound) {
        throw new NotFoundException(`${entityName} not found`);
      }
      return null as unknown as T;
    }

    const ownerId = entity[ownerField] as string | undefined;
    if (ownerId !== userId) {
      throw new ForbiddenException(
        `You don't have permission to access this ${entityName.toLowerCase()}`,
      );
    }

    return entity;
  }

  /**
   * 验证实体存在
   *
   * @example
   * const school = this.auth.verifyExists(
   *   await this.prisma.school.findUnique({ where: { id } }),
   *   'School'
   * );
   */
  verifyExists<T>(entity: T | null, entityName: string = 'Resource'): T {
    if (!entity) {
      throw new NotFoundException(`${entityName} not found`);
    }
    return entity;
  }

  /**
   * 验证用户角色
   *
   * @example
   * this.auth.verifyRole(user.role, ['ADMIN', 'VERIFIED']);
   */
  verifyRole(
    userRole: string,
    requiredRoles: string[],
    message?: string,
  ): void {
    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException(
        message || "You don't have permission to perform this action",
      );
    }
  }

  /**
   * 验证用户是管理员或所有者
   *
   * @example
   * const case = this.auth.verifyAdminOrOwner(
   *   await this.prisma.admissionCase.findUnique({ where: { id } }),
   *   userId,
   *   user.role,
   *   { entityName: 'Case' }
   * );
   */
  verifyAdminOrOwner<T extends Ownable>(
    entity: T | null,
    userId: string,
    userRole: string,
    options: VerifyOptions = {},
  ): T {
    const { entityName = 'Resource', ownerField = 'userId' } = options;

    if (!entity) {
      throw new NotFoundException(`${entityName} not found`);
    }

    const isAdmin = userRole === 'ADMIN';
    const ownerId = entity[ownerField] as string | undefined;
    const isOwner = ownerId === userId;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        `You don't have permission to access this ${entityName.toLowerCase()}`,
      );
    }

    return entity;
  }

  /**
   * 验证嵌套所有权（通过关联实体）
   *
   * @example
   * // Activity -> Profile -> User
   * const activity = this.auth.verifyNestedOwnership(
   *   await this.prisma.activity.findUnique({
   *     where: { id },
   *     include: { profile: { select: { userId: true } } }
   *   }),
   *   userId,
   *   (a) => a.profile?.userId,
   *   { entityName: 'Activity' }
   * );
   */
  verifyNestedOwnership<T>(
    entity: T | null,
    userId: string,
    getOwnerId: (entity: T) => string | undefined,
    options: VerifyOptions = {},
  ): T {
    const { entityName = 'Resource', throwOnNotFound = true } = options;

    if (!entity) {
      if (throwOnNotFound) {
        throw new NotFoundException(`${entityName} not found`);
      }
      return null as unknown as T;
    }

    const ownerId = getOwnerId(entity);
    if (ownerId !== userId) {
      throw new ForbiddenException(
        `You don't have permission to access this ${entityName.toLowerCase()}`,
      );
    }

    return entity;
  }
}
