import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EssayAiService } from './essay-ai.service';
import {
  EssayPolishRequestDto,
  EssayPolishResponseDto,
  EssayReviewRequestDto,
  EssayReviewResponseDto,
  EssayBrainstormRequestDto,
  EssayBrainstormResponseDto,
} from './dto';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('essay-ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  @ApiOperation({ summary: '获取文书AI处理历史' })
  async getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('essayId') essayId: string,
  ) {
    return this.essayAiService.getEssayAIHistory(user.id, essayId);
  }
}

