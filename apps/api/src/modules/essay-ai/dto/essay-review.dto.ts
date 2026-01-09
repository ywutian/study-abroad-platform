import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class EssayReviewRequestDto {
  @ApiProperty({ description: '文书ID' })
  @IsString()
  @IsNotEmpty()
  essayId: string;

  @ApiProperty({ description: '目标学校名称（可选）', required: false })
  @IsString()
  @IsOptional()
  schoolName?: string;

  @ApiProperty({ description: '目标专业（可选）', required: false })
  @IsString()
  @IsOptional()
  major?: string;
}

export class EssayScoresDto {
  @ApiProperty({ description: '主题清晰度 1-10' })
  clarity: number;

  @ApiProperty({ description: '个人特色 1-10' })
  uniqueness: number;

  @ApiProperty({ description: '故事性 1-10' })
  storytelling: number;

  @ApiProperty({ description: '与学校契合度 1-10' })
  fit: number;

  @ApiProperty({ description: '语言表达 1-10' })
  language: number;
}

export class EssayReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  overallScore: number;

  @ApiProperty({ type: EssayScoresDto })
  scores: EssayScoresDto;

  @ApiProperty({ type: [String] })
  strengths: string[];

  @ApiProperty({ type: [String] })
  weaknesses: string[];

  @ApiProperty({ type: [String] })
  suggestions: string[];

  @ApiProperty()
  verdict: string;

  @ApiProperty()
  tokenUsed: number;
}



