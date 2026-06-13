import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  SocialBulkAction,
  SocialRelationSort,
  SocialRelationType,
  SocialRelationshipFilter,
  SocialRoleFilter,
} from '@study-abroad/shared';

const RELATION_TYPES: SocialRelationType[] = [
  'followers',
  'following',
  'blocked',
];
const RELATION_SORTS: SocialRelationSort[] = ['recent', 'name', 'major'];
const RELATIONSHIP_FILTERS: SocialRelationshipFilter[] = [
  'all',
  'mutual',
  'oneWay',
];
const ROLE_FILTERS: SocialRoleFilter[] = ['all', 'verified', 'staff'];
const BULK_ACTIONS: SocialBulkAction[] = [
  'follow',
  'unfollow',
  'block',
  'unblock',
];

export class SocialRelationsQueryDto {
  @ApiPropertyOptional({ enum: RELATION_TYPES, default: 'followers' })
  @IsOptional()
  @IsIn(RELATION_TYPES)
  type?: SocialRelationType = 'followers';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: RELATION_SORTS, default: 'recent' })
  @IsOptional()
  @IsIn(RELATION_SORTS)
  sort?: SocialRelationSort = 'recent';

  @ApiPropertyOptional({ enum: RELATIONSHIP_FILTERS, default: 'all' })
  @IsOptional()
  @IsIn(RELATIONSHIP_FILTERS)
  relationship?: SocialRelationshipFilter = 'all';

  @ApiPropertyOptional({ enum: ROLE_FILTERS, default: 'all' })
  @IsOptional()
  @IsIn(ROLE_FILTERS)
  role?: SocialRoleFilter = 'all';
}

export class SocialBulkDto {
  @ApiProperty({ enum: BULK_ACTIONS })
  @IsIn(BULK_ACTIONS)
  action!: SocialBulkAction;

  @ApiProperty({ type: [String], maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  // @arraysize-literal-allowed: bulk action over an already-bounded selection, not a curated list
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  userIds!: string[];
}
