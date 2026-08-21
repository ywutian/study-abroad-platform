import {
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { AgentType } from '../../types';
import type { AgentConfig, SystemConfig } from './config.service';

export interface ConfigPersistenceOptions {
  createdBy?: string;
  comment?: string;
}

@Injectable()
export class AgentConfigPersistenceService {
  private readonly logger = new Logger(AgentConfigPersistenceService.name);

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async persistAgentConfig(
    agentType: AgentType,
    current: AgentConfig,
    updates: Partial<AgentConfig>,
    options?: ConfigPersistenceOptions,
  ): Promise<AgentConfig> {
    const prisma = this.requirePrisma();

    return this.withConflictRetry('agent config', async () => {
      const persisted = await prisma.$transaction(async (tx) => {
        const [active, latest] = await Promise.all([
          tx.agentConfigVersion.findFirst({
            where: {
              configType: 'agent',
              configKey: agentType,
              isActive: true,
            },
          }),
          tx.agentConfigVersion.findFirst({
            where: { configType: 'agent', configKey: agentType },
            orderBy: { version: 'desc' },
            select: { version: true },
          }),
        ]);
        const newVersion = (latest?.version ?? 0) + 1;
        const stored = active
          ? this.fromJson<Partial<AgentConfig>>(active.value)
          : {};
        const candidate: AgentConfig = {
          ...current,
          ...stored,
          ...updates,
          type: agentType,
          version: String(newVersion),
        };

        await tx.agentConfigVersion.updateMany({
          where: {
            configType: 'agent',
            configKey: agentType,
            isActive: true,
          },
          data: { isActive: false },
        });
        await tx.agentConfigVersion.create({
          data: {
            configType: 'agent',
            configKey: agentType,
            version: newVersion,
            value: this.toJson(candidate),
            isActive: true,
            createdBy: options?.createdBy,
            comment: options?.comment,
          },
        });
        return candidate;
      });

      this.logger.log(
        `Persisted agent config: ${agentType} v${persisted.version}`,
      );
      return persisted;
    });
  }

  async persistSystemConfig(
    current: SystemConfig,
    updates: Partial<SystemConfig>,
    options?: ConfigPersistenceOptions,
  ): Promise<SystemConfig> {
    const prisma = this.requirePrisma();

    return this.withConflictRetry('system config', async () => {
      const persisted = await prisma.$transaction(async (tx) => {
        const [active, latest] = await Promise.all([
          tx.agentConfigVersion.findFirst({
            where: {
              configType: 'system',
              configKey: 'main',
              isActive: true,
            },
          }),
          tx.agentConfigVersion.findFirst({
            where: { configType: 'system', configKey: 'main' },
            orderBy: { version: 'desc' },
            select: { version: true },
          }),
        ]);
        const base = active
          ? this.fromJson<SystemConfig>(active.value)
          : current;
        const candidate = this.deepMerge(base, updates);
        const newVersion = (latest?.version ?? 0) + 1;

        await tx.agentConfigVersion.updateMany({
          where: { configType: 'system', configKey: 'main', isActive: true },
          data: { isActive: false },
        });
        await tx.agentConfigVersion.create({
          data: {
            configType: 'system',
            configKey: 'main',
            version: newVersion,
            value: this.toJson(candidate),
            isActive: true,
            createdBy: options?.createdBy,
            comment: options?.comment,
          },
        });
        return candidate;
      });

      this.logger.log('Persisted system config');
      return persisted;
    });
  }

  private requirePrisma(): PrismaService {
    if (!this.prisma) {
      throw new InternalServerErrorException(
        'Database not available for configuration update',
      );
    }
    return this.prisma;
  }

  private async withConflictRetry<T>(
    label: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const conflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (conflict && attempt < 3) continue;
        this.logger.error(`Failed to persist ${label}: ${String(error)}`);
        throw error;
      }
    }
    throw new InternalServerErrorException('Configuration update failed');
  }

  private fromJson<T>(value: Prisma.JsonValue): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private toJson(value: object): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }

  private deepMerge<T extends object>(target: T, source: Partial<T>): T {
    const targetRecord = target as Record<string, unknown>;
    const sourceRecord = source as Record<string, unknown>;
    const result: Record<string, unknown> = { ...targetRecord };
    for (const key of Object.keys(sourceRecord)) {
      const sourceValue = sourceRecord[key];
      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue)
      ) {
        const targetValue = targetRecord[key];
        result[key] = this.deepMerge(
          typeof targetValue === 'object' && targetValue !== null
            ? (targetValue as Record<string, unknown>)
            : {},
          sourceValue,
        );
      } else {
        result[key] = sourceValue;
      }
    }
    return result as T;
  }
}
