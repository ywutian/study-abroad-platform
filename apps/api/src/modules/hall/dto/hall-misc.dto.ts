import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Hall §7 Decision B: `HallReactionDto` (used only by the retired
// react-to-review route) was removed. The two DTOs below back the kept
// `ranking-analysis` and `swipe/challenge` routes.

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
