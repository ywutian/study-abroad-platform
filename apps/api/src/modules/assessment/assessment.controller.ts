import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
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

@ApiTags('assessment')
@Controller('assessment')
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Get(':type')
  @Public()
  @ApiOperation({ summary: '获取测评题目' })
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
  @ApiOperation({ summary: '提交测评答案' })
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
  @ApiOperation({ summary: '获取测评历史' })
  @ApiResponse({ status: 200, type: [AssessmentResultDto] })
  async getHistory(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AssessmentResultDto[]> {
    return this.assessmentService.getHistory(user.id);
  }

  @Get('result/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取单个测评结果' })
  @ApiParam({ name: 'id', description: '结果ID' })
  @ApiResponse({ status: 200, type: AssessmentResultDto })
  async getResult(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<AssessmentResultDto> {
    return this.assessmentService.getResult(user.id, id);
  }
}
