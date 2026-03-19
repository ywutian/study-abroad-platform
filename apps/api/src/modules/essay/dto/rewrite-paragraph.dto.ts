import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RewriteParagraphDto {
  @ApiProperty({ description: '要改写的段落' })
  @IsString()
  @MaxLength(5000)
  paragraph: string;

  @ApiPropertyOptional({ description: '改写指令/特殊要求' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instruction?: string;
}
