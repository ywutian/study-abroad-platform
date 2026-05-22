import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Minimum matched cases before a comparison is considered usable. */
export const MIN_SIMILAR_CASES = 5;

/** One real admission case surfaced for profile comparison. */
export class SimilarCaseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Locale-resolved school display name' })
  school: string;

  @ApiPropertyOptional()
  year?: number;

  @ApiPropertyOptional({ description: 'Application round (ED/EA/RD/...)' })
  round?: string;

  @ApiProperty({
    description: 'Outcome',
    enum: ['ADMITTED', 'REJECTED', 'WAITLISTED', 'DEFERRED'],
  })
  result: string;

  @ApiPropertyOptional({ description: 'Banded GPA, e.g. "3.8-3.9"' })
  gpaRange?: string;

  @ApiPropertyOptional({ description: 'Banded SAT, e.g. "1500-1550"' })
  satRange?: string;

  @ApiPropertyOptional()
  major?: string;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({
    type: [String],
    description: 'first_gen / legacy / athlete / urm / ...',
  })
  demographicTags: string[];

  @ApiPropertyOptional()
  nationality?: string;

  @ApiProperty({ description: 'One-line summary of the applicant activities' })
  activitySummary: string;
}

/** Outcome counts across the matched cases. */
export class SimilarCasesBreakdownDto {
  @ApiProperty()
  admitted: number;

  @ApiProperty()
  rejected: number;

  @ApiProperty()
  waitlisted: number;
}

export class SimilarCasesMatchCriteriaDto {
  @ApiPropertyOptional()
  gpa?: number;

  @ApiPropertyOptional()
  targetMajor?: string;

  @ApiPropertyOptional()
  nationality?: string;

  @ApiPropertyOptional({ description: 'School id filter, if any' })
  schoolFilter?: string;
}

export class SimilarCasesResponseDto {
  @ApiProperty({
    enum: ['OK', 'INSUFFICIENT_DATA'],
    description:
      'INSUFFICIENT_DATA when fewer than `minRequired` cases matched — the UI must NOT render a verdict, only state the count honestly',
  })
  status: 'OK' | 'INSUFFICIENT_DATA';

  @ApiProperty({ description: 'Number of matched cases' })
  count: number;

  @ApiProperty({ description: 'Minimum cases needed for a usable comparison' })
  minRequired: number;

  @ApiProperty({
    description:
      'False when same-nationality cases were insufficient and the result includes cross-nationality fallback cases',
  })
  nationalityMatched: boolean;

  @ApiProperty({ type: SimilarCasesMatchCriteriaDto })
  matchCriteria: SimilarCasesMatchCriteriaDto;

  @ApiProperty({ type: SimilarCasesBreakdownDto })
  breakdown: SimilarCasesBreakdownDto;

  @ApiProperty({ type: [SimilarCaseDto] })
  cases: SimilarCaseDto[];
}
