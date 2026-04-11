import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminSchoolCommunityRatingActionDto {
  @ApiPropertyOptional({ description: 'Optional moderation reason' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
