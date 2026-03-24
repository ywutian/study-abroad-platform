import {
  IsString,
  IsOptional,
  IsIn,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const RECOMMENDER_ROLES = [
  'TEACHER',
  'COUNSELOR',
  'COACH',
  'EMPLOYER',
  'OTHER',
] as const;

const LETTER_STATUSES = [
  'NOT_REQUESTED',
  'REQUESTED',
  'IN_PROGRESS',
  'SUBMITTED',
  'CONFIRMED',
] as const;

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

  @ApiProperty({ enum: RECOMMENDER_ROLES })
  @IsIn(RECOMMENDER_ROLES)
  recommenderRole: string;

  @ApiPropertyOptional({ description: 'Subject taught or relationship' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ enum: LETTER_STATUSES })
  @IsOptional()
  @IsIn(LETTER_STATUSES)
  status?: string;

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

  @ApiPropertyOptional({ enum: RECOMMENDER_ROLES })
  @IsOptional()
  @IsIn(RECOMMENDER_ROLES)
  recommenderRole?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ enum: LETTER_STATUSES })
  @IsOptional()
  @IsIn(LETTER_STATUSES)
  status?: string;

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
