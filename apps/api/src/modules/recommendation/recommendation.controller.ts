import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { RecommendationService } from './recommendation.service';
import {
  SchoolRecommendationRequestDto,
  SchoolRecommendationResponseDto,
} from './dto';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('recommendation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recommendation')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Post()
  @ApiOperation({ summary: '生成 AI 选校建议 - 消耗25积分' })
  @ApiResponse({ status: 200, type: SchoolRecommendationResponseDto })
  async generateRecommendation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SchoolRecommendationRequestDto,
  ): Promise<SchoolRecommendationResponseDto> {
    return this.recommendationService.generateRecommendation(user.id, dto);
  }

  @Get('history')
  @ApiOperation({ summary: '获取选校建议历史' })
  @ApiResponse({ status: 200, type: [SchoolRecommendationResponseDto] })
  async getHistory(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<SchoolRecommendationResponseDto[]> {
    return this.recommendationService.getRecommendationHistory(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个推荐详情' })
  @ApiResponse({ status: 200, type: SchoolRecommendationResponseDto })
  async getById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<SchoolRecommendationResponseDto> {
    return this.recommendationService.getRecommendationById(user.id, id);
  }
}
