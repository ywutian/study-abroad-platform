import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles, RequirePermission, CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Permission } from '../../common/constants/permissions';
import { Role } from '@prisma/client';
import {
  ThrottleRelaxed,
  ThrottleSensitive,
} from '../../common/decorators/throttle.decorator';
import {
  PredictionObservationQueryDto,
  CreatePredictionObservationDto,
  ReviewPredictionObservationDto,
  BuildPredictionSignalsDto,
  PredictionSignalQueryDto,
  PredictionPolicyQueryDto,
  CreatePredictionPolicyVersionDto,
  UpdatePredictionPolicyShadowMetricsDto,
  RollbackPredictionPolicyDto,
  PredictionOutcomeQueryDto,
  ReviewPredictionOutcomeDto,
} from './dto';
import { PredictionWorkflowService } from '../prediction/prediction-workflow.service';
import { PredictionPolicyShadowService } from '../prediction/prediction-policy-shadow.service';

@ApiTags('Admin - Prediction Workflow')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('admin/prediction-workflow')
@Roles(Role.OPERATOR)
export class AdminPredictionWorkflowController {
  constructor(
    private readonly predictionWorkflowService: PredictionWorkflowService,
    private readonly predictionPolicyShadowService: PredictionPolicyShadowService,
  ) {}

  @Get('observations')
  @ApiOperation({ summary: 'List prediction source observations' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async listPredictionObservations(
    @Query() query: PredictionObservationQueryDto,
  ) {
    return this.predictionWorkflowService.listObservations(query);
  }

  @Post('observations')
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Create a prediction source observation' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async createPredictionObservation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePredictionObservationDto,
  ) {
    return this.predictionWorkflowService.createObservation(user.id, dto);
  }

  @Patch('observations/:id/review')
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Review or reclassify a prediction observation' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async reviewPredictionObservation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ReviewPredictionObservationDto,
  ) {
    return this.predictionWorkflowService.reviewObservation(user.id, id, dto);
  }

  @Post('signals/build')
  @ThrottleSensitive()
  @ApiOperation({
    summary:
      'Build active priors, drift, and relationship signals for a policy version',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async buildPredictionSignals(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BuildPredictionSignalsDto,
  ) {
    return this.predictionWorkflowService.buildActiveSignals(user.id, dto);
  }

  @Get('signals')
  @ApiOperation({
    summary:
      'List active priors, drift, and relationship signals for a policy version',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async getPredictionWorkflowSignals(@Query() query: PredictionSignalQueryDto) {
    return this.predictionWorkflowService.getActiveSignals(query);
  }

  @Get('policies')
  @ApiOperation({ summary: 'List prediction policy versions' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async listPredictionPolicies(@Query() query: PredictionPolicyQueryDto) {
    return this.predictionWorkflowService.listPolicyVersions(query);
  }

  @Post('policies')
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Create a prediction policy version draft' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async createPredictionPolicy(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePredictionPolicyVersionDto,
  ) {
    return this.predictionWorkflowService.createPolicyVersion(user.id, dto);
  }

  @Post('policies/:id/candidate')
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Freeze a prediction policy draft into CANDIDATE' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async promotePredictionPolicyToCandidate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.predictionWorkflowService.promotePolicyToCandidate(user.id, id);
  }

  @Post('policies/:id/shadow')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Promote a prediction policy candidate to SHADOW',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async promotePredictionPolicyToShadow(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.predictionWorkflowService.promotePolicyToShadow(user.id, id);
  }

  @Post('policies/:id/shadow-refresh')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Refresh whole-policy shadow metrics for a policy version',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async refreshPredictionPolicyShadowMetrics(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.predictionPolicyShadowService.refreshPolicyShadowMetrics(
      id,
      user.id,
    );
  }

  @Get('policies/:id/gates')
  @ApiOperation({ summary: 'Inspect prediction policy promotion gates' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async getPredictionPolicyGates(@Param('id') id: string) {
    return this.predictionWorkflowService.getPolicyGateSummary(id);
  }

  @Patch('policies/:id/shadow-metrics')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Record shadow metrics for a prediction policy candidate',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async updatePredictionPolicyShadowMetrics(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePredictionPolicyShadowMetricsDto,
  ) {
    return this.predictionWorkflowService.updatePolicyShadowMetrics(
      user.id,
      id,
      dto.metrics,
    );
  }

  @Post('policies/:id/activate')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Activate a shadow prediction policy version',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async activatePredictionPolicy(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.predictionWorkflowService.activatePolicy(user.id, id);
  }

  @Post('policies/rollback')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Rollback to the previous active prediction policy version',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async rollbackPredictionPolicy(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RollbackPredictionPolicyDto,
  ) {
    return this.predictionWorkflowService.rollbackPolicy(
      user.id,
      dto.policyKey ?? 'default',
    );
  }

  @Get('outcomes')
  @ApiOperation({
    summary: 'List prediction outcome labels for workflow review',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async listPredictionOutcomeLabels(@Query() query: PredictionOutcomeQueryDto) {
    return this.predictionWorkflowService.listOutcomeLabels(query);
  }

  @Patch('outcomes/:id/review')
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Review and verify a prediction outcome label' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async reviewPredictionOutcomeLabel(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ReviewPredictionOutcomeDto,
  ) {
    return this.predictionWorkflowService.reviewOutcomeLabel(user.id, id, dto);
  }

  @Get('authority-stats')
  @ApiOperation({
    summary:
      'PredictionAuthority distribution (AUTHORITATIVE vs PREVIEW) + invariant checks',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async getPredictionAuthorityStats() {
    return this.predictionWorkflowService.getAuthorityStats();
  }
}
