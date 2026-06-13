import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsEnum,
  IsDateString,
  ValidateNested,
  ArrayMaxSize,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_FORUM_POST_TAGS } from '@study-abroad/shared';

// ============ Enums ============

export enum PostSortBy {
  LATEST = 'latest',
  POPULAR = 'popular',
  COMMENTS = 'comments',
  RECOMMENDED = 'recommended',
}

export enum PostFeed {
  POPULAR = 'popular',
  LATEST = 'latest',
  HOME = 'home',
}

export enum CommunityScope {
  MINE = 'mine',
  POPULAR = 'popular',
  ALL = 'all',
}

// 举报Reason
export enum ReportReason {
  SPAM = 'spam',
  INAPPROPRIATE = 'inappropriate',
  HARASSMENT = 'harassment',
  FALSE_INFO = 'false_info',
  OTHER = 'other',
}

// ============ Request DTOs ============

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameZh: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionZh?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateCommunityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class CommunityQueryDto {
  @ApiPropertyOptional({ enum: CommunityScope })
  @IsOptional()
  @IsEnum(CommunityScope)
  scope?: CommunityScope = CommunityScope.POPULAR;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class ForumImageInputDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  key: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  url: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mimeType: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  size: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;
}

export class CreatePostDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  categoryId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  communityId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  content?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @ArrayMaxSize(MAX_FORUM_POST_TAGS)
  tags?: string[];

  @ApiPropertyOptional({ type: [ForumImageInputDto] })
  @IsOptional()
  @IsArray()
  // @arraysize-literal-allowed: post images, UI upload-capped
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ForumImageInputDto)
  images?: ForumImageInputDto[];

  // 组队帖子字段
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isTeamPost?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(20)
  teamSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  requirements?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  teamDeadline?: string;
}

export class UpdatePostDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  content?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @ArrayMaxSize(MAX_FORUM_POST_TAGS)
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  requirements?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  teamDeadline?: string;
}

export class CreateCommentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  parentId?: string;
}

export class PostQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  communityId?: string;

  @ApiPropertyOptional({ enum: PostFeed })
  @IsOptional()
  @IsEnum(PostFeed)
  feed?: PostFeed;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isTeamPost?: boolean;

  @ApiPropertyOptional({ description: 'Post tag filter' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  postTag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: PostSortBy })
  @IsOptional()
  @IsEnum(PostSortBy)
  sortBy?: PostSortBy = PostSortBy.LATEST;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  offset?: number = 0;
}

// 举报 DTO
export class CreateReportDto {
  @ApiProperty({ enum: ReportReason, description: 'Report reason' })
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiPropertyOptional({ description: 'Additional details' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  detail?: string;
}

export class TeamApplicationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;

  @ApiPropertyOptional({
    description: 'Resume ID to attach to the application',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  resumeId?: string;
}

export class ReviewApplicationDto {
  @ApiProperty({ enum: ['ACCEPTED', 'REJECTED'] })
  @IsEnum(['ACCEPTED', 'REJECTED'])
  status: 'ACCEPTED' | 'REJECTED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// ============ Response DTOs ============

export class CategoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  nameZh: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  descriptionZh?: string;

  @ApiPropertyOptional()
  icon?: string;

  @ApiPropertyOptional()
  color?: string;

  @ApiProperty()
  postCount: number;
}

export class CommunityDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  postCount: number;

  @ApiProperty()
  followerCount: number;

  @ApiProperty()
  isOfficial: boolean;

  @ApiProperty()
  isFollowing: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class AuthorDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  avatar?: string;

  @ApiProperty()
  isVerified: boolean;
}

export class ForumImageDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  url: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  size: number;

  @ApiPropertyOptional()
  width?: number;

  @ApiPropertyOptional()
  height?: number;

  @ApiProperty()
  sortOrder: number;
}

export class PostDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  categoryId: string;

  @ApiProperty({ type: CategoryDto })
  category?: CategoryDto;

  @ApiPropertyOptional({ type: CommunityDto })
  community?: CommunityDto;

  @ApiPropertyOptional()
  communityId?: string;

  @ApiProperty({ type: AuthorDto })
  author: AuthorDto;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({ type: [ForumImageDto] })
  images: ForumImageDto[];

  @ApiProperty()
  isTeamPost: boolean;

  @ApiPropertyOptional()
  teamSize?: number;

  @ApiPropertyOptional()
  currentSize?: number;

  @ApiPropertyOptional()
  requirements?: string;

  @ApiPropertyOptional()
  teamDeadline?: Date;

  @ApiPropertyOptional()
  teamStatus?: string;

  @ApiProperty()
  viewCount: number;

  @ApiProperty()
  likeCount: number;

  @ApiProperty()
  commentCount: number;

  @ApiProperty()
  isPinned: boolean;

  @ApiProperty()
  isLocked: boolean;

  @ApiProperty()
  isLiked: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CommentDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: AuthorDto })
  author: AuthorDto;

  @ApiProperty()
  content: string;

  @ApiPropertyOptional()
  parentId?: string;

  @ApiProperty()
  likeCount: number;

  @ApiProperty({ type: [CommentDto] })
  replies?: CommentDto[];

  @ApiProperty()
  createdAt: Date;
}

export class TeamMemberDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: AuthorDto })
  user: AuthorDto;

  @ApiProperty()
  role: string;

  @ApiProperty()
  joinedAt: Date;
}

export class TeamApplicationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: AuthorDto })
  applicant: AuthorDto;

  @ApiPropertyOptional()
  message?: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;
}

export class PostListResponseDto {
  @ApiProperty({ type: [PostDto] })
  posts: PostDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  hasMore: boolean;
}

export class PostDetailResponseDto extends PostDto {
  @ApiProperty({ type: [CommentDto] })
  comments: CommentDto[];

  @ApiPropertyOptional({ type: [TeamMemberDto] })
  teamMembers?: TeamMemberDto[];

  @ApiPropertyOptional({ type: [TeamApplicationResponseDto] })
  teamApplications?: TeamApplicationResponseDto[];
}
