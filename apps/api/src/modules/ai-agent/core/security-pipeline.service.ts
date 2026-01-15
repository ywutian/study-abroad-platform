/**
 * 安全管道服务
 *
 * 统一的安全处理流程：
 * 1. 输入检查 → 2. 处理 → 3. 输出审核
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  PromptGuardService,
  PromptGuardResult,
} from '../security/prompt-guard.service';
import {
  ContentModerationService,
  ModerationResult,
  ModerationAction,
} from '../security/content-moderation.service';
import {
  AuditService,
  AuditAction,
  AuditStatus,
  SecurityEventType,
  SecuritySeverity,
} from '../security/audit.service';

// ==================== 类型定义 ====================

export interface SecurityPipelineResult {
  allowed: boolean;
  inputCheck: {
    passed: boolean;
    riskScore: number;
    sanitizedInput?: string;
  };
  outputCheck?: {
    passed: boolean;
    action: ModerationAction;
    sanitizedOutput?: string;
  };
  blocked: boolean;
  reason?: string;
}

export interface PipelineOptions {
  userId?: string;
  conversationId?: string;
  strictMode?: boolean;
  skipInputCheck?: boolean;
  skipOutputCheck?: boolean;
  systemPrompt?: string;
}

// ==================== 服务实现 ====================

@Injectable()
export class SecurityPipelineService {
  private readonly logger = new Logger(SecurityPipelineService.name);

  constructor(
    private promptGuard: PromptGuardService,
    private contentModeration: ContentModerationService,
    private auditService: AuditService,
  ) {}

  /**
   * 检查输入安全性
   */
  async checkInput(
    input: string,
    options?: PipelineOptions,
  ): Promise<{
    allowed: boolean;
    sanitizedInput?: string;
    result: PromptGuardResult;
  }> {
    if (options?.skipInputCheck) {
      return {
        allowed: true,
        sanitizedInput: input,
        result: {
          safe: true,
          riskScore: 0,
          threats: [],
          blocked: false,
        },
      };
    }

    const result = await this.promptGuard.analyze(input, {
      userId: options?.userId,
      strictMode: options?.strictMode,
    });

    // 记录安全事件
    if (result.blocked) {
      await this.auditService.logSecurityEvent({
        type: SecurityEventType.PROMPT_INJECTION,
        severity:
          result.riskScore >= 0.8
            ? SecuritySeverity.CRITICAL
            : SecuritySeverity.HIGH,
        description: result.reason || '检测到输入注入攻击',
        payload: {
          threats: result.threats,
          riskScore: result.riskScore,
          conversationId: options?.conversationId,
        },
        mitigationAction: 'BLOCKED',
      });

      await this.auditService.log({
        action: AuditAction.SECURITY_THREAT,
        resource: 'input',
        operation: 'EXECUTE',
        status: AuditStatus.DENIED,
        details: {
          threatTypes: result.threats.map((t) => t.type),
          riskScore: result.riskScore,
        },
      });
    }

    return {
      allowed: !result.blocked,
      sanitizedInput: result.sanitizedInput,
      result,
    };
  }

  /**
   * 检查输出安全性
   */
  async checkOutput(
    output: string,
    options?: PipelineOptions,
  ): Promise<{
    allowed: boolean;
    sanitizedOutput?: string;
    result: ModerationResult;
  }> {
    if (options?.skipOutputCheck) {
      return {
        allowed: true,
        sanitizedOutput: output,
        result: {
          safe: true,
          flagged: false,
          categories: [],
          severity: 'NONE',
          action: ModerationAction.ALLOW,
          details: [],
        },
      };
    }

    const result = await this.contentModeration.moderateOutput(
      output,
      options?.systemPrompt,
    );

    // 记录安全事件
    if (result.action === ModerationAction.BLOCK) {
      await this.auditService.logSecurityEvent({
        type: result.details.some((d) => d.type === 'PROMPT_LEAK')
          ? SecurityEventType.PROMPT_INJECTION
          : SecurityEventType.HARMFUL_CONTENT,
        severity:
          result.severity === 'HIGH'
            ? SecuritySeverity.HIGH
            : SecuritySeverity.MEDIUM,
        description: '输出内容审核未通过',
        payload: {
          details: result.details,
          conversationId: options?.conversationId,
        },
        mitigationAction: 'BLOCKED',
      });
    } else if (result.action === ModerationAction.SANITIZE) {
      await this.auditService.log({
        action: AuditAction.SECURITY_THREAT,
        resource: 'output',
        operation: 'EXECUTE',
        status: AuditStatus.SUCCESS,
        details: {
          action: 'SANITIZED',
          severity: result.severity,
        },
      });
    }

    const blocked = result.action === ModerationAction.BLOCK;

    return {
      allowed: !blocked,
      sanitizedOutput: result.sanitizedContent || output,
      result,
    };
  }

  /**
   * 完整安全管道
   */
  async process(
    input: string,
    processor: (sanitizedInput: string) => Promise<string>,
    options?: PipelineOptions,
  ): Promise<SecurityPipelineResult> {
    // 1. 输入检查
    const inputCheck = await this.checkInput(input, options);

    if (!inputCheck.allowed) {
      return {
        allowed: false,
        inputCheck: {
          passed: false,
          riskScore: inputCheck.result.riskScore,
        },
        blocked: true,
        reason: inputCheck.result.reason,
      };
    }

    // 2. 处理
    let output: string;
    try {
      output = await processor(inputCheck.sanitizedInput || input);
    } catch (error) {
      this.logger.error('Processor error', error);
      throw error;
    }

    // 3. 输出审核
    const outputCheck = await this.checkOutput(output, options);

    return {
      allowed: outputCheck.allowed,
      inputCheck: {
        passed: true,
        riskScore: inputCheck.result.riskScore,
        sanitizedInput: inputCheck.sanitizedInput,
      },
      outputCheck: {
        passed: outputCheck.allowed,
        action: outputCheck.result.action,
        sanitizedOutput: outputCheck.sanitizedOutput,
      },
      blocked: !outputCheck.allowed,
      reason: !outputCheck.allowed ? '输出内容未通过安全审核' : undefined,
    };
  }

  /**
   * 快速检查（仅关键规则）
   */
  quickCheck(input: string): { safe: boolean; reason?: string } {
    const inputCheck = this.promptGuard.quickCheck(input);
    if (!inputCheck.safe) {
      return {
        safe: false,
        reason: `检测到 ${inputCheck.threat} 威胁`,
      };
    }

    const outputCheck = this.contentModeration.quickCheck(input);
    if (!outputCheck.safe) {
      return {
        safe: false,
        reason: `内容严重程度: ${outputCheck.severity}`,
      };
    }

    return { safe: true };
  }
}
