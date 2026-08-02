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
  EssaySuggestEditsRequestDto,
  EssaySuggestEditsResponseDto,
  AnalyzeGalleryEssayDto,
  GalleryEssayCompareDto,
  GalleryEssayInteractionFeedbackDto,
  GalleryEssayQuestionDto,
  RewriteParagraphDto,
  ContinueWritingDto,
  GenerateOpeningDto,
  OptimizeActivityDescriptionDto,
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
  @ApiOperation({ summary: 'AI essay polish' })
  @ApiResponse({ status: 200, type: EssayPolishResponseDto })
  async polishEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: EssayPolishRequestDto,
  ): Promise<EssayPolishResponseDto> {
    return this.essayAiService.polishEssay(user.id, dto, user.locale);
  }

  @Post('review')
  @ApiOperation({
    summary: 'AI essay review (admissions officer perspective)',
  })
  @ApiResponse({ status: 200, type: EssayReviewResponseDto })
  async reviewEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: EssayReviewRequestDto,
  ): Promise<EssayReviewResponseDto> {
    return this.essayAiService.reviewEssay(user.id, dto, user.locale);
  }

  @Post('suggest-edits')
  @ApiOperation({
    summary: 'AI essay edit suggestions',
  })
  @ApiResponse({ status: 200, type: EssaySuggestEditsResponseDto })
  async suggestEdits(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: EssaySuggestEditsRequestDto,
  ): Promise<EssaySuggestEditsResponseDto> {
    return this.essayAiService.suggestEdits(user.id, dto, user.locale);
  }

  @Post('brainstorm')
  @ApiOperation({ summary: 'AI essay brainstorm' })
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
  @ApiOperation({ summary: 'Get essay AI processing history' })
  async getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('essayId') essayId: string,
  ) {
    return this.essayAiService.getEssayAIHistory(user.id, essayId);
  }

  @Post('rewrite-paragraph')
  @ApiOperation({
    summary: 'AI paragraph rewrite - generates 3 different style versions',
  })
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
  @ApiOperation({ summary: 'AI continue writing essay - based on context' })
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
  @ApiOperation({ summary: 'AI generate essay opening - 3 different styles' })
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

  @Post('activity-description')
  @ApiOperation({
    summary: 'Optimize activity description for Common App 150-char limit',
  })
  async optimizeActivityDescription(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: OptimizeActivityDescriptionDto,
  ) {
    return this.essayAiService.optimizeActivityDescription(
      dto.description,
      dto.activityName,
      dto.role,
      user.locale,
    );
  }

  // ============ 文书画廊 (P1) ============

  @Get('gallery')
  @Public()
  @ApiOperation({ summary: 'Get public outstanding essay list' })
  @ApiQuery({
    name: 'school',
    required: false,
    description: 'Search by school name',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Essay type: COMMON_APP, UC, SUPPLEMENTAL, WHY_SCHOOL, OTHER',
  })
  @ApiQuery({
    name: 'promptNumber',
    required: false,
    description: 'Common App 1-7 or UC PIQ 1-4',
  })
  @ApiQuery({ name: 'year', required: false, description: 'Application year' })
  @ApiQuery({
    name: 'result',
    required: false,
    description: 'Admission result: ADMITTED, REJECTED, WAITLISTED, DEFERRED',
  })
  @ApiQuery({
    name: 'rankMin',
    required: false,
    description: 'Minimum school rank',
  })
  @ApiQuery({
    name: 'rankMax',
    required: false,
    description: 'Maximum school rank',
  })
  @ApiQuery({
    name: 'isVerified',
    required: false,
    description: 'Show verified only',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Sort by: newest, popular',
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

  /**
   * Rejected/Waitlisted essay feed for the "文书避雷" tab.
   *
   * Editorial rule: only self-uploaded rejected essays land here — the
   * harvest pipeline never touches rejections. At launch this is expected
   * to return 0 items; the frontend shows the empty-state CTA inviting
   * learners to submit their own retrospective.
   */
  @Get('gallery/rejected')
  @Public()
  @ApiOperation({ summary: 'Get self-uploaded rejected/waitlisted essays' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async getRejectedGalleryEssays(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.essayGalleryService.getRejectedEssays({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? Math.min(parseInt(pageSize, 10), 50) : 20,
    });
  }

  @Get('gallery/:essayId')
  @Public()
  @ApiOperation({ summary: 'Get single public essay details' })
  async getGalleryEssayDetail(@Param('essayId') essayId: string) {
    return this.essayGalleryService.getGalleryEssayDetail(essayId);
  }

  @Get('gallery/:essayId/learning-notes')
  @Public()
  @ApiOperation({
    summary:
      'Get free cached learning notes for a public essay without LLM usage',
  })
  async getGalleryLearningNotes(
    @Param('essayId') essayId: string,
    @Query('locale') locale?: string,
  ) {
    return this.essayGalleryService.getGalleryLearningNotes(
      essayId,
      locale === 'en' ? 'en' : 'zh',
    );
  }

  @Get('gallery/:essayId/interactions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get current user history for personalized gallery essay AI',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'question | compare',
  })
  @ApiQuery({ name: 'limit', required: false })
  async getGalleryEssayInteractions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('essayId') essayId: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    return this.essayGalleryService.listGalleryEssayInteractions(
      user.id,
      essayId,
      {
        type,
        limit: limit ? parseInt(limit, 10) : undefined,
      },
    );
  }

  @Post('gallery/interactions/:interactionId/feedback')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Upsert helpful/not helpful feedback for gallery essay AI',
  })
  async submitGalleryEssayInteractionFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Param('interactionId') interactionId: string,
    @Body() body: GalleryEssayInteractionFeedbackDto,
  ) {
    return this.essayGalleryService.submitGalleryInteractionFeedback(
      user.id,
      interactionId,
      body,
    );
  }

  @Post('gallery/:essayId/questions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Ask a grounded question about a public gallery essay',
  })
  async askGalleryEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Param('essayId') essayId: string,
    @Body() body: GalleryEssayQuestionDto,
  ) {
    return this.essayGalleryService.askGalleryEssay(
      user.id,
      essayId,
      body,
      user.locale,
    );
  }

  @Post('gallery/:essayId/compare')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Compare a user-owned essay against a public gallery essay reference',
  })
  async compareGalleryEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Param('essayId') essayId: string,
    @Body() body: GalleryEssayCompareDto,
  ) {
    return this.essayGalleryService.compareGalleryEssay(
      user.id,
      essayId,
      body,
      user.locale,
    );
  }

  @Post('gallery/:essayId/analyze')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Paragraph-by-paragraph analysis of public essay',
  })
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
