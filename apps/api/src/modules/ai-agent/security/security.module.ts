/**
 * 安全模块
 *
 * 提供企业级安全能力：
 * - Prompt 注入防护
 * - 内容审核
 * - 审计日志
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PromptGuardService } from './prompt-guard.service';
import { ContentModerationService } from './content-moderation.service';
import { AuditService } from './audit.service';
import { AlertChannelService } from '../infrastructure/alerting/alert-channel.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    PromptGuardService,
    ContentModerationService,
    AuditService,
    AlertChannelService,
  ],
  exports: [
    PromptGuardService,
    ContentModerationService,
    AuditService,
    AlertChannelService,
  ],
})
export class AgentSecurityModule {}
