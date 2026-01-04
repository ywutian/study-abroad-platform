import { IsString, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEssayDto {
  @ApiProperty({ description: '文书标题' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: '文书题目/Prompt' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  prompt?: string;

  @ApiProperty({ description: '文书内容' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: '关联学校ID' })
  @IsOptional()
  @IsString()
  schoolId?: string;
}

export class UpdateEssayDto {
  @ApiPropertyOptional({ description: '文书标题' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: '文书题目/Prompt' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  prompt?: string;

  @ApiPropertyOptional({ description: '文书内容' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '关联学校ID' })
  @IsOptional()
  @IsString()
  schoolId?: string;
}




