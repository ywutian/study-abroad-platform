import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, IsEnum, IsOptional, ValidateNested } from 'class-validator';
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
  questionId: string;

  @ApiProperty()
  @IsString()
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

  @ApiPropertyOptional({ description: 'MBTI/Holland 维度' })
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
  @ApiProperty({ description: '如 INTJ, ENFP' })
  type: string;

  @ApiProperty({ description: '各维度得分 { E: 30, I: 70, S: 40, N: 60, ... }' })
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
  @ApiProperty({ description: '如 RIA, ASE' })
  codes: string;

  @ApiProperty({ description: '各类型得分' })
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

export class AssessmentHistoryDto {
  @ApiProperty({ type: [AssessmentResultDto] })
  results: AssessmentResultDto[];
}


