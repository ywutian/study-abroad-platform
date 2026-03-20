import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
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
