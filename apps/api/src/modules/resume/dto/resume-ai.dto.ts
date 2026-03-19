import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class AiBulletOptimizeDto {
  @ApiProperty({ description: 'Section ID to optimize bullets for' })
  @MaxLength(500)
  @IsString()
  sectionId: string;

  @ApiPropertyOptional({ description: 'Specific item ID within section' })
  @IsOptional()
  @MaxLength(500)
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({ description: 'Target school name for context' })
  @IsOptional()
  @MaxLength(500)
  @IsString()
  targetSchool?: string;

  @ApiPropertyOptional({ description: 'Target major for context' })
  @IsOptional()
  @MaxLength(500)
  @IsString()
  targetMajor?: string;
}

export class AiResumeReviewDto {
  @ApiPropertyOptional({ description: 'Target school' })
  @IsOptional()
  @MaxLength(500)
  @IsString()
  targetSchool?: string;

  @ApiPropertyOptional({ description: 'Target major' })
  @IsOptional()
  @MaxLength(500)
  @IsString()
  targetMajor?: string;
}

export class AiSuggestContentDto {
  @ApiProperty({ description: 'Section type to suggest content for' })
  @MaxLength(100)
  @IsString()
  sectionType: string;

  @ApiPropertyOptional({ description: 'Target major' })
  @IsOptional()
  @MaxLength(500)
  @IsString()
  targetMajor?: string;
}

export class CreateSnapshotDto {
  @ApiPropertyOptional({ description: 'Snapshot description/label' })
  @IsOptional()
  @MaxLength(2000)
  @IsString()
  description?: string;
}
