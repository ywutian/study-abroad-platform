import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, RequirePermission, Roles } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Permission } from '../../common/constants/permissions';
import {
  ThrottleRelaxed,
  ThrottleSensitive,
} from '../../common/decorators/throttle.decorator';
import {
  ApplicationAnalysisEvaluationQueryDto,
  ApplicationAnalysisReplayRunQueryDto,
  ApplicationAnalysisRunQueryDto,
  ApplicationAnalysisExperimentEvaluationQueryDto,
  ApplicationAnalysisExperimentFeedbackQueryDto,
  ApplicationAnalysisExperimentIncidentQueryDto,
  ApplicationAnalysisExperimentQueryDto,
  ApplicationAnalysisExperimentSweepQueryDto,
  ApplicationAnalysisFairnessReportQueryDto,
  ApplicationAnalysisRecoursePreviewDto,
  AcknowledgeApplicationAnalysisExperimentIncidentDto,
  CreateApplicationAnalysisExperimentVersionDto,
  RefreshApplicationAnalysisExperimentEvaluationDto,
  ReplayApplicationAnalysisRunDto,
  RetireApplicationAnalysisExperimentDto,
  ApplicationAnalysisUncertaintyPreviewDto,
  ApplicationAnalysisEvidenceQueryDto,
  ApplicationAnalysisPolicyQueryDto,
  CreateApplicationAnalysisPolicyVersionDto,
  CreateSchoolPolicyEvidenceDto,
  ReviewSchoolPolicyEvidenceDto,
  RollbackApplicationAnalysisPolicyDto,
  UpdateApplicationAnalysisExperimentConfigDto,
} from './dto';
import { ApplicationAnalysisWorkflowService } from '../profile/application-analysis-workflow.service';
import { ProfileApplicationAnalysisV2Service } from '../profile/profile-application-analysis-v2.service';

@ApiTags('Admin - Application Analysis Workflow')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('admin/application-analysis-workflow')
@Roles(Role.OPERATOR)
export class AdminApplicationAnalysisWorkflowController {
  constructor(
    private readonly applicationAnalysisWorkflowService: ApplicationAnalysisWorkflowService,
    private readonly profileApplicationAnalysisV2Service: ProfileApplicationAnalysisV2Service,
  ) {}

  @Get('evidence')
  @ApiOperation({ summary: 'List application-analysis school policy evidence' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async listEvidence(@Query() query: ApplicationAnalysisEvidenceQueryDto) {
    return this.applicationAnalysisWorkflowService.listEvidence(query);
  }

  @Post('evidence')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Create application-analysis school policy evidence',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async createEvidence(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateSchoolPolicyEvidenceDto,
  ) {
    return this.applicationAnalysisWorkflowService.createEvidence(user.id, dto);
  }

  @Patch('evidence/:id/review')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Review application-analysis school policy evidence',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async reviewEvidence(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ReviewSchoolPolicyEvidenceDto,
  ) {
    return this.applicationAnalysisWorkflowService.reviewEvidence(
      user.id,
      id,
      dto,
    );
  }

  @Get('policies')
  @ApiOperation({ summary: 'List application-analysis policy versions' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async listPolicies(@Query() query: ApplicationAnalysisPolicyQueryDto) {
    return this.applicationAnalysisWorkflowService.listPolicyVersions(query);
  }

  @Post('policies')
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Create an application-analysis policy draft' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async createPolicy(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateApplicationAnalysisPolicyVersionDto,
  ) {
    return this.applicationAnalysisWorkflowService.createPolicyVersion(
      user.id,
      dto,
    );
  }

  @Post('policies/:id/candidate')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Freeze an application-analysis policy draft into CANDIDATE',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async promotePolicyToCandidate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.applicationAnalysisWorkflowService.promotePolicyToCandidate(
      user.id,
      id,
    );
  }

  @Post('policies/:id/shadow')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Promote an application-analysis policy candidate to SHADOW',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async promotePolicyToShadow(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.applicationAnalysisWorkflowService.promotePolicyToShadow(
      user.id,
      id,
    );
  }

  @Post('policies/:id/shadow-refresh')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Refresh application-analysis shadow evaluation and gates',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async refreshShadowEvaluation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.applicationAnalysisWorkflowService.refreshShadowEvaluation(
      user.id,
      id,
    );
  }

  @Get('policies/:id/gates')
  @ApiOperation({ summary: 'Inspect application-analysis promotion gates' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async getPolicyGates(@Param('id') id: string) {
    return this.applicationAnalysisWorkflowService.getPolicyGateSummary(id);
  }

  @Post('policies/:id/activate')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Activate a shadow application-analysis policy version',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async activatePolicy(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.applicationAnalysisWorkflowService.activatePolicy(user.id, id);
  }

  @Post('policies/rollback')
  @ThrottleSensitive()
  @ApiOperation({
    summary:
      'Rollback to the previous active application-analysis policy version',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async rollbackPolicy(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RollbackApplicationAnalysisPolicyDto,
  ) {
    return this.applicationAnalysisWorkflowService.rollbackPolicy(
      user.id,
      dto.policyKey ?? 'default',
    );
  }

  @Get('evaluations')
  @ApiOperation({ summary: 'List application-analysis evaluation runs' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async listEvaluations(@Query() query: ApplicationAnalysisEvaluationQueryDto) {
    return this.applicationAnalysisWorkflowService.listEvaluations(query);
  }

  @Get('runs')
  @ApiOperation({ summary: 'List application-analysis v2 runtime runs' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async listRuns(@Query() query: ApplicationAnalysisRunQueryDto) {
    return this.profileApplicationAnalysisV2Service.listRuns(query);
  }

  @Get('replays')
  @ApiOperation({ summary: 'List application-analysis replay runs' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async listReplays(@Query() query: ApplicationAnalysisReplayRunQueryDto) {
    return this.profileApplicationAnalysisV2Service.listReplayRuns(query);
  }

  @Post('runs/:id/replay')
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Replay one stored application-analysis v2 run' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async replayRun(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ReplayApplicationAnalysisRunDto,
  ) {
    return this.profileApplicationAnalysisV2Service.replayRun(id, user.id, dto);
  }

  @Get('experiments')
  @ApiOperation({ summary: 'List application-analysis experiment versions' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async listExperiments(@Query() query: ApplicationAnalysisExperimentQueryDto) {
    return this.applicationAnalysisWorkflowService.listExperimentVersions(
      query,
    );
  }

  @Post('experiments')
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Create an application-analysis experiment draft' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async createExperiment(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateApplicationAnalysisExperimentVersionDto,
  ) {
    return this.applicationAnalysisWorkflowService.createExperimentVersion(
      user.id,
      dto,
    );
  }

  @Post('experiments/sweep')
  @ThrottleSensitive()
  @ApiOperation({
    summary:
      'Run the automated application-analysis experiment sweep immediately',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async runExperimentSweep(@CurrentUser() user: CurrentUserPayload) {
    return this.applicationAnalysisWorkflowService.runAutomatedExperimentSweep(
      user.id,
    );
  }

  @Get('experiment-sweeps')
  @ApiOperation({
    summary: 'List application-analysis experiment automation sweep runs',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async listExperimentSweeps(
    @Query() query: ApplicationAnalysisExperimentSweepQueryDto,
  ) {
    return this.applicationAnalysisWorkflowService.listExperimentSweeps(query);
  }

  @Get('experiment-incidents')
  @ApiOperation({
    summary: 'List application-analysis experiment incidents',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async listExperimentIncidents(
    @Query() query: ApplicationAnalysisExperimentIncidentQueryDto,
  ) {
    return this.applicationAnalysisWorkflowService.listExperimentIncidents(
      query,
    );
  }

  @Patch('experiment-incidents/:id/acknowledge')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Acknowledge an application-analysis experiment incident',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async acknowledgeIncident(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: AcknowledgeApplicationAnalysisExperimentIncidentDto,
  ) {
    return this.applicationAnalysisWorkflowService.acknowledgeExperimentIncident(
      user.id,
      id,
      dto,
    );
  }

  @Get('experiment-feedback')
  @ApiOperation({
    summary: 'List application-analysis applicant feedback records',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async listExperimentFeedback(
    @Query() query: ApplicationAnalysisExperimentFeedbackQueryDto,
  ) {
    return this.applicationAnalysisWorkflowService.listExperimentFeedback(
      query,
    );
  }

  @Post('experiments/:id/shadow')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Promote an application-analysis experiment draft to SHADOW',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async promoteExperimentToShadow(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.applicationAnalysisWorkflowService.promoteExperimentToShadow(
      user.id,
      id,
    );
  }

  @Post('experiments/:id/canary')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Promote an application-analysis experiment to CANARY rollout',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async promoteExperimentToCanary(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.applicationAnalysisWorkflowService.promoteExperimentToCanary(
      user.id,
      id,
    );
  }

  @Post('experiments/:id/evaluate')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Refresh application-analysis experiment evaluation',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async refreshExperimentEvaluation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: RefreshApplicationAnalysisExperimentEvaluationDto,
  ) {
    return this.applicationAnalysisWorkflowService.refreshExperimentEvaluation(
      user.id,
      id,
      dto.mode,
    );
  }

  @Get('experiments/:id/gates')
  @ApiOperation({ summary: 'Inspect application-analysis experiment gates' })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async getExperimentGates(@Param('id') id: string) {
    return this.applicationAnalysisWorkflowService.getExperimentGateSummary(id);
  }

  @Post('experiments/:id/activate')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Activate an application-analysis experiment capability',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async activateExperiment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.applicationAnalysisWorkflowService.activateExperiment(
      user.id,
      id,
    );
  }

  @Patch('experiments/:id/config')
  @ThrottleSensitive()
  @ApiOperation({
    summary:
      'Patch application-analysis experiment rollout and monitoring config',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async patchExperimentConfig(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationAnalysisExperimentConfigDto,
  ) {
    return this.applicationAnalysisWorkflowService.updateExperimentConfig(
      user.id,
      id,
      dto,
    );
  }

  @Post('experiments/:id/retire')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Retire an application-analysis experiment capability',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async retireExperiment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: RetireApplicationAnalysisExperimentDto,
  ) {
    return this.applicationAnalysisWorkflowService.retireExperiment(
      user.id,
      id,
      dto.reason,
    );
  }

  @Get('experiment-evaluations')
  @ApiOperation({
    summary: 'List application-analysis experiment evaluation runs',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async listExperimentEvaluations(
    @Query() query: ApplicationAnalysisExperimentEvaluationQueryDto,
  ) {
    return this.applicationAnalysisWorkflowService.listExperimentEvaluations(
      query,
    );
  }

  @Post('experiments/recourse-preview')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Preview experimental recourse / counterfactual guidance',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async recoursePreview(@Body() dto: ApplicationAnalysisRecoursePreviewDto) {
    return this.applicationAnalysisWorkflowService.recoursePreview(dto);
  }

  @Post('experiments/uncertainty-preview')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Preview experimental conformal-style uncertainty output',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async uncertaintyPreview(
    @Body() dto: ApplicationAnalysisUncertaintyPreviewDto,
  ) {
    return this.applicationAnalysisWorkflowService.uncertaintyPreview(dto);
  }

  @Get('experiments/fairness-report')
  @ApiOperation({
    summary: 'Get experimental subgroup fairness readiness report',
  })
  @RequirePermission(Permission.SYSTEM_CALIBRATION)
  async fairnessReport(
    @Query() query: ApplicationAnalysisFairnessReportQueryDto,
  ) {
    return this.applicationAnalysisWorkflowService.fairnessReport(query);
  }
}
