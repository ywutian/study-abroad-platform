import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateOpeningDto {
  @ApiProperty({ description: '文书题目' })
  @IsString()
  @MaxLength(500)
  prompt: string;

  @ApiPropertyOptional({ description: '学生背景信息' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  background?: string;
}
