import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { PeerReviewService } from './peer-review.service';
import {
  CreatePeerReviewDto,
  SubmitReviewDto,
  PeerReviewDto,
  UserRatingDto,
  PeerReviewListDto,
} from './dto';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('peer-review')
@Controller('peer-review')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PeerReviewController {
  constructor(private readonly peerReviewService: PeerReviewService) {}

  @Post('request/:userId')
  @UseGuards(RolesGuard)
  @Roles(Role.VERIFIED, Role.ADMIN)
  @ApiOperation({ summary: '发起互评请求 (仅认证用户)' })
  @ApiResponse({ status: 201, type: PeerReviewDto })
  async requestReview(
    @CurrentUser() user: CurrentUserPayload,
    @Param('userId') targetUserId: string,
    @Body() data: CreatePeerReviewDto,
  ): Promise<PeerReviewDto> {
    return this.peerReviewService.requestReview(user.id, targetUserId, data);
  }

  @Post(':id/submit')
  @UseGuards(RolesGuard)
  @Roles(Role.VERIFIED, Role.ADMIN)
  @ApiOperation({ summary: '提交评价' })
  @ApiResponse({ status: 200, type: PeerReviewDto })
  async submitReview(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') reviewId: string,
    @Body() data: SubmitReviewDto,
  ): Promise<PeerReviewDto> {
    return this.peerReviewService.submitReview(user.id, reviewId, data);
  }

  @Get('my-reviews')
  @ApiOperation({ summary: '获取我的互评记录' })
  @ApiResponse({ status: 200, type: PeerReviewListDto })
  async getMyReviews(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<PeerReviewListDto> {
    return this.peerReviewService.getMyReviews(user.id);
  }

  @Get('user/:userId/rating')
  @ApiOperation({ summary: '获取用户评分' })
  @ApiResponse({ status: 200, type: UserRatingDto })
  async getUserRating(@Param('userId') userId: string): Promise<UserRatingDto> {
    return this.peerReviewService.getUserRating(userId);
  }

  @Get('user/:userId/reviews')
  @ApiOperation({ summary: '获取用户收到的评价列表' })
  @ApiResponse({ status: 200, type: PeerReviewListDto })
  async getUserReviews(
    @Param('userId') userId: string,
  ): Promise<PeerReviewListDto> {
    return this.peerReviewService.getUserReviews(userId);
  }
}
