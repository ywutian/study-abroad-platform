import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Permission } from '../../../common/constants/permissions';
import {
  CurrentUser,
  RequirePermission,
  Roles,
} from '../../../common/decorators';
import { ThrottleRelaxed } from '../../../common/decorators/throttle.decorator';
import { AgentType } from '../types';
import { AgentSkillEvolutionService } from '../skills/agent-skill-evolution.service';
import { AgentSkillEvaluationService } from '../skills/agent-skill-evaluation.service';
import { AgentSkillService } from '../skills/agent-skill.service';

class CreateSkillCandidateDto {
  @IsString()
  @IsIn(Object.values(AgentType))
  agentType: AgentType;

  @IsString()
  @IsOptional()
  parentVersionId?: string;

  @IsObject()
  patch: Record<string, unknown>;

  @IsString()
  @MaxLength(1000)
  reason: string;
}

class EvaluateSkillDto {
  @IsString()
  @IsIn(Object.values(AgentType))
  agentType: AgentType;

  @IsString()
  @MaxLength(80)
  targetSignalType: string;
}

class SkillActionDto {
  @IsString()
  @IsIn(Object.values(AgentType))
  agentType: AgentType;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}

@ApiTags('ai-agent-skills-admin')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('admin/ai-agent/skills')
@Roles(Role.ADMIN)
@RequirePermission(Permission.AI_CONFIG)
export class AgentSkillsAdminController {
  constructor(
    private readonly skills: AgentSkillService,
    private readonly evaluations: AgentSkillEvaluationService,
    private readonly evolution: AgentSkillEvolutionService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get declarative Skill deployment and audit status',
  })
  getStatus(@Query('agentType') agentType?: AgentType) {
    return this.skills.getStatus(agentType);
  }

  @Post('candidates')
  @ApiOperation({ summary: 'Create an immutable declarative Skill candidate' })
  createCandidate(
    @CurrentUser() admin: { id: string },
    @Body() dto: CreateSkillCandidateDto,
  ) {
    return this.skills.createCandidate({
      agentType: dto.agentType,
      parentVersionId: dto.parentVersionId,
      patch: dto.patch,
      reason: dto.reason,
      source: 'ADMIN',
      createdBy: admin.id,
    });
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate a Skill patch without persisting it' })
  validateCandidate(@Body() dto: CreateSkillCandidateDto) {
    return this.skills.validateCandidate({
      agentType: dto.agentType,
      parentVersionId: dto.parentVersionId,
      patch: dto.patch,
    });
  }

  @Post('versions/:versionId/evaluate')
  @ApiOperation({
    summary: 'Compare a Skill candidate against the active baseline',
  })
  evaluate(
    @Param('versionId') versionId: string,
    @Body() dto: EvaluateSkillDto,
  ) {
    return this.evaluations.evaluate({
      agentType: dto.agentType,
      candidateVersionId: versionId,
      targetSignalType: dto.targetSignalType,
    });
  }

  @Post('versions/:versionId/publish')
  @ApiOperation({
    summary: 'Atomically publish a passed Skill to 100% traffic',
  })
  publish(
    @CurrentUser() admin: { id: string },
    @Param('versionId') versionId: string,
    @Body() dto: SkillActionDto,
  ) {
    return this.skills.publish(dto.agentType, versionId, admin.id);
  }

  @Post('rollback')
  @ApiOperation({
    summary: 'Atomically roll back to the previous Skill version',
  })
  rollback(@CurrentUser() admin: { id: string }, @Body() dto: SkillActionDto) {
    return this.skills.rollback(
      dto.agentType,
      dto.reason ?? 'Manual rollback',
      admin.id,
    );
  }

  @Post('evolution/run')
  @ApiOperation({ summary: 'Run the bounded evolution closure immediately' })
  runEvolution() {
    return this.evolution.runCycle();
  }
}
