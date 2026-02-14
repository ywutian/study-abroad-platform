import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OWNER_KEY, OwnerMetadata } from '../decorators/owner-only.decorator';

/**
 * Guard that verifies the requesting user owns the target resource.
 * Admins bypass the ownership check.
 *
 * Usage: Apply @OwnerOnly({ model: 'admissionCase' }) on a controller method.
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  private readonly logger = new Logger(OwnershipGuard.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<OwnerMetadata>(
      OWNER_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Admins bypass ownership checks
    if (user.role === Role.ADMIN) {
      return true;
    }

    const { model, idParam = 'id', userField = 'userId' } = metadata;
    const resourceId = request.params[idParam];

    if (!resourceId) {
      this.logger.warn(
        `OwnershipGuard: param "${idParam}" not found in request`,
      );
      return false;
    }

    const prismaModel = (this.prisma as unknown as Record<string, unknown>)[
      model
    ];
    if (
      !prismaModel ||
      typeof (prismaModel as Record<string, unknown>).findUnique !== 'function'
    ) {
      this.logger.error(`OwnershipGuard: model "${model}" not found in Prisma`);
      return false;
    }

    const resource = await (
      prismaModel as {
        findUnique: (
          args: Record<string, unknown>,
        ) => Promise<Record<string, unknown> | null>;
      }
    ).findUnique({
      where: { id: resourceId },
      select: { [userField]: true },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    if (resource[userField] !== user.id) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    return true;
  }
}
