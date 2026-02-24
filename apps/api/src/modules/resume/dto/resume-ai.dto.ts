import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray } from 'class-validator';

export class AiBulletOptimizeDto {
  @ApiProperty({ description: 'Section ID to optimize bullets for' })
  @IsString()
  sectionId: string;

  @ApiPropertyOptional({ description: 'Specific item ID within section' })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({ description: 'Target school name for context' })
  @IsOptional()
  @IsString()
  targetSchool?: string;

  @ApiPropertyOptional({ description: 'Target major for context' })
  @IsOptional()
  @IsString()
  targetMajor?: string;
}

export class AiResumeReviewDto {
  @ApiPropertyOptional({ description: 'Target school' })
  @IsOptional()
  @IsString()
  targetSchool?: string;

  @ApiPropertyOptional({ description: 'Target major' })
  @IsOptional()
  @IsString()
  targetMajor?: string;
}

export class AiSuggestContentDto {
  @ApiProperty({ description: 'Section type to suggest content for' })
  @IsString()
  sectionType: string;

  @ApiPropertyOptional({ description: 'Target major' })
  @IsOptional()
  @IsString()
  targetMajor?: string;
}

export class CreateSnapshotDto {
  @ApiPropertyOptional({ description: 'Snapshot description/label' })
  @IsOptional()
  @IsString()
  description?: string;
}
