import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class EssayReviewRequestDto {
  @ApiProperty({ description: 'Essay ID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  essayId: string;

  @ApiProperty({
    description: 'Target school name (optional)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  schoolName?: string;

  @ApiProperty({ description: 'Target major (optional)', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  major?: string;
}

export class EssayScoresDto {
  @ApiProperty({ description: 'Theme clarity 1-10' })
  clarity: number;

  @ApiProperty({ description: 'Personal uniqueness 1-10' })
  uniqueness: number;

  @ApiProperty({ description: 'Storytelling 1-10' })
  storytelling: number;

  @ApiProperty({ description: 'Voice authenticity 1-10' })
  authenticity: number;

  @ApiProperty({ description: 'Language expression 1-10' })
  language: number;
}

export class EssayClicheDto {
  @ApiProperty({ description: 'Original cliché text found in essay' })
  text: string;

  @ApiProperty({ description: 'Suggested more personal alternative' })
  suggestion: string;
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

  @ApiProperty({ type: [EssayClicheDto], required: false })
  cliches?: EssayClicheDto[];

  @ApiProperty()
  verdict: string;

  @ApiProperty()
  tokenUsed: number;
}
