import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { ResumeTargetContextDto } from './create-resume.dto';

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

  @ApiPropertyOptional({
    description: 'Target school, role, JD, or research context',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ResumeTargetContextDto)
  targetContext?: ResumeTargetContextDto;
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

  @ApiPropertyOptional({
    description: 'Target school, role, JD, or research context',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ResumeTargetContextDto)
  targetContext?: ResumeTargetContextDto;
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

  @ApiPropertyOptional({
    description: 'Target school, role, JD, or research context',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ResumeTargetContextDto)
  targetContext?: ResumeTargetContextDto;
}

export class CreateSnapshotDto {
  @ApiPropertyOptional({ description: 'Snapshot description/label' })
  @IsOptional()
  @MaxLength(2000)
  @IsString()
  description?: string;
}
