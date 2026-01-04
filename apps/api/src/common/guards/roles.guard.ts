import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

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

    // ADMIN has access to everything
    if (user.role === Role.ADMIN) {
      return true;
    }

    // VERIFIED has access to USER + VERIFIED
    if (user.role === Role.VERIFIED) {
      return requiredRoles.some((role) => role === Role.USER || role === Role.VERIFIED);
    }

    // USER only has access to USER
    return requiredRoles.includes(user.role);
  }
}

