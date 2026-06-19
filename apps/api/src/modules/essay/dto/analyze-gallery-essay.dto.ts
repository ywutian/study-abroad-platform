import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class AnalyzeGalleryEssayDto {
  @ApiPropertyOptional({ description: 'School name', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolName?: string;
}

export class GalleryEssayQuestionDto {
  @ApiPropertyOptional({
    description: 'Question about the public gallery essay',
    maxLength: 800,
  })
  @IsString()
  @MaxLength(800)
  question!: string;

  @ApiPropertyOptional({
    description:
      '0-based paragraph index when the question targets a paragraph',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  paragraphIndex?: number;

  @ApiPropertyOptional({
    description: 'Optional selected text from the public essay',
    maxLength: 1200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1200)
  selectedText?: string;

  @ApiPropertyOptional({
    description: 'Client-generated idempotency key for this question request',
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  clientRequestId?: string;
}

export class GalleryEssayCompareDto {
  @ApiPropertyOptional({
    description: 'User-owned Essay id to compare with this gallery essay',
  })
  @IsString()
  @MaxLength(128)
  userEssayId!: string;

  @ApiPropertyOptional({
    description: 'Optional comparison focus',
    enum: ['theme', 'structure', 'voice', 'schoolFit', 'revisionPlan'],
  })
  @IsOptional()
  @IsIn(['theme', 'structure', 'voice', 'schoolFit', 'revisionPlan'])
  focus?: 'theme' | 'structure' | 'voice' | 'schoolFit' | 'revisionPlan';

  @ApiPropertyOptional({
    description: 'Client-generated idempotency key for this compare request',
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  clientRequestId?: string;
}

export class GalleryEssayInteractionFeedbackDto {
  @ApiPropertyOptional({
    description: 'Feedback sentiment',
    enum: ['HELPFUL', 'NOT_HELPFUL'],
  })
  @IsIn(['HELPFUL', 'NOT_HELPFUL'])
  sentiment!: 'HELPFUL' | 'NOT_HELPFUL';

  @ApiPropertyOptional({
    description: 'Optional negative-feedback reason',
    enum: [
      'wrong_evidence',
      'too_generic',
      'template_like',
      'cost_not_worth',
      'other',
    ],
  })
  @IsOptional()
  @IsIn([
    'wrong_evidence',
    'too_generic',
    'template_like',
    'cost_not_worth',
    'other',
  ])
  category?:
    | 'wrong_evidence'
    | 'too_generic'
    | 'template_like'
    | 'cost_not_worth'
    | 'other';

  @ApiPropertyOptional({
    description: 'Optional free-form feedback note',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
