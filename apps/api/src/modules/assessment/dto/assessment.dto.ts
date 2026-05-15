import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsEnum,
  ValidateNested,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AssessmentTypeEnum {
  MBTI = 'MBTI',
  HOLLAND = 'HOLLAND',
  MAJOR_MATCH = 'MAJOR_MATCH',
}

// ============ Request DTOs ============

export class SubmitAnswerDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  questionId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  answer: string;
}

export class SubmitAssessmentDto {
  @ApiProperty({ enum: AssessmentTypeEnum })
  @IsEnum(AssessmentTypeEnum)
  type: AssessmentTypeEnum;

  @ApiProperty({ type: [SubmitAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers: SubmitAnswerDto[];
}

export class SaveAssessmentDraftDto {
  @ApiProperty({ type: [SubmitAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers: SubmitAnswerDto[];

  @ApiPropertyOptional({ description: 'Zero-based current question index' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  currentQuestionIndex?: number;
}

// ============ Response DTOs ============

export class QuestionOptionDto {
  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'number' }] })
  value: string | number;

  @ApiProperty()
  text: string;

  @ApiProperty()
  textZh: string;
}

export class QuestionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  text: string;

  @ApiProperty()
  textZh: string;

  @ApiProperty({ type: [QuestionOptionDto] })
  options: QuestionOptionDto[];

  @ApiPropertyOptional({ description: 'MBTI/Holland dimension' })
  dimension?: string;
}

export class AssessmentDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: AssessmentTypeEnum })
  type: AssessmentTypeEnum;

  @ApiProperty()
  title: string;

  @ApiProperty()
  titleZh: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  descriptionZh?: string;

  @ApiProperty({ type: [QuestionDto] })
  questions: QuestionDto[];
}

// MBTI 结果
export class MbtiResultDto {
  @ApiProperty({ description: 'e.g. INTJ, ENFP' })
  type: string;

  @ApiProperty({
    description: 'Scores by dimension { E: 30, I: 70, S: 40, N: 60, ... }',
  })
  scores: Record<string, number>;

  @ApiProperty()
  title: string;

  @ApiProperty()
  titleZh: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  descriptionZh: string;

  @ApiProperty({ type: [String] })
  strengths: string[];

  @ApiProperty({ type: [String] })
  careers: string[];

  @ApiProperty({ type: [String] })
  majors: string[];
}

// Holland 结果
export class HollandResultDto {
  @ApiProperty({ description: 'e.g. RIA, ASE' })
  codes: string;

  @ApiProperty({ description: 'Scores by type' })
  scores: Record<string, number>;

  @ApiProperty({ type: [String] })
  types: string[];

  @ApiProperty({ type: [String] })
  typesZh: string[];

  @ApiProperty({ type: [String] })
  fields: string[];

  @ApiProperty({ type: [String] })
  fieldsZh: string[];

  @ApiProperty({ type: [String] })
  majors: string[];
}

// 通用结果
export class AssessmentResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: AssessmentTypeEnum })
  type: AssessmentTypeEnum;

  @ApiPropertyOptional({ type: MbtiResultDto })
  mbtiResult?: MbtiResultDto;

  @ApiPropertyOptional({ type: HollandResultDto })
  hollandResult?: HollandResultDto;

  @ApiProperty()
  completedAt: Date;
}

export class AssessmentDraftDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: AssessmentTypeEnum })
  type: AssessmentTypeEnum;

  @ApiProperty({ type: [SubmitAnswerDto] })
  answers: SubmitAnswerDto[];

  @ApiProperty()
  currentQuestionIndex: number;

  @ApiPropertyOptional()
  expiresAt?: Date | null;

  @ApiProperty()
  updatedAt: Date;
}

export class AssessmentDraftSummaryDto {
  @ApiProperty({ enum: AssessmentTypeEnum })
  type: AssessmentTypeEnum;

  @ApiProperty()
  answerCount: number;

  @ApiProperty()
  currentQuestionIndex: number;

  @ApiProperty()
  updatedAt: Date;
}

export class AssessmentMajorSuggestionDto {
  @ApiProperty()
  major: string;

  @ApiProperty()
  sources: string[];
}

export class AssessmentSummaryDto {
  @ApiPropertyOptional({ type: AssessmentResultDto })
  latestMbti?: AssessmentResultDto;

  @ApiPropertyOptional({ type: AssessmentResultDto })
  latestHolland?: AssessmentResultDto;

  @ApiProperty({ type: [AssessmentDraftSummaryDto] })
  drafts: AssessmentDraftSummaryDto[];

  @ApiProperty()
  historyCount: number;

  @ApiProperty({ type: [String] })
  completedTypes: AssessmentTypeEnum[];

  @ApiProperty({ type: [AssessmentMajorSuggestionDto] })
  majorSuggestions: AssessmentMajorSuggestionDto[];
}

export class AssessmentHistoryDto {
  @ApiProperty({ type: [AssessmentResultDto] })
  results: AssessmentResultDto[];
}
