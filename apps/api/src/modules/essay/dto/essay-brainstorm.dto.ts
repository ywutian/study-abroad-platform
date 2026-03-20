import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class EssayBrainstormRequestDto {
  @ApiProperty({ description: 'Essay prompt' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000)
  prompt: string;

  @ApiProperty({
    description: 'Student background summary (optional)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50000)
  background?: string;

  @ApiProperty({ description: 'Target school (optional)', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  school?: string;

  @ApiProperty({ description: 'Target major (optional)', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  major?: string;
}

export class EssayIdeaDto {
  @ApiProperty({ description: 'Idea title' })
  title: string;

  @ApiProperty({ description: 'Detailed description' })
  description: string;

  @ApiProperty({ description: 'Suitable essay type', required: false })
  suitableFor?: string;
}

export class EssayBrainstormResponseDto {
  @ApiProperty({ type: [EssayIdeaDto] })
  ideas: EssayIdeaDto[];

  @ApiProperty({ description: 'Overall writing advice' })
  overallAdvice: string;

  @ApiProperty()
  tokenUsed: number;
}
