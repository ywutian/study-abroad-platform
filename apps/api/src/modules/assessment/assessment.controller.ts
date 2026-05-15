import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AssessmentService } from './assessment.service';
import {
  AssessmentTypeEnum,
  AssessmentDto,
  AssessmentResultDto,
  SubmitAssessmentDto,
  SaveAssessmentDraftDto,
  AssessmentDraftDto,
  AssessmentSummaryDto,
} from './dto';
import { CurrentUser, Public } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ThrottleAI } from '../../common/decorators/throttle.decorator';

@ApiTags('assessment')
@ThrottleAI()
@Controller('assessments')
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Get(':type')
  @Public()
  @ApiOperation({ summary: 'Get assessment questions' })
  @ApiParam({ name: 'type', enum: AssessmentTypeEnum })
  @ApiResponse({ status: 200, type: AssessmentDto })
  async getAssessment(
    @Param('type') type: AssessmentTypeEnum,
  ): Promise<AssessmentDto> {
    return this.assessmentService.getAssessment(type);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit assessment answers' })
  @ApiResponse({ status: 200, type: AssessmentResultDto })
  async submitAssessment(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SubmitAssessmentDto,
  ): Promise<AssessmentResultDto> {
    return this.assessmentService.submitAssessment(user.id, dto);
  }

  @Get('summary/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user assessment dashboard summary' })
  @ApiResponse({ status: 200, type: AssessmentSummaryDto })
  async getSummary(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AssessmentSummaryDto> {
    return this.assessmentService.getSummary(user.id);
  }

  @Get(':type/draft')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user assessment draft' })
  @ApiParam({ name: 'type', enum: AssessmentTypeEnum })
  @ApiResponse({ status: 200, type: AssessmentDraftDto })
  async getDraft(
    @CurrentUser() user: CurrentUserPayload,
    @Param('type') type: AssessmentTypeEnum,
  ): Promise<AssessmentDraftDto | null> {
    return this.assessmentService.getDraft(user.id, type);
  }

  @Put(':type/draft')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save current user assessment draft' })
  @ApiParam({ name: 'type', enum: AssessmentTypeEnum })
  @ApiResponse({ status: 200, type: AssessmentDraftDto })
  async saveDraft(
    @CurrentUser() user: CurrentUserPayload,
    @Param('type') type: AssessmentTypeEnum,
    @Body() dto: SaveAssessmentDraftDto,
  ): Promise<AssessmentDraftDto> {
    return this.assessmentService.saveDraft(user.id, type, dto);
  }

  @Delete(':type/draft')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete current user assessment draft' })
  @ApiParam({ name: 'type', enum: AssessmentTypeEnum })
  async deleteDraft(
    @CurrentUser() user: CurrentUserPayload,
    @Param('type') type: AssessmentTypeEnum,
  ) {
    await this.assessmentService.deleteDraft(user.id, type);
    return { message: 'Draft deleted' };
  }

  @Get('history/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get assessment history' })
  @ApiResponse({ status: 200, type: [AssessmentResultDto] })
  async getHistory(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AssessmentResultDto[]> {
    return this.assessmentService.getHistory(user.id);
  }

  @Get('result/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get single assessment result' })
  @ApiParam({ name: 'id', description: 'Result ID' })
  @ApiResponse({ status: 200, type: AssessmentResultDto })
  async getResult(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<AssessmentResultDto> {
    return this.assessmentService.getResult(user.id, id);
  }
}
