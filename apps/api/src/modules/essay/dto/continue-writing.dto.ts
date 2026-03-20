import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContinueWritingDto {
  @ApiProperty({ description: 'Existing essay content' })
  @IsString()
  @MaxLength(50000)
  content: string;

  @ApiPropertyOptional({ description: 'Essay prompt' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  prompt?: string;

  @ApiPropertyOptional({ description: 'Desired continuation direction' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  direction?: string;
}
