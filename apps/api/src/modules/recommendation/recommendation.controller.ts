import {
  Controller,
  Post,
  Get,
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
} from '@nestjs/swagger';
import { RecommendationService } from './recommendation.service';
import {
  SchoolRecommendationRequestDto,
  SchoolRecommendationResponseDto,
} from './dto';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ThrottleAI } from '../../common/decorators/throttle.decorator';

@ApiTags('recommendation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ThrottleAI()
@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Post()
  @ApiOperation({
    summary: 'Generate AI school recommendation - costs 25 points',
  })
  @ApiResponse({ status: 200, type: SchoolRecommendationResponseDto })
  async generateRecommendation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SchoolRecommendationRequestDto,
  ): Promise<SchoolRecommendationResponseDto> {
    return this.recommendationService.generateRecommendation(
      user.id,
      dto,
      user.locale,
    );
  }

  @Get('preflight')
  @ApiOperation({
    summary: 'Pre-check if user can generate school recommendation',
  })
  async preflight(@CurrentUser() user: CurrentUserPayload) {
    return this.recommendationService.checkPreflight(user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get school recommendation history' })
  @ApiResponse({ status: 200, type: [SchoolRecommendationResponseDto] })
  async getHistory(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<SchoolRecommendationResponseDto[]> {
    return this.recommendationService.getRecommendationHistory(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single recommendation details' })
  @ApiResponse({ status: 200, type: SchoolRecommendationResponseDto })
  async getById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<SchoolRecommendationResponseDto> {
    return this.recommendationService.getRecommendationById(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete school recommendation record' })
  async deleteRecommendation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.recommendationService.deleteRecommendation(user.id, id);
    return { message: 'Recommendation deleted' };
  }
}
