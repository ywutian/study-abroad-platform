import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ForbiddenException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { ForumService } from './forum.service';
import {
  CreateCategoryDto,
  CreateCommunityDto,
  CreatePostDto,
  UpdatePostDto,
  CreateCommentDto,
  CommunityQueryDto,
  PostQueryDto,
  TeamApplicationDto,
  ReviewApplicationDto,
  CreateReportDto,
  CategoryDto,
  CommunityDto,
  ForumImageInputDto,
  PostDto,
  PostDetailResponseDto,
  PostListResponseDto,
  TeamApplicationResponseDto,
} from './dto';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Role } from '@prisma/client';

@ApiTags('forum')
@Controller('forums')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  // ============================================
  // Stats
  // ============================================

  @Get('stats')
  @Public()
  @ApiOperation({ summary: 'Get forum statistics' })
  async getStats(): Promise<{
    postCount: number;
    userCount: number;
    teamingCount: number;
    activeToday: number;
  }> {
    return this.forumService.getStats();
  }

  // ============================================
  // Categories
  // ============================================

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'Get all forum categories' })
  @ApiResponse({ status: 200, type: [CategoryDto] })
  async getCategories(): Promise<CategoryDto[]> {
    return this.forumService.getCategories();
  }

  @Post('categories')
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new category (Admin only)' })
  @ApiResponse({ status: 201, type: CategoryDto })
  async createCategory(@Body() data: CreateCategoryDto): Promise<CategoryDto> {
    return this.forumService.createCategory(data);
  }

  // ============================================
  // Communities
  // ============================================

  @Get('communities')
  @Public()
  @ApiOperation({ summary: 'Get forum communities' })
  @ApiResponse({ status: 200, type: [CommunityDto] })
  async getCommunities(
    @CurrentUser() user: CurrentUserPayload | null,
    @Query() query: CommunityQueryDto,
  ): Promise<CommunityDto[]> {
    return this.forumService.getCommunities(user?.id || null, query);
  }

  @Post('communities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a forum community' })
  @ApiResponse({ status: 201, type: CommunityDto })
  async createCommunity(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateCommunityDto,
  ): Promise<CommunityDto> {
    return this.forumService.createCommunity(user.id, data);
  }

  @Post('communities/:id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a forum community' })
  @ApiResponse({ status: 200, type: CommunityDto })
  async followCommunity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') communityId: string,
  ): Promise<CommunityDto> {
    return this.forumService.followCommunity(user.id, communityId);
  }

  @Delete('communities/:id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow a forum community' })
  @ApiResponse({ status: 200, type: CommunityDto })
  async unfollowCommunity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') communityId: string,
  ): Promise<CommunityDto> {
    return this.forumService.unfollowCommunity(user.id, communityId);
  }

  @Post('uploads/images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('images', 6, {
      limits: { files: 6, fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload forum post images' })
  async uploadImages(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ForumImageInputDto[]> {
    return this.forumService.uploadImages(user.id, files);
  }

  // ============================================
  // Posts
  // ============================================

  @Get('posts')
  @Public()
  @ApiOperation({ summary: 'Get forum posts' })
  @ApiResponse({ status: 200, type: PostListResponseDto })
  async getPosts(
    @CurrentUser() user: CurrentUserPayload | null,
    @Query() query: PostQueryDto,
  ): Promise<PostListResponseDto> {
    return this.forumService.getPosts(user?.id || null, query);
  }

  @Get('posts/:id/applications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List team applications for a post (author or admin only)',
  })
  @ApiResponse({ status: 200, type: [TeamApplicationResponseDto] })
  async getPostApplications(
    @Param('id') postId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<TeamApplicationResponseDto[]> {
    return this.forumService.getApplicationsForPost(postId, user.id, user.role);
  }

  @Get('posts/:id')
  @Public()
  @ApiOperation({ summary: 'Get post details' })
  @ApiResponse({ status: 200, type: PostDetailResponseDto })
  async getPostById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload | null,
  ): Promise<PostDetailResponseDto> {
    return this.forumService.getPostById(id, user?.id || null);
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({ status: 201, type: PostDto })
  async createPost(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreatePostDto,
  ): Promise<PostDto> {
    if (
      data.isTeamPost &&
      user.role !== Role.VERIFIED &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'Only verified users can create team posts. Please complete identity verification first.',
      );
    }
    return this.forumService.createPost(user.id, data, user.locale);
  }

  @Put('posts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a post' })
  @ApiResponse({ status: 200, type: PostDto })
  async updatePost(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: UpdatePostDto,
  ): Promise<PostDto> {
    return this.forumService.updatePost(id, user.id, data);
  }

  @Delete('posts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a post' })
  async deletePost(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ success: boolean }> {
    await this.forumService.deletePost(id, user.id);
    return { success: true };
  }

  @Post('posts/:id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like/Unlike a post' })
  async likePost(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ liked: boolean }> {
    return this.forumService.likePost(id, user.id);
  }

  // ============================================
  // Comments
  // ============================================

  @Post('posts/:id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a comment to a post' })
  async createComment(
    @Param('id') postId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateCommentDto,
  ) {
    return this.forumService.createComment(postId, user.id, data);
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a comment' })
  async deleteComment(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ success: boolean }> {
    await this.forumService.deleteComment(id, user.id);
    return { success: true };
  }

  // ============================================
  // Team Features
  // ============================================

  @Post('posts/:id/apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Apply to join a team' })
  async applyToTeam(
    @Param('id') postId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: TeamApplicationDto,
  ): Promise<{ applied: boolean }> {
    return this.forumService.applyToTeam(postId, user.id, data);
  }

  @Post('applications/:id/review')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Review a team application' })
  async reviewApplication(
    @Param('id') applicationId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: ReviewApplicationDto,
  ): Promise<{ success: boolean }> {
    await this.forumService.reviewApplication(applicationId, user.id, data);
    return { success: true };
  }

  @Post('applications/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a team application' })
  async cancelApplication(
    @Param('id') applicationId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ success: boolean }> {
    await this.forumService.cancelApplication(applicationId, user.id);
    return { success: true };
  }

  @Post('posts/:id/leave')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Leave a team' })
  async leaveTeam(
    @Param('id') postId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ success: boolean }> {
    await this.forumService.leaveTeam(postId, user.id);
    return { success: true };
  }

  @Get('my-teams')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get teams I joined' })
  @ApiResponse({ status: 200, type: [PostDto] })
  async getMyTeams(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<PostDto[]> {
    return this.forumService.getMyTeams(user.id);
  }

  // ============================================
  // Reports
  // ============================================

  @Post('posts/:id/report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report post' })
  async reportPost(
    @Param('id') postId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateReportDto,
  ): Promise<{ success: boolean }> {
    await this.forumService.reportPost(
      user.id,
      postId,
      data.reason,
      data.detail,
    );
    return { success: true };
  }

  @Post('comments/:id/report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report comment' })
  async reportComment(
    @Param('id') commentId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateReportDto,
  ): Promise<{ success: boolean }> {
    await this.forumService.reportComment(
      user.id,
      commentId,
      data.reason,
      data.detail,
    );
    return { success: true };
  }
}
