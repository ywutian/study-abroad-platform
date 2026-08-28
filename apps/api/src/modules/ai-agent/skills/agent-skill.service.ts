import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AgentSkillDeploymentStatus,
  AgentSkillEvaluationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentType } from '../types';
import { AgentSkillPolicyService } from './agent-skill-policy.service';
import {
  AgentSkillCandidatePatch,
  AgentSkillSource,
  DeclarativeAgentSkill,
  ResolvedAgentSkill,
} from './agent-skill.types';

@Injectable()
export class AgentSkillService implements OnModuleInit {
  private readonly logger = new Logger(AgentSkillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly policy: AgentSkillPolicyService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled()) return;
    for (const agentType of Object.values(AgentType)) {
      await this.ensureBootstrapVersion(agentType);
    }
  }

  isEnabled(): boolean {
    return this.config.get<string>('AI_AGENT_SKILLS_V1') === 'true';
  }

  isEvolutionEnabled(): boolean {
    return (
      this.isEnabled() &&
      this.config.get<string>('AI_AGENT_SKILLS_EVOLUTION_V1') === 'true'
    );
  }

  isAutoPublishEnabled(): boolean {
    return (
      this.isEvolutionEnabled() &&
      this.config.get<string>('AI_AGENT_SKILLS_AUTO_PUBLISH_V1') === 'true'
    );
  }

  // governance: system-scope — deployment pointers are global Agent configuration.
  async getActiveVersionId(agentType: AgentType): Promise<string | undefined> {
    if (!this.isEnabled()) return undefined;
    const deployment = await this.prisma.agentSkillDeployment.findUnique({
      where: { agentType },
      select: { activeVersionId: true },
    });
    return deployment?.activeVersionId;
  }

  // governance: parent-scoped — runId is created or ownership-checked by AgentRunService.
  async resolveForRun(
    agentType: AgentType,
    runId?: string,
  ): Promise<ResolvedAgentSkill> {
    if (!this.isEnabled())
      return { config: this.policy.getBaseConfig(agentType) };

    const pinned = runId
      ? await this.prisma.agentRun.findUnique({
          where: { id: runId },
          select: { skillVersionId: true },
        })
      : undefined;
    const versionId =
      pinned?.skillVersionId ?? (await this.getActiveVersionId(agentType));
    if (!versionId) return { config: this.policy.getBaseConfig(agentType) };
    return this.resolveVersion(agentType, versionId);
  }

  // governance: system-scope — immutable Skill versions are global configuration.
  async resolveVersion(
    agentType: AgentType,
    versionId: string,
  ): Promise<ResolvedAgentSkill> {
    const row = await this.prisma.agentConfigVersion.findFirst({
      where: {
        id: versionId,
        configType: 'skill',
        configKey: agentType,
      },
    });
    if (!row) throw new NotFoundException('Skill version not found');
    const skill = this.policy.validate(
      this.fromJson<DeclarativeAgentSkill>(row.value),
    );
    return {
      config: this.policy.apply(this.policy.getBaseConfig(agentType), skill),
      versionId: row.id,
      version: row.version,
      contentHash: row.contentHash ?? undefined,
    };
  }

  // governance: system-scope — immutable Skill versions are global configuration.
  async createCandidate(input: {
    agentType: AgentType;
    parentVersionId?: string;
    patch: AgentSkillCandidatePatch;
    source: AgentSkillSource;
    reason: string;
    createdBy?: string;
  }) {
    if (!this.isEnabled()) {
      throw new ConflictException('Declarative Skills are disabled');
    }
    const parentId =
      input.parentVersionId ?? (await this.getActiveVersionId(input.agentType));
    if (!parentId)
      throw new NotFoundException('Active Skill version not found');
    const parent = await this.prisma.agentConfigVersion.findFirst({
      where: {
        id: parentId,
        configType: 'skill',
        configKey: input.agentType,
      },
    });
    if (!parent) throw new NotFoundException('Parent Skill version not found');

    const parentSkill = this.policy.validate(
      this.fromJson<DeclarativeAgentSkill>(parent.value),
    );
    const candidate = this.policy.mergeCandidate(parentSkill, input.patch);
    const contentHash = this.policy.hash(candidate);
    const existing = await this.prisma.agentConfigVersion.findFirst({
      where: { configType: 'skill', configKey: input.agentType, contentHash },
    });
    if (existing) return existing;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const latest = await tx.agentConfigVersion.findFirst({
            where: { configType: 'skill', configKey: input.agentType },
            orderBy: { version: 'desc' },
            select: { version: true },
          });
          const row = await tx.agentConfigVersion.create({
            data: {
              configType: 'skill',
              configKey: input.agentType,
              version: (latest?.version ?? 0) + 1,
              value: this.toJson(candidate),
              schemaVersion: candidate.schemaVersion,
              parentVersionId: parent.id,
              contentHash,
              source: input.source,
              changeReason: input.reason,
              createdBy: input.createdBy,
              comment: input.reason.slice(0, 500),
            },
          });
          await tx.agentSkillAudit.create({
            data: {
              agentType: input.agentType,
              action: 'CANDIDATE_CREATED',
              versionId: row.id,
              actor: input.createdBy ?? input.source,
              reason: input.reason,
              metadata: this.toJson({
                parentVersionId: parent.id,
                contentHash,
              }),
            },
          });
          return row;
        });
        return created;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException('Could not allocate Skill version');
  }

  // governance: system-scope — validation reads global configuration and writes nothing.
  async validateCandidate(input: {
    agentType: AgentType;
    parentVersionId?: string;
    patch: AgentSkillCandidatePatch;
  }) {
    if (!this.isEnabled()) {
      throw new ConflictException('Declarative Skills are disabled');
    }
    const parentId =
      input.parentVersionId ?? (await this.getActiveVersionId(input.agentType));
    if (!parentId)
      throw new NotFoundException('Active Skill version not found');
    const parent = await this.prisma.agentConfigVersion.findFirst({
      where: {
        id: parentId,
        configType: 'skill',
        configKey: input.agentType,
      },
    });
    if (!parent) throw new NotFoundException('Parent Skill version not found');
    const parentSkill = this.policy.validate(
      this.fromJson<DeclarativeAgentSkill>(parent.value),
    );
    const candidate = this.policy.mergeCandidate(parentSkill, input.patch);
    return {
      valid: true,
      parentVersionId: parent.id,
      contentHash: this.policy.hash(candidate),
      allowedToolCount: candidate.allowedTools.length,
    };
  }

  // governance: system-scope — publish atomically changes a global configuration pointer.
  async publish(agentType: AgentType, versionId: string, actor: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await tx.agentSkillDeployment.findUnique({
          where: { agentType },
        });
        if (!current) {
          throw new ConflictException('Active Skill deployment is unavailable');
        }
        const evaluation = await tx.agentSkillEvaluation.findFirst({
          where: {
            agentType,
            baselineVersionId: current.activeVersionId,
            candidateVersionId: versionId,
            status: AgentSkillEvaluationStatus.PASSED,
            passed: true,
          },
          orderBy: { completedAt: 'desc' },
        });
        if (!evaluation) {
          throw new ConflictException(
            'Candidate has not passed the offline hard gates against the current baseline',
          );
        }
        const candidate = await tx.agentConfigVersion.findFirst({
          where: { id: versionId, configType: 'skill', configKey: agentType },
        });
        if (!candidate)
          throw new NotFoundException('Skill candidate not found');
        if (candidate.id === current.activeVersionId) {
          throw new ConflictException('Skill version is already active');
        }

        await tx.agentConfigVersion.updateMany({
          where: { configType: 'skill', configKey: agentType, isActive: true },
          data: { isActive: false },
        });
        await tx.agentConfigVersion.update({
          where: { id: candidate.id },
          data: { isActive: true },
        });
        const deployment = await tx.agentSkillDeployment.upsert({
          where: { agentType },
          create: {
            agentType,
            activeVersionId: candidate.id,
            previousVersionId: current.activeVersionId,
            status: AgentSkillDeploymentStatus.ACTIVE,
          },
          update: {
            activeVersionId: candidate.id,
            previousVersionId: current.activeVersionId,
            status: AgentSkillDeploymentStatus.ACTIVE,
            activatedAt: new Date(),
          },
        });
        await tx.agentSkillAudit.create({
          data: {
            agentType,
            action: 'PUBLISHED_100_PERCENT',
            versionId: candidate.id,
            actor,
            reason: 'Offline gates passed; active pointer switched atomically',
            metadata: this.toJson({
              evaluationId: evaluation.id,
              previousVersionId: current.activeVersionId,
            }),
          },
        });
        return deployment;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // governance: system-scope — rollback atomically changes a global configuration pointer.
  async rollback(
    agentType: AgentType,
    reason: string,
    actor: string,
    expected?: { versionId: string; activatedAt: Date },
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const current = await tx.agentSkillDeployment.findUnique({
          where: { agentType },
        });
        if (
          expected &&
          (!current ||
            current.status !== AgentSkillDeploymentStatus.ACTIVE ||
            current.activeVersionId !== expected.versionId ||
            current.activatedAt.getTime() !== expected.activatedAt.getTime())
        ) {
          return null;
        }
        if (!current?.previousVersionId) {
          throw new ConflictException('No previous Skill version is available');
        }
        const previous = await tx.agentConfigVersion.findFirst({
          where: {
            id: current.previousVersionId,
            configType: 'skill',
            configKey: agentType,
          },
        });
        if (!previous)
          throw new NotFoundException('Rollback Skill version not found');

        await tx.agentConfigVersion.updateMany({
          where: { configType: 'skill', configKey: agentType, isActive: true },
          data: { isActive: false },
        });
        await tx.agentConfigVersion.update({
          where: { id: previous.id },
          data: { isActive: true },
        });
        const deployment = await tx.agentSkillDeployment.update({
          where: { agentType },
          data: {
            activeVersionId: previous.id,
            previousVersionId: null,
            status: AgentSkillDeploymentStatus.ROLLED_BACK,
            activatedAt: new Date(),
          },
        });
        await tx.agentSkillAudit.create({
          data: {
            agentType,
            action: 'ROLLED_BACK',
            versionId: previous.id,
            actor,
            reason,
            metadata: this.toJson({ rolledBackFrom: current.activeVersionId }),
          },
        });
        return deployment;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // governance: admin-scope — caller is the ADMIN + AI_CONFIG controller only.
  async getStatus(agentType?: AgentType) {
    const where = agentType ? { agentType } : undefined;
    const [deployments, evaluations, signals, audits] = await Promise.all([
      this.prisma.agentSkillDeployment.findMany({
        where,
        orderBy: { agentType: 'asc' },
      }),
      this.prisma.agentSkillEvaluation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.agentSkillSignal.findMany({
        where,
        orderBy: { lastObservedAt: 'desc' },
        take: 50,
      }),
      this.prisma.agentSkillAudit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return {
      enabled: this.isEnabled(),
      evolutionEnabled: this.isEvolutionEnabled(),
      autoPublishEnabled: this.isAutoPublishEnabled(),
      deployments,
      evaluations,
      signals,
      audits,
    };
  }

  // governance: system-scope — bootstrap creates global configuration for each Agent type.
  private async ensureBootstrapVersion(agentType: AgentType): Promise<void> {
    const existing = await this.prisma.agentSkillDeployment.findUnique({
      where: { agentType },
    });
    if (existing) return;
    const skill = this.policy.bootstrap(agentType);
    const contentHash = this.policy.hash(skill);
    try {
      await this.prisma.$transaction(async (tx) => {
        const latest = await tx.agentConfigVersion.findFirst({
          where: { configType: 'skill', configKey: agentType },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        const row = await tx.agentConfigVersion.upsert({
          where: {
            configType_configKey_contentHash: {
              configType: 'skill',
              configKey: agentType,
              contentHash,
            },
          },
          create: {
            configType: 'skill',
            configKey: agentType,
            version: (latest?.version ?? 0) + 1,
            value: this.toJson(skill),
            isActive: true,
            contentHash,
            source: 'BOOTSTRAP',
            changeReason:
              'Code configuration captured as the immutable Skill baseline',
          },
          update: {},
        });
        await tx.agentConfigVersion.update({
          where: { id: row.id },
          data: { isActive: true },
        });
        await tx.agentSkillDeployment.upsert({
          where: { agentType },
          create: { agentType, activeVersionId: row.id },
          update: {},
        });
        await tx.agentSkillAudit.create({
          data: {
            agentType,
            action: 'BOOTSTRAPPED',
            versionId: row.id,
            actor: 'SYSTEM',
            reason: 'Initial declarative Skill baseline',
          },
        });
      });
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )) {
        throw error;
      }
      this.logger.debug(
        `Skill bootstrap already completed by another instance: ${agentType}`,
      );
    }
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private fromJson<T>(value: Prisma.JsonValue): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
