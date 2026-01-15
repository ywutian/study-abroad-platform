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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ForumService } from './forum.service';
import {
  CreateCategoryDto,
  CreatePostDto,
  UpdatePostDto,
  CreateCommentDto,
  PostQueryDto,
  TeamApplicationDto,
  ReviewApplicationDto,
  CreateReportDto,
  CategoryDto,
  PostDto,
  PostDetailResponseDto,
  PostListResponseDto,
} from './dto';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Role } from '@prisma/client';

@ApiTags('forum')
@Controller('forum')
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
    return this.forumService.createPost(user.id, data);
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
  @ApiOperation({ summary: '举报帖子' })
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
  @ApiOperation({ summary: '举报评论' })
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
