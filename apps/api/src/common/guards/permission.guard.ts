import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const CACHE_TTL = 300; // 5 minutes
const ROLE_CACHE_PREFIX = 'role_perms:';
const USER_CACHE_PREFIX = 'user_perms:';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @RequirePermission decorator → pass through
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // Only SUPER_ADMIN bypasses permission checks; ADMIN uses RolePermission table
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    const grantedPermissions = await this.getEffectivePermissions(
      user.id,
      user.role,
    );

    const hasAll = requiredPermissions.every((p) =>
      grantedPermissions.includes(p),
    );

    if (!hasAll) {
      this.logger.warn(
        `User ${user.id} (${user.role}) denied: missing ${requiredPermissions.filter((p) => !grantedPermissions.includes(p)).join(', ')}`,
      );
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }

  /**
   * Resolve effective permissions: UserPermission overrides RolePermission.
   *
   * Logic: Start with role-level granted permissions, then apply user-level overrides.
   * - UserPermission(granted=true) adds a permission even if role doesn't have it
   * - UserPermission(granted=false) removes a permission even if role grants it
   */
  async getEffectivePermissions(userId: string, role: Role): Promise<string[]> {
    const cacheKey = `${USER_CACHE_PREFIX}${userId}`;

    // Try user-specific cache first
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get role-level permissions
    const rolePerms = await this.getPermissionsForRole(role);

    // Get user-level overrides
    const userOverrides = await this.prisma.userPermission.findMany({
      where: { userId },
      select: { permission: true, granted: true },
    });

    // If no user overrides, just return role permissions
    if (userOverrides.length === 0) {
      return rolePerms;
    }

    // Apply overrides: start from role permissions set
    const permSet = new Set(rolePerms);

    for (const override of userOverrides) {
      if (override.granted) {
        permSet.add(override.permission);
      } else {
        permSet.delete(override.permission);
      }
    }

    const effectivePerms = Array.from(permSet);

    // Cache with user-specific key
    await this.redis.set(cacheKey, JSON.stringify(effectivePerms), CACHE_TTL);

    return effectivePerms;
  }

  private async getPermissionsForRole(role: Role): Promise<string[]> {
    const cacheKey = `${ROLE_CACHE_PREFIX}${role}`;

    // Try Redis cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Query DB
    const perms = await this.prisma.rolePermission.findMany({
      where: { role, granted: true },
      select: { permission: true },
    });

    const permissions = perms.map((p) => p.permission);

    // Cache result
    await this.redis.set(cacheKey, JSON.stringify(permissions), CACHE_TTL);

    return permissions;
  }
}
