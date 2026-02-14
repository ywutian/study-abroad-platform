import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    @Inject(PrismaService) private prisma: PrismaService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Run passport JWT validation first
    const result = await (super.canActivate(context) as Promise<boolean>);
    if (!result) return false;

    // After JWT is validated, check if user is banned
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (user?.id) {
      await this.checkBanStatus(user.id);
    }

    return true;
  }

  handleRequest<TUser = unknown>(err: Error | null, user: TUser): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }

  /**
   * Check if user is banned; auto-unban if ban has expired
   */
  private async checkBanStatus(userId: string): Promise<void> {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isBanned: true, bannedUntil: true, banReason: true },
    });

    if (!dbUser?.isBanned) return;

    // Auto-unban if ban has expired
    if (dbUser.bannedUntil && new Date() > dbUser.bannedUntil) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: false,
          bannedAt: null,
          bannedUntil: null,
          banReason: null,
        },
      });
      return;
    }

    const message = dbUser.bannedUntil
      ? `Account banned until ${dbUser.bannedUntil.toISOString()}. Reason: ${dbUser.banReason || 'No reason provided'}`
      : `Account permanently banned. Reason: ${dbUser.banReason || 'No reason provided'}`;
    throw new ForbiddenException(message);
  }
}
