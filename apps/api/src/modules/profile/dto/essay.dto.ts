import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEssayDto {
  @ApiProperty({ description: 'Essay title' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Essay prompt/Prompt' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  prompt?: string;

  @ApiProperty({ description: 'Essay content' })
  @IsString()
  @MaxLength(50000)
  content: string;

  @ApiPropertyOptional({ description: 'Associated school ID' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Linked essay prompt ID' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  essayPromptId?: string;
}

export class UpdateEssayDto {
  @ApiPropertyOptional({ description: 'Essay title' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Essay prompt/Prompt' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  prompt?: string;

  @ApiPropertyOptional({ description: 'Essay content' })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  content?: string;

  @ApiPropertyOptional({ description: 'Associated school ID' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Linked essay prompt ID' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  essayPromptId?: string;
}

export class CreateEssayRevisionDto {
  @ApiPropertyOptional({ description: 'Snapshot reason' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Snapshot source',
    enum: ['manual', 'autosave', 'ai_apply', 'restore'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['manual', 'autosave', 'ai_apply', 'restore'])
  source?: string;
}

export class UpdateEssaySuggestionDto {
  @ApiProperty({
    description: 'Suggestion status',
    enum: ['PENDING', 'APPLIED', 'REJECTED'],
  })
  @IsString()
  @IsIn(['PENDING', 'APPLIED', 'REJECTED'])
  status: string;
}
