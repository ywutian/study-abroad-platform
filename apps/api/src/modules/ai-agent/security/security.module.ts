/**
 * 安全模块
 *
 * 提供企业级安全能力：
 * - Prompt 注入防护
 * - 内容审核
 * - 审计日志
 */

import { Module, Global } from '@nestjs/common';
import { PromptGuardService } from './prompt-guard.service';
import { ContentModerationService } from './content-moderation.service';
import { AuditService } from './audit.service';

@Global()
@Module({
  providers: [PromptGuardService, ContentModerationService, AuditService],
  exports: [PromptGuardService, ContentModerationService, AuditService],
})
export class AgentSecurityModule {}
