import { Injectable } from '@nestjs/common';
import { ForumCategoryService } from './forum-category.service';
import { ForumPostService } from './forum-post.service';
import { ForumCommentService } from './forum-comment.service';
import { ForumTeamService } from './forum-team.service';
import { ForumReportService } from './forum-report.service';
import {
  CreateCategoryDto,
  CreatePostDto,
  UpdatePostDto,
  CreateCommentDto,
  PostQueryDto,
  TeamApplicationDto,
  ReviewApplicationDto,
  CategoryDto,
  PostDto,
  PostDetailResponseDto,
  PostListResponseDto,
  CommentDto,
} from './dto';

@Injectable()
export class ForumService {
  constructor(
    private categoryService: ForumCategoryService,
    private postService: ForumPostService,
    private commentService: ForumCommentService,
    private teamService: ForumTeamService,
    private reportService: ForumReportService,
  ) {}

  // ============================================
  // Stats
  // ============================================

  async getStats(): Promise<{
    postCount: number;
    userCount: number;
    teamingCount: number;
    activeToday: number;
  }> {
    return this.categoryService.getStats();
  }

  // ============================================
  // Categories
  // ============================================

  async getCategories(): Promise<CategoryDto[]> {
    return this.categoryService.getCategories();
  }

  async createCategory(data: CreateCategoryDto): Promise<CategoryDto> {
    return this.categoryService.createCategory(data);
  }

  // ============================================
  // Posts
  // ============================================

  async getPosts(
    userId: string | null,
    query: PostQueryDto,
  ): Promise<PostListResponseDto> {
    return this.postService.getPosts(userId, query);
  }

  async getPostById(
    postId: string,
    userId: string | null,
  ): Promise<PostDetailResponseDto> {
    return this.postService.getPostById(postId, userId);
  }

  async createPost(
    userId: string,
    data: CreatePostDto,
    locale = 'zh',
  ): Promise<PostDto> {
    return this.postService.createPost(userId, data, locale);
  }

  async updatePost(
    postId: string,
    userId: string,
    data: UpdatePostDto,
  ): Promise<PostDto> {
    return this.postService.updatePost(postId, userId, data);
  }

  async deletePost(postId: string, userId: string): Promise<void> {
    return this.postService.deletePost(postId, userId);
  }

  async likePost(postId: string, userId: string): Promise<{ liked: boolean }> {
    return this.postService.likePost(postId, userId);
  }

  // ============================================
  // Comments
  // ============================================

  async createComment(
    postId: string,
    userId: string,
    data: CreateCommentDto,
  ): Promise<CommentDto> {
    return this.commentService.createComment(postId, userId, data);
  }

  async deleteComment(commentId: string, userId: string): Promise<void> {
    return this.commentService.deleteComment(commentId, userId);
  }

  // ============================================
  // Team Applications
  // ============================================

  async getApplicationsForPost(
    postId: string,
    userId: string,
    role: string,
  ): Promise<
    Array<{
      id: string;
      applicant: {
        id: string;
        name?: string;
        avatar?: string;
        isVerified: boolean;
      };
      message?: string;
      status: string;
      createdAt: Date;
    }>
  > {
    return this.teamService.getApplicationsForPost(postId, userId, role);
  }

  async applyToTeam(
    postId: string,
    userId: string,
    data: TeamApplicationDto,
  ): Promise<{ applied: boolean }> {
    return this.teamService.applyToTeam(postId, userId, data);
  }

  async reviewApplication(
    applicationId: string,
    userId: string,
    data: ReviewApplicationDto,
  ): Promise<void> {
    return this.teamService.reviewApplication(applicationId, userId, data);
  }

  async cancelApplication(
    applicationId: string,
    userId: string,
  ): Promise<void> {
    return this.teamService.cancelApplication(applicationId, userId);
  }

  async leaveTeam(postId: string, userId: string): Promise<void> {
    return this.teamService.leaveTeam(postId, userId);
  }

  async getMyTeams(userId: string): Promise<PostDto[]> {
    return this.teamService.getMyTeams(userId);
  }

  // ============================================
  // Reports
  // ============================================

  async reportPost(
    reporterId: string,
    postId: string,
    reason: string,
    detail?: string,
  ) {
    return this.reportService.reportPost(reporterId, postId, reason, detail);
  }

  async reportComment(
    reporterId: string,
    commentId: string,
    reason: string,
    detail?: string,
  ) {
    return this.reportService.reportComment(
      reporterId,
      commentId,
      reason,
      detail,
    );
  }
}
