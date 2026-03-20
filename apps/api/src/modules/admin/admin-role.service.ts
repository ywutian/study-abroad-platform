import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  AuditLogService,
  AuditAction,
} from '../../common/services/audit-log.service';

const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.USER]: 0,
  [Role.VERIFIED]: 1,
  [Role.OPERATOR]: 2,
  [Role.ADMIN]: 3,
  [Role.SUPER_ADMIN]: 4,
};

@Injectable()
export class AdminRoleService {
  private readonly logger = new Logger(AdminRoleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Get all role permissions grouped by role
   */
  async getAllPermissions() {
    const perms = await this.prisma.rolePermission.findMany({
      orderBy: [{ role: 'asc' }, { permission: 'asc' }],
      select: { role: true, permission: true, granted: true },
    });

    return perms;
  }

  /**
   * Bulk update permissions for a role
   */
  async updatePermissions(
    role: Role,
    permissions: { permission: string; granted: boolean }[],
    grantedBy: string,
  ) {
    const results = [];
    for (const { permission, granted } of permissions) {
      const result = await this.prisma.rolePermission.upsert({
        where: { role_permission: { role, permission } },
        create: { role, permission, granted, grantedBy },
        update: { granted, grantedBy },
      });
      results.push(result);
    }

    // Invalidate Redis cache for this role
    await this.redis.del(`role_perms:${role}`);

    await this.auditLog.log({
      userId: grantedBy,
      action: AuditAction.PERMISSION_UPDATE,
      resource: 'role_permission',
      metadata: {
        role,
        updatedPermissions: permissions.length,
        permissions: permissions.map((p) => `${p.permission}:${p.granted}`),
      },
    });

    this.logger.log(
      `Updated ${results.length} permissions for ${role} by ${grantedBy}`,
    );
    return results;
  }

  /**
   * Find a user by email for the promote flow
   */
  async findUserByEmail(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Promote a user by email — delegates to setUserRole for security
   */
  async promoteUserByEmail(
    email: string,
    newRole: Role,
    callerId: string,
    callerRole: Role,
  ) {
    const user = await this.findUserByEmail(email);

    if (user.role === newRole) {
      throw new BadRequestException(`User already has role ${newRole}`);
    }

    return this.setUserRole(user.id, newRole, callerId, callerRole);
  }

  /**
   * Set a user's role with escalation protection.
   *
   * Rules:
   * - Cannot modify your own role
   * - Cannot assign a role >= your own level
   * - Cannot modify a user whose role >= your own level
   */
  async setUserRole(
    userId: string,
    newRole: Role,
    callerId: string,
    callerRole: Role,
  ) {
    // Self-modification check
    if (callerId === userId) {
      throw new ForbiddenException('Cannot modify your own role');
    }

    const callerLevel = ROLE_HIERARCHY[callerRole] ?? 0;
    const newRoleLevel = ROLE_HIERARCHY[newRole] ?? 0;

    // Escalation check: cannot assign a role at or above your own level
    if (newRoleLevel >= callerLevel) {
      throw new ForbiddenException(
        `Cannot assign role ${newRole} — equal to or higher than your own role ${callerRole}`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const targetLevel = ROLE_HIERARCHY[user.role] ?? 0;

    // Target protection: cannot modify a user at or above your own level
    if (targetLevel >= callerLevel) {
      throw new ForbiddenException(
        `Cannot modify user with role ${user.role} — equal to or higher than your own role ${callerRole}`,
      );
    }

    const oldRole = user.role;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: { id: true, email: true, role: true },
    });

    await this.auditLog.log({
      userId: callerId,
      action: AuditAction.ROLE_CHANGE,
      resource: 'user',
      resourceId: userId,
      metadata: {
        userEmail: user.email,
        oldRole,
        newRole,
        changedBy: callerId,
      },
    });

    this.logger.log(
      `User ${user.email} role changed: ${oldRole} → ${newRole} by ${callerId}`,
    );
    return updated;
  }

  /**
   * List operators with work stats
   */
  async getOperators() {
    const operators = await this.prisma.user.findMany({
      where: { role: Role.OPERATOR },
      select: {
        id: true,
        email: true,
        createdAt: true,
        profile: { select: { nickname: true, realName: true } },
      },
    });

    // Get audit log stats for each operator
    const result = await Promise.all(
      operators.map(async (op) => {
        const [totalActions, todayActions] = await Promise.all([
          this.prisma.auditLog.count({ where: { userId: op.id } }),
          this.prisma.auditLog.count({
            where: {
              userId: op.id,
              createdAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
              },
            },
          }),
        ]);
        return { ...op, totalActions, todayActions };
      }),
    );

    return result;
  }
}
