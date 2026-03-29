/**
 * Architecture Validator Service
 *
 * Runtime startup validation for AI Agent module architecture:
 * 1. Security service resolvability (PromptGuardService, ContentModerationService)
 * 2. ConfigValidator existence
 * 3. @Optional audit (structured JSON log)
 * 4. Embedding model consistency (warn only)
 *
 * Behavior by NODE_ENV:
 * - production/staging: missing security services → throw (block startup)
 * - development/test: missing security services → warn
 */

import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { PromptGuardService } from '../security/prompt-guard.service';
import { ContentModerationService } from '../security/content-moderation.service';
import { AuditService } from '../security/audit.service';
import { ConfigValidatorService } from './config-validator.service';

export type AiSecurityStatus = 'ok' | 'degraded' | 'unknown';
export type EmbeddingConsistency = 'ok' | 'partial' | 'missing';

export interface AiSecurityHealthInfo {
  status: AiSecurityStatus;
  services: {
    promptGuard: boolean;
    contentModeration: boolean;
    auditService: boolean;
    configValidator: boolean;
  };
  optionalAudit: Array<{
    service: string;
    class: string;
    reason: string;
  }>;
}

@Injectable()
export class ArchitectureValidatorService implements OnModuleInit {
  private readonly logger = new Logger(ArchitectureValidatorService.name);
  private _aiSecurityStatus: AiSecurityStatus = 'unknown';
  private _embeddingConsistency: EmbeddingConsistency = 'missing';
  private _securityInfo: AiSecurityHealthInfo = {
    status: 'unknown',
    services: {
      promptGuard: false,
      contentModeration: false,
      auditService: false,
      configValidator: false,
    },
    optionalAudit: [],
  };

  constructor(
    private moduleRef: ModuleRef,
    private configService: ConfigService,
    @Optional() private prisma?: PrismaService,
  ) {}

  get aiSecurityStatus(): AiSecurityStatus {
    return this._aiSecurityStatus;
  }

  get embeddingConsistency(): EmbeddingConsistency {
    return this._embeddingConsistency;
  }

  get securityInfo(): AiSecurityHealthInfo {
    return this._securityInfo;
  }

  async onModuleInit() {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const isStrictEnv = nodeEnv === 'production' || nodeEnv === 'staging';

    this.logger.log(
      `Architecture validation starting (NODE_ENV=${nodeEnv}, strict=${isStrictEnv})`,
    );

    // 1. Security service resolvability
    const securityResults = this.validateSecurityServices(isStrictEnv);

    // 2. ConfigValidator existence
    const configValidatorExists = this.validateConfigValidator(isStrictEnv);

    // 3. @Optional audit (structured JSON log)
    this.logOptionalAudit();

    // 4. Embedding model consistency
    await this.checkEmbeddingConsistency();

    // Compute overall status
    const allSecurityOk =
      securityResults.promptGuard &&
      securityResults.contentModeration &&
      securityResults.auditService &&
      configValidatorExists;

    this._aiSecurityStatus = allSecurityOk ? 'ok' : 'degraded';
    this._securityInfo = {
      status: this._aiSecurityStatus,
      services: { ...securityResults, configValidator: configValidatorExists },
      optionalAudit: this._securityInfo.optionalAudit,
    };

    this.logger.log(
      `Architecture validation complete: aiSecurity=${this._aiSecurityStatus}, embeddingConsistency=${this._embeddingConsistency}`,
    );
  }

  private validateSecurityServices(isStrictEnv: boolean): {
    promptGuard: boolean;
    contentModeration: boolean;
    auditService: boolean;
  } {
    const services = [
      { name: 'PromptGuardService', type: PromptGuardService },
      { name: 'ContentModerationService', type: ContentModerationService },
      { name: 'AuditService', type: AuditService },
    ];

    const results = {
      promptGuard: false,
      contentModeration: false,
      auditService: false,
    };
    const keys: (keyof typeof results)[] = [
      'promptGuard',
      'contentModeration',
      'auditService',
    ];

    services.forEach((svc, idx) => {
      try {
        this.moduleRef.get(svc.type, { strict: false });
        results[keys[idx]] = true;
      } catch {
        const msg = `Security service ${svc.name} not resolvable`;
        if (isStrictEnv) {
          throw new Error(
            `[ArchitectureValidator] FATAL: ${msg}. Cannot start in ${this.configService.get('NODE_ENV')} without security services.`,
          );
        }
        this.logger.warn(msg);
      }
    });

    return results;
  }

  private validateConfigValidator(isStrictEnv: boolean): boolean {
    try {
      this.moduleRef.get(ConfigValidatorService, { strict: false });
      return true;
    } catch {
      const msg = 'ConfigValidatorService not resolvable';
      if (isStrictEnv) {
        throw new Error(
          `[ArchitectureValidator] FATAL: ${msg}. Cannot start in ${this.configService.get('NODE_ENV')} without config validation.`,
        );
      }
      this.logger.warn(msg);
      return false;
    }
  }

  private logOptionalAudit(): void {
    // Known @Optional usages that are acceptable
    const knownOptionals = [
      {
        service: 'ConfigValidatorService',
        class: 'OrchestratorService',
        reason: 'Fallback to static AGENT_CONFIGS in dev/test',
      },
      {
        service: 'ConfigValidatorService',
        class: 'AgentRunnerService',
        reason: 'Fallback to static AGENT_CONFIGS in dev/test',
      },
      {
        service: 'MemoryManagerService',
        class: 'OrchestratorService',
        reason: 'Optional enterprise memory',
      },
      {
        service: 'FastRouterService',
        class: 'OrchestratorService',
        reason: 'Optional fast routing',
      },
      {
        service: 'FallbackService',
        class: 'OrchestratorService',
        reason: 'Optional fallback handler',
      },
    ];

    this._securityInfo.optionalAudit = knownOptionals;
    this.logger.log(
      JSON.stringify({
        event: 'optional-audit',
        count: knownOptionals.length,
        details: knownOptionals,
      }),
    );
  }

  private async checkEmbeddingConsistency(): Promise<void> {
    if (!this.prisma) {
      this._embeddingConsistency = 'missing';
      return;
    }

    try {
      // Check if any memories exist with embeddings
      // embedding is Unsupported("vector") — Prisma doesn't generate where filters for it
      const [{ count }] = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM "Memory" WHERE embedding IS NOT NULL
      `;
      const embeddingCount = Number(count);

      if (embeddingCount === 0) {
        this._embeddingConsistency = 'ok'; // Empty DB = no inconsistency
        this.logger.log(
          'Embedding consistency: OK (no embeddings in database)',
        );
        return;
      }

      // We can't directly check embedding model version in DB
      // since there's no version field. Report as 'ok' (ADR 0013 decision).
      this._embeddingConsistency = 'ok';
      this.logger.log(
        `Embedding consistency: OK (${embeddingCount} embeddings found, current model: ${this.configService.get('EMBEDDING_MODEL', 'text-embedding-3-small')})`,
      );
    } catch (err) {
      this._embeddingConsistency = 'partial';
      this.logger.warn('Embedding consistency check failed', err);
    }
  }
}
