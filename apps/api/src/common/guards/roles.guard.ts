import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Role hierarchy: SUPER_ADMIN > ADMIN > COUNSELOR > OPERATOR > VERIFIED > USER
 * Higher roles automatically satisfy lower role requirements.
 *
 * COUNSELOR is a B2B sibling of OPERATOR but is intentionally given a
 * SLIGHTLY higher numeric level (2.5). Reason: the guard uses
 * `userLevel >= requiredLevel` per required role — placing COUNSELOR at
 * 2 would let OPERATOR satisfy `@Roles(COUNSELOR)`, which is wrong (data
 * entry interns must not see counselor-only surfaces). At 2.5:
 *   - OPERATOR(2)  satisfies `@Roles(OPERATOR)`  but NOT `@Roles(COUNSELOR)`
 *   - COUNSELOR(2.5) satisfies `@Roles(OPERATOR)` (which is fine — counselors
 *     are higher trust than operators) and `@Roles(COUNSELOR)`
 *   - ADMIN(3) still satisfies both
 */
const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.USER]: 0,
  [Role.VERIFIED]: 1,
  [Role.OPERATOR]: 2,
  [Role.COUNSELOR]: 2.5,
  [Role.ADMIN]: 3,
  [Role.SUPER_ADMIN]: 4,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // SUPER_ADMIN has access to everything
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    const userLevel = ROLE_HIERARCHY[user.role as Role] ?? 0;

    // User passes if their level >= the minimum required role level
    return requiredRoles.some(
      (role) => userLevel >= (ROLE_HIERARCHY[role] ?? 0),
    );
  }
}
