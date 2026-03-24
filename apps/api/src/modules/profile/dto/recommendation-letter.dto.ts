import {
  IsString,
  IsOptional,
  IsIn,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecommenderRole, RecommendationLetterStatus } from '@prisma/client';

const RECOMMENDER_ROLES = Object.values(RecommenderRole);
const LETTER_STATUSES = Object.values(RecommendationLetterStatus);

export class CreateRecommendationLetterDto {
  @ApiProperty({ description: 'Recommender name', example: 'Dr. Smith' })
  @IsString()
  @MaxLength(200)
  recommenderName: string;

  @ApiPropertyOptional({ description: 'Recommender email' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  recommenderEmail?: string;

  @ApiProperty({ enum: RecommenderRole })
  @IsIn(RECOMMENDER_ROLES)
  recommenderRole: RecommenderRole;

  @ApiPropertyOptional({ description: 'Subject taught or relationship' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ enum: RecommendationLetterStatus })
  @IsOptional()
  @IsIn(LETTER_STATUSES)
  status?: RecommendationLetterStatus;

  @ApiPropertyOptional({ description: 'Due date for the letter' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Notes about this recommendation' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateRecommendationLetterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  recommenderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  recommenderEmail?: string;

  @ApiPropertyOptional({ enum: RecommenderRole })
  @IsOptional()
  @IsIn(RECOMMENDER_ROLES)
  recommenderRole?: RecommenderRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ enum: RecommendationLetterStatus })
  @IsOptional()
  @IsIn(LETTER_STATUSES)
  status?: RecommendationLetterStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
