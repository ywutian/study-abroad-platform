import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AnalyzeGalleryEssayDto {
  @ApiPropertyOptional({ description: 'School name', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolName?: string;
}
