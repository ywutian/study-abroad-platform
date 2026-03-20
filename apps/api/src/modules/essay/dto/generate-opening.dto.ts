import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateOpeningDto {
  @ApiProperty({ description: 'Essay prompt' })
  @IsString()
  @MaxLength(500)
  prompt: string;

  @ApiPropertyOptional({ description: 'Student background information' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  background?: string;
}
