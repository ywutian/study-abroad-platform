import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentHarnessOperationsService } from '../core/agent-harness-operations.service';
import { UserDataService } from '../memory/user-data.service';

const SEMANTIC_SYNTHETIC_EMAIL =
  /^agent-semantic-\d{14}-r(?:[1-9]|10)-s(?:[1-9]|[1-9]\d)@example\.invalid$/;

export function isSemanticSyntheticEmail(email: string): boolean {
  return SEMANTIC_SYNTHETIC_EMAIL.test(email);
}

@Injectable()
export class AgentSemanticSyntheticAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userData: UserDataService,
    private readonly harnessOperations: AgentHarnessOperationsService,
  ) {}

  async cleanup(input: {
    adminId: string;
    targetUserId: string;
    expectedEmail: string;
  }): Promise<{
    cleaned: true;
    userHash: string;
    refreshTokensRevoked: number;
    cleared: {
      memories: number;
      conversations: number;
      entities: number;
    };
  }> {
    if (!this.harnessOperations.isAcceptanceEnabled()) {
      throw new ForbiddenException('Agent Harness acceptance is disabled');
    }
    if (!isSemanticSyntheticEmail(input.expectedEmail)) {
      throw new BadRequestException('Synthetic target not found');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: input.targetUserId },
      select: { id: true, email: true },
    });
    if (!target || target.email !== input.expectedEmail) {
      throw new BadRequestException('Synthetic target not found');
    }

    const deactivatedAt = new Date();
    const deactivated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: target.id, email: input.expectedEmail },
        data: { deletedAt: deactivatedAt },
      });
      if (updated.count !== 1) return null;
      const revoked = await tx.refreshToken.deleteMany({
        where: { userId: target.id },
      });
      return revoked.count;
    });
    if (deactivated === null) {
      throw new ServiceUnavailableException('Synthetic target changed');
    }

    const result = await this.userData.clearData(target.id, {
      clearMemories: true,
      clearConversations: true,
      clearEntities: true,
      resetPreferences: false,
    });
    const userHash = this.fingerprint(target.id);

    await this.prisma.$transaction(async (tx) => {
      const anonymized = await tx.user.updateMany({
        where: {
          id: target.id,
          email: input.expectedEmail,
          deletedAt: deactivatedAt,
        },
        data: {
          email: `deleted_semantic_${userHash}@deleted.local`,
          passwordHash: 'DELETED',
        },
      });
      if (anonymized.count !== 1) {
        throw new ServiceUnavailableException('Synthetic cleanup conflict');
      }
      await tx.auditLog.create({
        data: {
          userId: input.adminId,
          action: 'AI_AGENT_SEMANTIC_SYNTHETIC_ACCOUNT_CLEANED',
          resource: 'agent_semantic_evaluation',
          resourceId: userHash,
          metadata: {
            memories: result.cleared.memories,
            conversations: result.cleared.conversations,
            entities: result.cleared.entities,
            refreshTokensRevoked: deactivated,
          },
        },
      });
    });

    return {
      cleaned: true,
      userHash,
      refreshTokensRevoked: deactivated,
      cleared: {
        memories: result.cleared.memories,
        conversations: result.cleared.conversations,
        entities: result.cleared.entities,
      },
    };
  }

  private fingerprint(value: string): string {
    return createHash('sha256').update(value).digest('hex').slice(0, 16);
  }
}
