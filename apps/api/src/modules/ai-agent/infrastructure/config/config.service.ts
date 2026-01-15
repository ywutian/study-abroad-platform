/**
 * Agent 配置服务
 *
 * 支持:
 * - 配置热更新
 * - 多环境配置
 * - A/B 测试
 * - 配置持久化（数据库）
 * - 版本历史和回滚
 */

import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AgentType } from '../../types';

// ==================== Agent 配置类型 ====================

export interface AgentConfig {
  type: AgentType;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  canDelegate: AgentType[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enabled: boolean;
  version: string;
}

export interface ToolConfig {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: string;
  timeout?: number;
  retryable?: boolean;
  enabled: boolean;
}

export interface SystemConfig {
  // LLM 配置
  llm: {
    defaultModel: string;
    fallbackModel: string;
    maxRetries: number;
    timeoutMs: number;
  };

  // 限流配置
  rateLimit: {
    user: { windowMs: number; maxRequests: number };
    vip: { windowMs: number; maxRequests: number };
  };

  // 配额配置
  quota: {
    daily: { tokens: number; cost: number };
    monthly: { tokens: number; cost: number };
  };

  // 记忆配置
  memory: {
    maxConversationLength: number;
    maxMemoryAge: number; // days
    embeddingEnabled: boolean;
  };

  // 功能开关
  features: {
    fastRouting: boolean;
    memoryEnhancement: boolean;
    streamingEnabled: boolean;
    abTestEnabled: boolean;
  };
}

export interface FullConfig {
  agents: Record<AgentType, AgentConfig>;
  tools: Record<string, ToolConfig>;
  system: SystemConfig;
  version: string;
  updatedAt: Date;
}

// ==================== 配置事件 ====================

export const CONFIG_UPDATED_EVENT = 'agent.config.updated';
export const AGENT_CONFIG_UPDATED_EVENT = 'agent.config.agent.updated';
export const TOOL_CONFIG_UPDATED_EVENT = 'agent.config.tool.updated';

// ==================== 服务实现 ====================

@Injectable()
export class AgentConfigService implements OnModuleInit {
  private readonly logger = new Logger(AgentConfigService.name);

  private config: FullConfig;
  private configVersion = 0;

  // A/B 测试配置
  private abTestGroups: Map<string, Map<string, any>> = new Map();

  constructor(
    private nestConfig: NestConfigService,
    private eventEmitter: EventEmitter2,
    @Optional() private prisma?: PrismaService,
  ) {
    this.config = this.loadDefaultConfig();
  }

  async onModuleInit() {
    // 从数据库加载持久化配置
    await this.loadFromDatabase();
    this.logger.log(
      `Agent config initialized, version: ${this.config.version}`,
    );
  }

  // ==================== 持久化方法 ====================

  /**
   * 从数据库加载配置
   */
  private async loadFromDatabase(): Promise<void> {
    if (!this.prisma) {
      this.logger.debug('Prisma not available, using default config');
      return;
    }

    try {
      // 加载活跃的 Agent 配置
      const agentConfigs = await this.prisma.agentConfigVersion.findMany({
        where: { configType: 'agent', isActive: true },
      });

      for (const cfg of agentConfigs) {
        const agentType = cfg.configKey as AgentType;
        if (this.config.agents[agentType]) {
          const value = cfg.value as Prisma.JsonObject;
          this.config.agents[agentType] = {
            ...this.config.agents[agentType],
            ...(value as unknown as Partial<AgentConfig>),
            version: cfg.version.toString(),
          };
          this.logger.debug(
            `Loaded agent config: ${agentType} v${cfg.version}`,
          );
        }
      }

      // 加载活跃的工具配置
      const toolConfigs = await this.prisma.agentConfigVersion.findMany({
        where: { configType: 'tool', isActive: true },
      });

      for (const cfg of toolConfigs) {
        if (this.config.tools[cfg.configKey]) {
          const value = cfg.value as Prisma.JsonObject;
          this.config.tools[cfg.configKey] = {
            ...this.config.tools[cfg.configKey],
            ...(value as unknown as Partial<ToolConfig>),
          };
          this.logger.debug(
            `Loaded tool config: ${cfg.configKey} v${cfg.version}`,
          );
        }
      }

      // 加载系统配置
      const systemConfig = await this.prisma.agentConfigVersion.findFirst({
        where: { configType: 'system', configKey: 'main', isActive: true },
      });

      if (systemConfig) {
        const value = systemConfig.value as Prisma.JsonObject;
        this.config.system = this.deepMerge(
          this.config.system,
          value as unknown as Partial<SystemConfig>,
        );
        this.logger.debug(`Loaded system config v${systemConfig.version}`);
      }

      this.logger.log('Loaded config from database');
    } catch (error) {
      this.logger.warn(`Failed to load config from database: ${error}`);
    }
  }

  /**
   * 持久化 Agent 配置到数据库
   */
  private async persistAgentConfig(
    agentType: AgentType,
    config: AgentConfig,
    options?: { createdBy?: string; comment?: string },
  ): Promise<void> {
    if (!this.prisma) return;

    try {
      const newVersion = parseInt(config.version);

      await this.prisma.$transaction(async (tx) => {
        // 将旧版本设为非活跃
        await tx.agentConfigVersion.updateMany({
          where: { configType: 'agent', configKey: agentType, isActive: true },
          data: { isActive: false },
        });

        // 创建新版本
        await tx.agentConfigVersion.create({
          data: {
            configType: 'agent',
            configKey: agentType,
            version: newVersion,
            value: config as unknown as Prisma.JsonObject,
            isActive: true,
            createdBy: options?.createdBy,
            comment: options?.comment,
          },
        });
      });

      this.logger.log(`Persisted agent config: ${agentType} v${newVersion}`);
    } catch (error) {
      this.logger.error(`Failed to persist agent config: ${error}`);
    }
  }

  /**
   * 持久化系统配置到数据库
   */
  private async persistSystemConfig(
    config: SystemConfig,
    options?: { createdBy?: string; comment?: string },
  ): Promise<void> {
    if (!this.prisma) return;

    try {
      const newVersion = this.configVersion;

      await this.prisma.$transaction(async (tx) => {
        // 将旧版本设为非活跃
        await tx.agentConfigVersion.updateMany({
          where: { configType: 'system', configKey: 'main', isActive: true },
          data: { isActive: false },
        });

        // 创建新版本
        await tx.agentConfigVersion.create({
          data: {
            configType: 'system',
            configKey: 'main',
            version: newVersion,
            value: config as unknown as Prisma.JsonObject,
            isActive: true,
            createdBy: options?.createdBy,
            comment: options?.comment,
          },
        });
      });

      this.logger.log(`Persisted system config v${newVersion}`);
    } catch (error) {
      this.logger.error(`Failed to persist system config: ${error}`);
    }
  }

  /**
   * 回滚 Agent 配置到指定版本
   */
  async rollbackAgentConfig(
    agentType: AgentType,
    toVersion: number,
    options?: { createdBy?: string },
  ): Promise<AgentConfig> {
    if (!this.prisma) {
      throw new Error('Database not available for rollback');
    }

    const targetConfig = await this.prisma.agentConfigVersion.findFirst({
      where: { configType: 'agent', configKey: agentType, version: toVersion },
    });

    if (!targetConfig) {
      throw new Error(`Version ${toVersion} not found for agent ${agentType}`);
    }

    const value = targetConfig.value as Prisma.JsonObject;
    return this.updateAgentConfigWithPersistence(
      agentType,
      value as unknown as Partial<AgentConfig>,
      {
        createdBy: options?.createdBy,
        comment: `Rollback to version ${toVersion}`,
      },
    );
  }

  /**
   * 获取配置历史
   */
  async getConfigHistory(
    configType: 'agent' | 'tool' | 'system',
    configKey: string,
    limit = 10,
  ): Promise<
    Array<{
      version: number;
      createdAt: Date;
      comment: string | null;
      createdBy: string | null;
    }>
  > {
    if (!this.prisma) {
      return [];
    }

    const versions = await this.prisma.agentConfigVersion.findMany({
      where: { configType, configKey },
      orderBy: { version: 'desc' },
      take: limit,
      select: {
        version: true,
        createdAt: true,
        comment: true,
        createdBy: true,
      },
    });

    return versions;
  }

  /**
   * 获取指定版本的配置
   */
  async getConfigVersion<T>(
    configType: 'agent' | 'tool' | 'system',
    configKey: string,
    version: number,
  ): Promise<T | null> {
    if (!this.prisma) {
      return null;
    }

    const config = await this.prisma.agentConfigVersion.findFirst({
      where: { configType, configKey, version },
    });

    if (!config) return null;
    return config.value as unknown as T;
  }

  // ==================== 配置获取 ====================

  getAgentConfig(agentType: AgentType): AgentConfig {
    return this.config.agents[agentType];
  }

  getAllAgentConfigs(): Record<AgentType, AgentConfig> {
    return { ...this.config.agents };
  }

  getToolConfig(toolName: string): ToolConfig | undefined {
    return this.config.tools[toolName];
  }

  getAllToolConfigs(): Record<string, ToolConfig> {
    return { ...this.config.tools };
  }

  getSystemConfig(): SystemConfig {
    return { ...this.config.system };
  }

  getFullConfig(): FullConfig {
    return { ...this.config };
  }

  // ==================== 配置更新 ====================

  /**
   * 更新 Agent 配置（不持久化）
   */
  updateAgentConfig(
    agentType: AgentType,
    updates: Partial<AgentConfig>,
  ): AgentConfig {
    const current = this.config.agents[agentType];
    if (!current) {
      throw new Error(`Agent ${agentType} not found`);
    }

    const updated: AgentConfig = {
      ...current,
      ...updates,
      version: `${parseInt(current.version) + 1}`,
    };

    this.config.agents[agentType] = updated;
    this.config.updatedAt = new Date();
    this.configVersion++;

    this.logger.log(
      `Agent ${agentType} config updated to version ${updated.version}`,
    );
    this.eventEmitter.emit(AGENT_CONFIG_UPDATED_EVENT, {
      agentType,
      config: updated,
    });

    return updated;
  }

  /**
   * 更新 Agent 配置并持久化到数据库
   */
  async updateAgentConfigWithPersistence(
    agentType: AgentType,
    updates: Partial<AgentConfig>,
    options?: { createdBy?: string; comment?: string },
  ): Promise<AgentConfig> {
    const updated = this.updateAgentConfig(agentType, updates);
    await this.persistAgentConfig(agentType, updated, options);
    return updated;
  }

  updateToolConfig(toolName: string, updates: Partial<ToolConfig>): ToolConfig {
    const current = this.config.tools[toolName];
    if (!current) {
      throw new Error(`Tool ${toolName} not found`);
    }

    const updated: ToolConfig = { ...current, ...updates };
    this.config.tools[toolName] = updated;
    this.config.updatedAt = new Date();
    this.configVersion++;

    this.logger.log(`Tool ${toolName} config updated`);
    this.eventEmitter.emit(TOOL_CONFIG_UPDATED_EVENT, {
      toolName,
      config: updated,
    });

    return updated;
  }

  updateSystemConfig(updates: Partial<SystemConfig>): SystemConfig {
    this.config.system = this.deepMerge(this.config.system, updates);
    this.config.updatedAt = new Date();
    this.configVersion++;

    this.logger.log('System config updated');
    this.eventEmitter.emit(CONFIG_UPDATED_EVENT, {
      system: this.config.system,
    });

    return this.config.system;
  }

  /**
   * 更新系统配置并持久化到数据库
   */
  async updateSystemConfigWithPersistence(
    updates: Partial<SystemConfig>,
    options?: { createdBy?: string; comment?: string },
  ): Promise<SystemConfig> {
    const updated = this.updateSystemConfig(updates);
    await this.persistSystemConfig(updated, options);
    return updated;
  }

  // ==================== A/B 测试 ====================

  setAbTestConfig(testName: string, userId: string, config: any): void {
    if (!this.abTestGroups.has(testName)) {
      this.abTestGroups.set(testName, new Map());
    }
    this.abTestGroups.get(testName)!.set(userId, config);
  }

  getAbTestConfig<T>(testName: string, userId: string, defaultValue: T): T {
    const testGroup = this.abTestGroups.get(testName);
    if (!testGroup) return defaultValue;
    return testGroup.get(userId) ?? defaultValue;
  }

  assignAbTestGroup(
    testName: string,
    userId: string,
    groups: string[],
  ): string {
    // 简单哈希分组
    const hash = this.simpleHash(userId);
    const groupIndex = hash % groups.length;
    return groups[groupIndex];
  }

  // ==================== 功能开关 ====================

  isFeatureEnabled(feature: keyof SystemConfig['features']): boolean {
    return this.config.system.features[feature] ?? false;
  }

  toggleFeature(
    feature: keyof SystemConfig['features'],
    enabled: boolean,
  ): void {
    this.config.system.features[feature] = enabled;
    this.config.updatedAt = new Date();
    this.configVersion++;

    this.logger.log(`Feature ${feature} ${enabled ? 'enabled' : 'disabled'}`);
    this.eventEmitter.emit(CONFIG_UPDATED_EVENT, { feature, enabled });
  }

  // ==================== 私有方法 ====================

  private loadDefaultConfig(): FullConfig {
    return {
      agents: this.getDefaultAgentConfigs(),
      tools: this.getDefaultToolConfigs(),
      system: this.getDefaultSystemConfig(),
      version: '1.0.0',
      updatedAt: new Date(),
    };
  }

  private getDefaultAgentConfigs(): Record<AgentType, AgentConfig> {
    return {
      [AgentType.ORCHESTRATOR]: {
        type: AgentType.ORCHESTRATOR,
        name: '留学顾问',
        description: '主协调者，理解用户意图并分配给专业 Agent',
        systemPrompt: this.getOrchestratorPrompt(),
        tools: ['delegate_to_agent', 'get_user_context', 'search_knowledge'],
        canDelegate: [
          AgentType.ESSAY,
          AgentType.SCHOOL,
          AgentType.PROFILE,
          AgentType.TIMELINE,
        ],
        model: this.nestConfig.get('OPENAI_MODEL', 'gpt-4o-mini'),
        temperature: 0.7,
        maxTokens: 2000,
        enabled: true,
        version: '1',
      },
      [AgentType.ESSAY]: {
        type: AgentType.ESSAY,
        name: '文书专家',
        description: '专注于文书写作、评估、润色的专家',
        systemPrompt: this.getEssayAgentPrompt(),
        tools: [
          'get_profile',
          'get_essays',
          'get_school_essays',
          'review_essay',
          'polish_essay',
          'generate_outline',
          'brainstorm_ideas',
          'continue_writing',
        ],
        canDelegate: [],
        temperature: 0.8,
        maxTokens: 4000,
        enabled: true,
        version: '1',
      },
      [AgentType.SCHOOL]: {
        type: AgentType.SCHOOL,
        name: '选校专家',
        description: '专注于学校推荐和匹配分析',
        systemPrompt: this.getSchoolAgentPrompt(),
        tools: [
          'get_profile',
          'search_schools',
          'get_school_details',
          'compare_schools',
          'get_school_essays',
          'get_deadlines',
          'recommend_schools',
          'analyze_admission',
        ],
        canDelegate: [],
        temperature: 0.6,
        maxTokens: 3000,
        enabled: true,
        version: '1',
      },
      [AgentType.PROFILE]: {
        type: AgentType.PROFILE,
        name: '档案分析专家',
        description: '分析用户背景和竞争力',
        systemPrompt: this.getProfileAgentPrompt(),
        tools: [
          'get_profile',
          'analyze_profile',
          'suggest_improvements',
          'get_admission_cases',
        ],
        canDelegate: [],
        temperature: 0.5,
        maxTokens: 2500,
        enabled: true,
        version: '1',
      },
      [AgentType.TIMELINE]: {
        type: AgentType.TIMELINE,
        name: '规划专家',
        description: '制定申请时间规划',
        systemPrompt: this.getTimelineAgentPrompt(),
        tools: [
          'get_profile',
          'get_deadlines',
          'create_timeline',
          'get_school_details',
        ],
        canDelegate: [],
        temperature: 0.4,
        maxTokens: 2000,
        enabled: true,
        version: '1',
      },
    };
  }

  private getDefaultToolConfigs(): Record<string, ToolConfig> {
    return {
      delegate_to_agent: {
        name: 'delegate_to_agent',
        description: '将任务委派给专业 Agent 处理',
        parameters: {
          type: 'object',
          properties: {
            agent: {
              type: 'string',
              enum: ['essay', 'school', 'profile', 'timeline'],
            },
            task: { type: 'string' },
            context: { type: 'string' },
          },
          required: ['agent', 'task'],
        },
        handler: 'orchestrator.delegate',
        timeout: 30000,
        retryable: false,
        enabled: true,
      },
      get_profile: {
        name: 'get_profile',
        description: '获取用户完整档案信息',
        parameters: { type: 'object', properties: {}, required: [] },
        handler: 'user.getProfile',
        timeout: 5000,
        retryable: true,
        enabled: true,
      },
      // ... 其他工具配置
    };
  }

  private getDefaultSystemConfig(): SystemConfig {
    return {
      llm: {
        defaultModel: this.nestConfig.get('OPENAI_MODEL', 'gpt-4o-mini'),
        fallbackModel: 'gpt-3.5-turbo',
        maxRetries: 3,
        timeoutMs: 30000,
      },
      rateLimit: {
        user: { windowMs: 60000, maxRequests: 10 },
        vip: { windowMs: 60000, maxRequests: 30 },
      },
      quota: {
        daily: { tokens: 100000, cost: 5.0 },
        monthly: { tokens: 2000000, cost: 100.0 },
      },
      memory: {
        maxConversationLength: 50,
        maxMemoryAge: 90,
        embeddingEnabled: true,
      },
      features: {
        fastRouting: true,
        memoryEnhancement: true,
        streamingEnabled: true,
        abTestEnabled: false,
      },
    };
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // ==================== Prompt 模板 ====================

  private getOrchestratorPrompt(): string {
    return `你是「留学申请助手」的主协调者。

你的职责是:
1. 理解用户的真实意图
2. 将任务分配给最合适的专业 Agent
3. 如果用户问题简单，直接回答

可用的专业 Agent:
- essay: 文书写作、润色、评估
- school: 选校、学校对比、录取分析
- profile: 背景分析、竞争力评估
- timeline: 时间规划、申请进度

委派原则:
- 明确的文书相关 → essay
- 选校/学校信息 → school
- 背景/竞争力分析 → profile
- 时间/规划相关 → timeline
- 简单问候/闲聊 → 直接回复

始终使用中文回复。`;
  }

  private getEssayAgentPrompt(): string {
    return `你是专业的留学文书顾问，专注于美本申请文书。

你的能力:
- 评估文书质量和改进建议
- 润色文书表达和结构
- 生成文书大纲和思路
- 头脑风暴挖掘素材
- 续写和补充内容

写作原则:
- 展现个人特质，避免套话
- 用具体故事代替抽象描述
- 保持真实，不虚构经历
- 注意字数限制

始终使用中文回复。`;
  }

  private getSchoolAgentPrompt(): string {
    return `你是专业的美本选校顾问。

你的能力:
- 根据背景推荐匹配学校
- 分析录取概率
- 对比不同学校
- 提供学校详细信息
- 解答招生政策问题

选校原则:
- 结合学术和课外背景
- 考虑学生偏好
- 平衡冲刺/匹配/保底
- 关注项目适配度

始终使用中文回复。`;
  }

  private getProfileAgentPrompt(): string {
    return `你是专业的留学档案分析师。

你的能力:
- 全面分析申请档案
- 评估竞争力
- 识别优势和短板
- 提供提升建议
- 参考历史案例

分析维度:
- 学术成绩 (GPA, 标化)
- 课外活动质量
- 获奖经历
- 个人特质

始终使用中文回复。`;
  }

  private getTimelineAgentPrompt(): string {
    return `你是专业的申请规划师。

你的能力:
- 制定申请时间表
- 跟踪截止日期
- 规划准备进度
- 提醒重要节点

规划原则:
- 预留充足准备时间
- 考虑多所学校并行
- 标化考试优先
- 文书提前准备

始终使用中文回复。`;
  }
}
