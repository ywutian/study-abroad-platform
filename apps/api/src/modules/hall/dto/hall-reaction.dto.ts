import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class HallReactionDto {
  @ApiProperty({ description: 'Reaction type (e.g. helpful, insightful)' })
  @IsString()
  @MaxLength(500)
  type: string;
}

export class RankingAnalysisDto {
  @ApiProperty({ description: 'School ID for ranking analysis' })
  @IsString()
  @MaxLength(500)
  schoolId: string;
}

export class ChallengeGuessesDto {
  @ApiProperty({
    description:
      'Map of field names to guessed values for the challenge submission',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  guesses: Record<string, string>;
}
