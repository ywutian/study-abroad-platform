import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, IsArray, IsEnum, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ============ Enums ============

export enum PostSortBy {
  LATEST = 'latest',
  POPULAR = 'popular',
  COMMENTS = 'comments',
}

// ============ Request DTOs ============

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nameZh: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionZh?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreatePostDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

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
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
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
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;
}

export class PostQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isTeamPost?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
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

export class TeamApplicationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}

export class ReviewApplicationDto {
  @ApiProperty({ enum: ['ACCEPTED', 'REJECTED'] })
  @IsEnum(['ACCEPTED', 'REJECTED'])
  status: 'ACCEPTED' | 'REJECTED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
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

export class PostDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  categoryId: string;

  @ApiProperty({ type: CategoryDto })
  category?: CategoryDto;

  @ApiProperty({ type: AuthorDto })
  author: AuthorDto;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ type: [String] })
  tags: string[];

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



