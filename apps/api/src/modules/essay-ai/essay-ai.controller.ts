import {
  Controller,
  Post,
  Get,
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
  ApiQuery,
} from '@nestjs/swagger';
import { EssayAiService } from './essay-ai.service';
import {
  EssayPolishRequestDto,
  EssayPolishResponseDto,
  EssayReviewRequestDto,
  EssayReviewResponseDto,
  EssayBrainstormRequestDto,
  EssayBrainstormResponseDto,
} from './dto';
import { CurrentUser, Public } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('essay-ai')
@Controller('essay-ai')
export class EssayAiController {
  constructor(private readonly essayAiService: EssayAiService) {}

  @Post('polish')
  @ApiOperation({ summary: 'AI文书润色 - 消耗20积分' })
  @ApiResponse({ status: 200, type: EssayPolishResponseDto })
  async polishEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: EssayPolishRequestDto,
  ): Promise<EssayPolishResponseDto> {
    return this.essayAiService.polishEssay(user.id, dto);
  }

  @Post('review')
  @ApiOperation({ summary: 'AI文书点评（招生官视角） - 消耗30积分' })
  @ApiResponse({ status: 200, type: EssayReviewResponseDto })
  async reviewEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: EssayReviewRequestDto,
  ): Promise<EssayReviewResponseDto> {
    return this.essayAiService.reviewEssay(user.id, dto);
  }

  @Post('brainstorm')
  @ApiOperation({ summary: 'AI文书创意生成 - 消耗15积分' })
  @ApiResponse({ status: 200, type: EssayBrainstormResponseDto })
  async brainstormIdeas(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: EssayBrainstormRequestDto,
  ): Promise<EssayBrainstormResponseDto> {
    return this.essayAiService.brainstormIdeas(user.id, dto);
  }

  @Get('history/:essayId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取文书AI处理历史' })
  async getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('essayId') essayId: string,
  ) {
    return this.essayAiService.getEssayAIHistory(user.id, essayId);
  }

  // ============ 文书画廊 (P1) ============

  @Get('gallery')
  @Public()
  @ApiOperation({ summary: '获取公开优秀文书列表' })
  @ApiQuery({ name: 'school', required: false, description: '学校名称搜索' })
  @ApiQuery({
    name: 'type',
    required: false,
    description: '文书类型: COMMON_APP, UC, SUPPLEMENTAL, WHY_SCHOOL, OTHER',
  })
  @ApiQuery({
    name: 'promptNumber',
    required: false,
    description: 'Common App 1-7 或 UC PIQ 1-4',
  })
  @ApiQuery({ name: 'year', required: false, description: '申请年份' })
  @ApiQuery({
    name: 'result',
    required: false,
    description: '录取结果: ADMITTED, REJECTED, WAITLISTED, DEFERRED',
  })
  @ApiQuery({ name: 'rankMin', required: false, description: '学校排名下限' })
  @ApiQuery({ name: 'rankMax', required: false, description: '学校排名上限' })
  @ApiQuery({
    name: 'isVerified',
    required: false,
    description: '仅显示已验证',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: '排序: newest, popular',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async getGalleryEssays(
    @Query('school') school?: string,
    @Query('type') type?: string,
    @Query('promptNumber') promptNumber?: string,
    @Query('year') year?: string,
    @Query('result') result?: string,
    @Query('rankMin') rankMin?: string,
    @Query('rankMax') rankMax?: string,
    @Query('isVerified') isVerified?: string,
    @Query('sortBy') sortBy?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.essayAiService.getGalleryEssays({
      school,
      type: type as any,
      promptNumber: promptNumber ? parseInt(promptNumber) : undefined,
      year: year ? parseInt(year) : undefined,
      result: result as any,
      rankMin: rankMin ? parseInt(rankMin) : undefined,
      rankMax: rankMax ? parseInt(rankMax) : undefined,
      isVerified: isVerified === 'true',
      sortBy: sortBy as any,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 12,
    });
  }

  @Get('gallery/:essayId')
  @Public()
  @ApiOperation({ summary: '获取单篇公开文书详情' })
  async getGalleryEssayDetail(@Param('essayId') essayId: string) {
    return this.essayAiService.getGalleryEssayDetail(essayId);
  }

  @Post('gallery/:essayId/analyze')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '逐段分析公开文书 - 消耗20积分' })
  async analyzeGalleryEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Param('essayId') essayId: string,
    @Body() body: { schoolName?: string },
  ) {
    return this.essayAiService.analyzeGalleryEssay(
      user.id,
      essayId,
      body.schoolName,
    );
  }
}
