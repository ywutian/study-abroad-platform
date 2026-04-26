import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class BackfillDistillationRollupsDto {
  @ApiProperty({ required: false, description: 'ISO date string (inclusive)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  startDate?: string;

  @ApiProperty({ required: false, description: 'ISO date string (inclusive)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  endDate?: string;

  @ApiProperty({ required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  schoolId?: string;

  @ApiProperty({ required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cohortKey?: string;
}

export class LoadCdsBandRowDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  schoolName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  schoolNameNorm?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(32)
  gpaBand: string;

  @ApiProperty()
  @IsString()
  @MaxLength(16)
  testType: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  testBand?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  admitRate: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  sampleCount?: number;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  cycleYear: number;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  source: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  sourceUrl?: string;
}

export class LoadCdsBandsDto {
  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiProperty({ type: [LoadCdsBandRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoadCdsBandRowDto)
  rows: LoadCdsBandRowDto[];
}

export class LoadCdsBandsFixtureDto {
  @ApiProperty({
    required: false,
    default: true,
    description:
      'When true, count what would be loaded but do not write. Recommended on first call.',
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class BackfillCaseAggregatesDto {
  @ApiProperty({
    required: false,
    default: true,
    description:
      'When true, compute aggregations and return counts/preview without writing to predictionSourceObservation.',
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiProperty({
    required: false,
    default: 5,
    minimum: 1,
    maximum: 100,
    description:
      'Minimum cases per (teacher, school, bucket) cell before an aggregate is emitted.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  minSamples?: number;

  @ApiProperty({
    required: false,
    description:
      'Custom setVersion (sourceVersion column). Defaults to "case-aggregate-teachers-YYYY-MM-DD".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  // Only allow setVersion strings that match the case-aggregate-teachers prefix —
  // prevents overwriting other source versions (e.g. cohort-prior backfill rows)
  // even if a typo'd name happens to collide.
  @Matches(/^case-aggregate-teachers(-[\w.-]+)?$/i)
  setVersion?: string;
}

// -----------------------------------------------------------------------------
// Synthetic prediction (admin diagnostic)
// -----------------------------------------------------------------------------

/**
 * Test-score row in a synthetic profile.
 *
 * Mirrors `ProfileInput.testScores[i]` but with class-validator rules. Only
 * top-level scalars are validated — `subScores` is a free-form object since
 * test types vary (SAT has Math/EBRW; ACT has English/Math/Reading/Science).
 */
export class PreviewTestScoreDto {
  @ApiProperty({
    example: 'SAT',
    description: 'SAT | ACT | TOEFL | IELTS | ...',
  })
  @IsString()
  @MaxLength(50)
  type: string;

  @ApiProperty({ example: 1500 })
  @IsNumber()
  @Min(0)
  @Max(2400)
  score: number;
}

/**
 * Activity row in a synthetic profile.
 *
 * Mirrors `ProfileInput.activities[i]`. `description` is bounded at 500 chars
 * since we don't need essay-length blobs in a diagnostic synthetic input.
 */
export class PreviewActivityDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ example: 'leadership' })
  @IsString()
  @MaxLength(100)
  category: string;

  @ApiProperty({ example: 'President' })
  @IsString()
  @MaxLength(100)
  role: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ required: false, minimum: 0, maximum: 80 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(80)
  hoursPerWeek?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 52 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(52)
  weeksPerYear?: number;
}

/**
 * Award row in a synthetic profile (mirrors `ProfileInput.awards[i]`).
 */
export class PreviewAwardDto {
  @ApiProperty({
    example: 'NATIONAL',
    description: 'NATIONAL | INTERNATIONAL | REGIONAL | SCHOOL',
  })
  @IsString()
  @MaxLength(50)
  level: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  name?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  tier?: number;
}

/**
 * Synthetic profile body for the admin "dry-run prediction" endpoint.
 *
 * Subset of `ProfileInput` from `prediction.prompts.ts` — covers the fields
 * that distillation teachers actually consume (scorecard, cohort-prior,
 * geo-cohort, hooks, ed-boost, intl-pool, major-selectivity, ap-rigor,
 * activity-intensity). If a teacher isn't firing in the synthetic trace,
 * check whether its required field is set here.
 *
 * Unknown fields are stripped by the global ValidationPipe whitelist —
 * extending this DTO is the right way to test new teachers' input requirements.
 */
export class PreviewProfileDto {
  @ApiProperty({ required: false, minimum: 0, maximum: 5, example: 3.9 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  gpa?: number;

  @ApiProperty({ required: false, example: 4 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  gpaScale?: number;

  @ApiProperty({ required: false, example: 'US_4_0' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  gpaSystem?: string;

  @ApiProperty({ required: false, example: 'GRADE_12' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  grade?: string;

  @ApiProperty({ required: false, example: 'computer-science' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetMajor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  highSchoolId?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  highSchoolTier?: number;

  @ApiProperty({ required: false, example: 'Boston, MA' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  highSchoolLocation?: string;

  @ApiProperty({ required: false, example: false })
  @IsOptional()
  @IsBoolean()
  isInternational?: boolean;

  @ApiProperty({ required: false, example: 'US' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nationality?: string;

  @ApiProperty({ required: false, example: 'US' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  educationSystem?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  needsFinancialAid?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isLegacy?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isFirstGen?: boolean;

  @ApiProperty({ type: [PreviewTestScoreDto], required: false, default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewTestScoreDto)
  testScores?: PreviewTestScoreDto[];

  @ApiProperty({ type: [PreviewActivityDto], required: false, default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewActivityDto)
  activities?: PreviewActivityDto[];

  @ApiProperty({ type: [PreviewAwardDto], required: false, default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewAwardDto)
  awards?: PreviewAwardDto[];
}

/**
 * Body for `POST /admin/predictions/distillation/dry-run`.
 *
 * Why this exists: shipping multiple distillation teachers (PR #56-58)
 * left us without a way to verify which teachers actually fire for a given
 * profile shape — running a real prediction requires a fully populated user
 * + school list + costs prediction points + writes to PredictionResult.
 * This endpoint runs `previewPredict()` with shadow-distillation enabled
 * and returns the full `servedTrace.distillation.teacherSummaries[]` per
 * school, so an admin can iterate on synthetic profiles to see teacher
 * coverage without polluting production data.
 *
 * Read-only: no DB writes, no charging, no audit-log entry beyond the
 * standard admin endpoint trail.
 */
export class PreviewPredictionDto {
  @ApiProperty({ type: () => PreviewProfileDto })
  @ValidateNested()
  @Type(() => PreviewProfileDto)
  profile: PreviewProfileDto;

  @ApiProperty({
    type: [String],
    description:
      'School IDs to predict against. Look these up via /api/v1/schools?search=...',
    minItems: 1,
    maxItems: 20,
  })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  schoolIds: string[];

  @ApiProperty({ required: false, default: 'en', enum: ['en', 'zh'] })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  locale?: string;

  @ApiProperty({
    required: false,
    default: 'RD',
    description:
      'Application round to inject into the synthetic profile (RD/ED/ED2/EA/REA/SCEA). Affects ed-boost-v1 teacher and round multiplier.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  applicationRound?: string;
}
