import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Centralized session management service.
 * All credential-changing operations (password change, password reset, MFA enable,
 * email change, admin revocation) should use this service to invalidate sessions.
 *
 * ADR: docs/adr/0010-session-manager-abstraction.md
 * Finding: A5-001 — changePassword did not invalidate refresh tokens
 */
@Injectable()
export class SessionManager {
  private readonly logger = new Logger(SessionManager.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Invalidate all refresh tokens for a user, effectively logging them out
   * of all devices. This should be called after any credential-changing operation.
   *
   * @param userId - The user whose sessions to invalidate
   * @returns The number of tokens deleted
   */
  async invalidateAllSessions(userId: string): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    if (result.count > 0) {
      this.logger.log(
        `Invalidated ${result.count} session(s) for user ${userId}`,
      );
    }

    return result.count;
  }

  /**
   * Invalidate a single refresh token (e.g., on logout from one device).
   *
   * @param token - The specific refresh token to invalidate
   * @returns Whether the token was found and deleted
   */
  async invalidateToken(token: string): Promise<boolean> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { token },
    });
    return result.count > 0;
  }
}
