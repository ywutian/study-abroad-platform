import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Permission } from '../../../common/constants/permissions';
import { CurrentUser, RequirePermission } from '../../../common/decorators';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ThrottleRelaxed } from '../../../common/decorators/throttle.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentHarnessOperationsService } from '../core/agent-harness-operations.service';
import type { HarnessAcceptanceScenario } from '../core/agent-harness-operations.service';
import { AlertChannelService } from '../infrastructure/alerting/alert-channel.service';
import { AgentSemanticSyntheticAccountService } from './agent-semantic-synthetic-account.service';
import { EmbeddingAcceptanceService } from '../memory/embedding-acceptance.service';

class EmbeddingAcceptanceDto {
  @IsString()
  @MaxLength(200)
  targetUserId: string;

  @IsString()
  @MaxLength(200)
  isolationUserId: string;
}

class CreateHarnessAcceptanceGrantDto {
  @IsString()
  @MaxLength(200)
  targetUserId: string;

  @IsString()
  @IsIn(['context_compression_failure', 'budget_exhaustion'])
  scenario: HarnessAcceptanceScenario;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxTokens?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxDurationMs?: number;
}

class AcknowledgeHarnessAlertDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}

class CleanupSemanticSyntheticAccountDto {
  @IsString()
  @MaxLength(200)
  targetUserId: string;

  @IsString()
  @MaxLength(320)
  expectedEmail: string;
}

@ApiTags('ai-agent-harness-admin')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('admin/ai-agent/harness')
@Roles(Role.ADMIN)
@RequirePermission(Permission.AI_CONFIG)
export class AgentHarnessAdminController {
  constructor(
    private readonly harnessOperations: AgentHarnessOperationsService,
    private readonly alerts: AlertChannelService,
    private readonly prisma: PrismaService,
    private readonly semanticSyntheticAccounts: AgentSemanticSyntheticAccountService,
    private readonly embeddingAcceptance: EmbeddingAcceptanceService,
  ) {}

  @Post('embedding-acceptance')
  @ApiOperation({
    summary: 'Verify embeddings with bounded synthetic memory fixtures',
  })
  verifyEmbedding(
    @CurrentUser() admin: { id: string },
    @Body() body: EmbeddingAcceptanceDto,
  ) {
    return this.embeddingAcceptance.run(
      admin.id,
      body.targetUserId,
      body.isolationUserId,
    );
  }

  @Post('acceptance-grants')
  @ApiOperation({
    summary: 'Create a one-shot synthetic Harness acceptance grant',
  })
  createAcceptanceGrant(
    @CurrentUser() admin: { id: string },
    @Body() body: CreateHarnessAcceptanceGrantDto,
  ) {
    return this.harnessOperations.createGrant({
      adminId: admin.id,
      targetUserId: body.targetUserId,
      scenario: body.scenario,
      maxTokens: body.maxTokens,
      maxDurationMs: body.maxDurationMs,
    });
  }

  @Get('evidence')
  @ApiOperation({
    summary: 'Get durable cross-instance Harness evidence counters',
  })
  getEvidence(@Query('days') days = 7) {
    return this.harnessOperations.getEvidence(Number(days) || 7);
  }

  @Post('semantic-synthetic-cleanup')
  @ApiOperation({
    summary: 'Clean one strictly scoped semantic-evaluation synthetic account',
  })
  cleanupSemanticSyntheticAccount(
    @CurrentUser() admin: { id: string },
    @Body() body: CleanupSemanticSyntheticAccountDto,
  ) {
    return this.semanticSyntheticAccounts.cleanup({
      adminId: admin.id,
      targetUserId: body.targetUserId,
      expectedEmail: body.expectedEmail,
    });
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get sanitized active Harness alerts' })
  async getAlerts(@Query('limit') limit = 50) {
    const alerts = await this.alerts.getActiveAlerts(
      Math.min(Math.max(Number(limit) || 50, 1), 100),
    );
    return alerts.map((alert) => ({
      alertId: alert.alertId,
      title: alert.title,
      severity: alert.severity,
      source: alert.source,
      timestamp: alert.timestamp,
    }));
  }

  @Get('alerts/status')
  @ApiOperation({ summary: 'Get durable Harness alert delivery status' })
  getAlertStatus() {
    return this.alerts.getStats();
  }

  @Get('alerts/:alertId/delivery')
  @ApiOperation({ summary: 'Get Harness alert delivery status' })
  getAlertDelivery(@Param('alertId') alertId: string) {
    return this.alerts.getDeliveryLog(alertId).then((entries) =>
      entries.map((entry) => ({
        channel: entry.channel,
        status: entry.status,
        durationMs: entry.durationMs,
        timestamp: entry.timestamp,
      })),
    );
  }

  @Post('alerts/:alertId/acknowledge')
  @ApiOperation({ summary: 'Acknowledge a Harness alert' })
  async acknowledgeAlert(
    @CurrentUser() admin: { id: string },
    @Param('alertId') alertId: string,
    @Body() body: AcknowledgeHarnessAlertDto,
  ) {
    await this.alerts.acknowledgeAlert(alertId, admin.id, body.notes);
    await this.prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'AI_AGENT_ALERT_ACKNOWLEDGED',
        resource: 'agent_harness_alert',
        resourceId: alertId,
        metadata: body.notes ? { notes: body.notes } : undefined,
      },
    });
    return { acknowledged: true };
  }
}
