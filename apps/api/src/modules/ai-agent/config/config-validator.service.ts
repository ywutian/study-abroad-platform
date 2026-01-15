/**
 * Agent 配置验证服务
 *
 * 企业级标准：
 * - 启动时验证所有 Agent 配置完整性
 * - 验证 Agent 工具是否都已注册
 * - 验证委派关系是否有效
 * - 提供运行时配置校验方法
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AGENT_CONFIGS } from './agents.config';
import { TOOLS, ToolName } from './tools.config';
import { AgentType, AgentConfig } from '../types';

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
}

export interface ConfigValidationError {
  agentType: AgentType;
  field: string;
  message: string;
}

export interface ConfigValidationWarning {
  agentType: AgentType;
  message: string;
}

@Injectable()
export class ConfigValidatorService implements OnModuleInit {
  private readonly logger = new Logger(ConfigValidatorService.name);
  private validationResult: ConfigValidationResult | null = null;

  // 已注册的工具名称集合
  private readonly registeredTools: Set<string>;

  constructor(private readonly configService: ConfigService) {
    this.registeredTools = new Set(TOOLS.map((t) => t.name));
  }

  /**
   * 模块初始化时验证配置
   */
  onModuleInit() {
    this.validationResult = this.validateAllConfigs();

    if (!this.validationResult.valid) {
      this.logger.error('Agent configuration validation failed!');
      this.validationResult.errors.forEach((err) => {
        this.logger.error(`  [${err.agentType}] ${err.field}: ${err.message}`);
      });

      // 在生产环境抛出错误阻止启动
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'Agent configuration validation failed. Check logs for details.',
        );
      }
    }

    if (this.validationResult.warnings.length > 0) {
      this.validationResult.warnings.forEach((warn) => {
        this.logger.warn(`  [${warn.agentType}] ${warn.message}`);
      });
    }

    this.logger.log(
      `Agent configuration validated: ${Object.keys(AGENT_CONFIGS).length} agents, ${this.registeredTools.size} tools`,
    );

    // 检查搜索引擎配置
    this.checkSearchEngineConfig();
  }

  /**
   * 检查搜索引擎 API Key 配置状态
   */
  private checkSearchEngineConfig(): void {
    const googleKey = this.configService.get<string>('GOOGLE_SEARCH_API_KEY');
    const googleCx = this.configService.get<string>('GOOGLE_SEARCH_ENGINE_ID');
    const tavilyKey = this.configService.get<string>('TAVILY_API_KEY');

    const googleEnabled = !!(googleKey && googleCx);
    const tavilyEnabled = !!tavilyKey;

    if (googleEnabled) {
      this.logger.log('Search engine: Google Custom Search - enabled');
    } else {
      this.logger.warn(
        'Search engine: Google Custom Search - disabled (missing GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_ENGINE_ID)',
      );
    }

    if (tavilyEnabled) {
      this.logger.log('Search engine: Tavily - enabled');
    } else {
      this.logger.warn(
        'Search engine: Tavily - disabled (missing TAVILY_API_KEY)',
      );
    }

    if (!googleEnabled && !tavilyEnabled) {
      this.logger.warn(
        'No search engines configured. web_search and search_school_website tools will be unavailable.',
      );
    }
  }

  /**
   * 验证所有 Agent 配置
   */
  validateAllConfigs(): ConfigValidationResult {
    const errors: ConfigValidationError[] = [];
    const warnings: ConfigValidationWarning[] = [];

    // 验证每个 Agent 配置
    for (const [agentType, config] of Object.entries(AGENT_CONFIGS)) {
      const agentErrors = this.validateAgentConfig(
        agentType as AgentType,
        config,
      );
      errors.push(...agentErrors);

      // 检查潜在问题（警告）
      const agentWarnings = this.checkAgentWarnings(
        agentType as AgentType,
        config,
      );
      warnings.push(...agentWarnings);
    }

    // 验证 AgentType 枚举与配置的一致性
    const enumTypes = Object.values(AgentType);
    const configTypes = Object.keys(AGENT_CONFIGS);

    for (const enumType of enumTypes) {
      if (!configTypes.includes(enumType)) {
        errors.push({
          agentType: enumType as AgentType,
          field: 'config',
          message: `AgentType "${enumType}" is defined in enum but has no configuration`,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证单个 Agent 配置
   */
  private validateAgentConfig(
    agentType: AgentType,
    config: AgentConfig,
  ): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];

    // 验证必填字段
    if (!config.type) {
      errors.push({
        agentType,
        field: 'type',
        message: 'Missing required field: type',
      });
    }

    if (!config.name) {
      errors.push({
        agentType,
        field: 'name',
        message: 'Missing required field: name',
      });
    }

    if (!config.systemPrompt) {
      errors.push({
        agentType,
        field: 'systemPrompt',
        message: 'Missing required field: systemPrompt',
      });
    }

    if (!config.model) {
      errors.push({
        agentType,
        field: 'model',
        message: 'Missing required field: model',
      });
    }

    // 验证工具配置
    if (!config.tools || !Array.isArray(config.tools)) {
      errors.push({
        agentType,
        field: 'tools',
        message: 'Missing or invalid tools array',
      });
    } else {
      // 验证每个工具是否已注册
      for (const toolName of config.tools) {
        if (!this.registeredTools.has(toolName)) {
          errors.push({
            agentType,
            field: 'tools',
            message: `Tool "${toolName}" is not registered in TOOLS configuration`,
          });
        }
      }
    }

    // 验证委派配置
    if (config.canDelegate) {
      for (const targetAgent of config.canDelegate) {
        if (!AGENT_CONFIGS[targetAgent]) {
          errors.push({
            agentType,
            field: 'canDelegate',
            message: `Delegate target "${targetAgent}" has no configuration`,
          });
        }
      }
    }

    // 验证数值范围
    if (
      config.temperature !== undefined &&
      (config.temperature < 0 || config.temperature > 2)
    ) {
      errors.push({
        agentType,
        field: 'temperature',
        message: `Temperature ${config.temperature} is out of valid range [0, 2]`,
      });
    }

    if (config.maxTokens !== undefined && config.maxTokens < 1) {
      errors.push({
        agentType,
        field: 'maxTokens',
        message: `maxTokens ${config.maxTokens} must be positive`,
      });
    }

    return errors;
  }

  /**
   * 检查潜在问题（警告）
   */
  private checkAgentWarnings(
    agentType: AgentType,
    config: AgentConfig,
  ): ConfigValidationWarning[] {
    const warnings: ConfigValidationWarning[] = [];

    // 检查空工具列表
    if (
      config.tools &&
      config.tools.length === 0 &&
      agentType !== AgentType.ORCHESTRATOR
    ) {
      warnings.push({
        agentType,
        message: 'Agent has no tools configured',
      });
    }

    // 检查循环委派
    if (config.canDelegate?.includes(agentType)) {
      warnings.push({
        agentType,
        message: 'Agent can delegate to itself (potential infinite loop)',
      });
    }

    // 检查过长的系统提示
    if (config.systemPrompt && config.systemPrompt.length > 5000) {
      warnings.push({
        agentType,
        message: `System prompt is very long (${config.systemPrompt.length} chars), may consume excessive tokens`,
      });
    }

    return warnings;
  }

  /**
   * 运行时获取 Agent 配置（带验证）
   */
  getValidatedConfig(agentType: AgentType): AgentConfig | null {
    const config = AGENT_CONFIGS[agentType];

    if (!config) {
      this.logger.error(`Agent configuration not found for type: ${agentType}`);
      return null;
    }

    return config;
  }

  /**
   * 检查配置是否有效
   */
  isConfigValid(): boolean {
    return this.validationResult?.valid ?? false;
  }

  /**
   * 获取验证结果
   */
  getValidationResult(): ConfigValidationResult | null {
    return this.validationResult;
  }

  /**
   * 获取所有有效的 Agent 类型
   */
  getValidAgentTypes(): AgentType[] {
    return Object.keys(AGENT_CONFIGS) as AgentType[];
  }

  /**
   * 检查工具是否已注册
   */
  isToolRegistered(toolName: string): boolean {
    return this.registeredTools.has(toolName);
  }
}
