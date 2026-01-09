import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class EssayBrainstormRequestDto {
  @ApiProperty({ description: '文书题目' })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiProperty({ description: '学生背景简述（可选）', required: false })
  @IsString()
  @IsOptional()
  background?: string;

  @ApiProperty({ description: '目标学校（可选）', required: false })
  @IsString()
  @IsOptional()
  school?: string;

  @ApiProperty({ description: '目标专业（可选）', required: false })
  @IsString()
  @IsOptional()
  major?: string;
}

export class EssayIdeaDto {
  @ApiProperty({ description: '想法标题' })
  title: string;

  @ApiProperty({ description: '详细说明' })
  description: string;

  @ApiProperty({ description: '适合的文书类型', required: false })
  suitableFor?: string;
}

export class EssayBrainstormResponseDto {
  @ApiProperty({ type: [EssayIdeaDto] })
  ideas: EssayIdeaDto[];

  @ApiProperty({ description: '整体写作建议' })
  overallAdvice: string;

  @ApiProperty()
  tokenUsed: number;
}



