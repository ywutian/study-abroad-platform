import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContinueWritingDto {
  @ApiProperty({ description: '已有的文书内容' })
  @IsString()
  @MaxLength(50000)
  content: string;

  @ApiPropertyOptional({ description: '文书题目' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  prompt?: string;

  @ApiPropertyOptional({ description: '希望的续写方向' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  direction?: string;
}
