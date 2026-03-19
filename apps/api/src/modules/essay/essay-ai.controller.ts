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
  AnalyzeGalleryEssayDto,
  RewriteParagraphDto,
  ContinueWritingDto,
  GenerateOpeningDto,
} from './dto';
import { EssayGalleryService } from './essay-gallery.service';
import { CurrentUser, Public } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ThrottleAI } from '../../common/decorators/throttle.decorator';

@ApiTags('essay-ai')
@ThrottleAI()
@Controller('essay-ai')
export class EssayAiController {
  constructor(
    private readonly essayAiService: EssayAiService,
    private readonly essayGalleryService: EssayGalleryService,
  ) {}

  @Post('polish')
  @ApiOperation({ summary: 'AI文书润色 - 消耗20积分' })
  @ApiResponse({ status: 200, type: EssayPolishResponseDto })
  async polishEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: EssayPolishRequestDto,
  ): Promise<EssayPolishResponseDto> {
    return this.essayAiService.polishEssay(user.id, dto, user.locale);
  }

  @Post('review')
  @ApiOperation({ summary: 'AI文书点评（招生官视角） - 消耗30积分' })
  @ApiResponse({ status: 200, type: EssayReviewResponseDto })
  async reviewEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: EssayReviewRequestDto,
  ): Promise<EssayReviewResponseDto> {
    return this.essayAiService.reviewEssay(user.id, dto, user.locale);
  }

  @Post('brainstorm')
  @ApiOperation({ summary: 'AI文书创意生成 - 消耗15积分' })
  @ApiResponse({ status: 200, type: EssayBrainstormResponseDto })
  async brainstormIdeas(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: EssayBrainstormRequestDto,
  ): Promise<EssayBrainstormResponseDto> {
    return this.essayAiService.brainstormIdeas(user.id, dto, user.locale);
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

  @Post('rewrite-paragraph')
  @ApiOperation({ summary: 'AI段落改写 - 生成3个不同风格版本' })
  async rewriteParagraph(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RewriteParagraphDto,
  ) {
    return this.essayAiService.rewriteParagraph(
      dto.paragraph,
      dto.instruction,
      user.locale,
    );
  }

  @Post('continue-writing')
  @ApiOperation({ summary: 'AI续写文书 - 根据上下文继续写作' })
  async continueWriting(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ContinueWritingDto,
  ) {
    return this.essayAiService.continueWriting(
      dto.content,
      dto.prompt,
      dto.direction,
      user.locale,
    );
  }

  @Post('generate-opening')
  @ApiOperation({ summary: 'AI生成文书开头 - 3个不同风格' })
  async generateOpening(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: GenerateOpeningDto,
  ) {
    return this.essayAiService.generateOpening(
      dto.prompt,
      dto.background,
      user.locale,
    );
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
    const validTypes = [
      'COMMON_APP',
      'UC',
      'SUPPLEMENTAL',
      'WHY_SCHOOL',
      'OTHER',
    ] as const;
    const validResults = [
      'ADMITTED',
      'REJECTED',
      'WAITLISTED',
      'DEFERRED',
    ] as const;
    const validSortBy = ['newest', 'popular'] as const;

    return this.essayGalleryService.getGalleryEssays({
      school,
      type: validTypes.includes(type as (typeof validTypes)[number])
        ? (type as (typeof validTypes)[number])
        : undefined,
      promptNumber: promptNumber ? parseInt(promptNumber, 10) : undefined,
      year: year ? parseInt(year, 10) : undefined,
      result: validResults.includes(result as (typeof validResults)[number])
        ? (result as (typeof validResults)[number])
        : undefined,
      rankMin: rankMin ? parseInt(rankMin, 10) : undefined,
      rankMax: rankMax ? parseInt(rankMax, 10) : undefined,
      isVerified: isVerified === 'true',
      sortBy: validSortBy.includes(sortBy as (typeof validSortBy)[number])
        ? (sortBy as (typeof validSortBy)[number])
        : undefined,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? Math.min(parseInt(pageSize, 10), 50) : 12,
    });
  }

  @Get('gallery/:essayId')
  @Public()
  @ApiOperation({ summary: '获取单篇公开文书详情' })
  async getGalleryEssayDetail(@Param('essayId') essayId: string) {
    return this.essayGalleryService.getGalleryEssayDetail(essayId);
  }

  @Post('gallery/:essayId/analyze')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '逐段分析公开文书 - 消耗20积分' })
  async analyzeGalleryEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Param('essayId') essayId: string,
    @Body() body: AnalyzeGalleryEssayDto,
  ) {
    return this.essayGalleryService.analyzeGalleryEssay(
      user.id,
      essayId,
      body.schoolName,
      user.locale,
    );
  }
}
