import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * One row in a bulk acceptance-rate update payload.
 *
 * Either `schoolId` (cuid) or `schoolNameNorm` (lowercased name) is required —
 * service prefers schoolId if both provided. Rate fields are optional individually
 * but at least one prediction-critical field must be present (validated in service).
 *
 * Rate value convention: accept BOTH percentage (e.g. 41.8) and fraction (e.g.
 * 0.418). Service normalizes to the schema's `Decimal(5,2)` percentage storage.
 * This matches the PR-8 normalization in counselor-modifiers (handles both).
 */
export class BulkUpdateSchoolRateRowDto {
  @ApiProperty({
    description:
      'School cuid. Either this OR schoolNameNorm required (id wins if both set).',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  schoolId?: string;

  @ApiProperty({
    description:
      'Lowercased school name (matches School.nameNorm column). Used when schoolId not provided.',
    required: false,
    example: 'university of california, davis',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  schoolNameNorm?: string;

  @ApiProperty({
    description:
      'Overall freshman admit rate. Accepts 0.418 OR 41.8 (auto-normalized).',
    required: false,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  acceptanceRate?: number;

  @ApiProperty({
    description:
      'International freshman admit rate. Accepts 0.507 OR 50.7. KEY field — used by counselor intl modifier as published-ratio source.',
    required: false,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  intlAcceptanceRate?: number;

  @ApiProperty({
    description: 'Out-of-state freshman admit rate. Accepts 0.X or X.',
    required: false,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  oosAcceptanceRate?: number;

  @ApiProperty({
    description: 'Transfer admit rate. Accepts 0.X or X. Same convention.',
    required: false,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  transferAcceptanceRate?: number;

  @ApiProperty({
    description:
      'International/nonresident student percentage in percentage points, e.g. 0.84 means 0.84%.',
    required: false,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  intlStudentPct?: number;

  @ApiProperty({
    description:
      'Enrollment count from an official source such as IPEDS. Integer count.',
    required: false,
    minimum: 0,
    maximum: 500000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500000)
  totalEnrollment?: number;

  @ApiProperty({
    description: 'Student count from College Scorecard/IPEDS. Integer count.',
    required: false,
    minimum: 0,
    maximum: 500000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500000)
  studentCount?: number;

  @ApiProperty({
    description: 'Annual tuition in USD from official source.',
    required: false,
    minimum: 0,
    maximum: 200000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200000)
  tuition?: number;

  @ApiProperty({
    description: 'Average salary after graduation in USD.',
    required: false,
    minimum: 0,
    maximum: 500000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500000)
  avgSalary?: number;

  @ApiProperty({
    description: 'Graduation rate percentage. Accepts fraction or percent.',
    required: false,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  graduationRate?: number;

  @ApiProperty({
    description:
      'First-year retention rate percentage. Accepts fraction or percent.',
    required: false,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  retentionRate?: number;

  @ApiProperty({
    description: 'Student-faculty ratio, e.g. 6 means 6:1.',
    required: false,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  studentFacultyRatio?: number;

  @ApiProperty({
    description:
      'Percentage of demonstrated need met. Accepts fraction or percent.',
    required: false,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  percentNeedMet?: number;

  @ApiProperty({
    description: 'Average financial aid package in USD.',
    required: false,
    minimum: 0,
    maximum: 200000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200000)
  averageAidPackage?: number;

  @ApiProperty({
    description: 'Average annual net price in USD.',
    required: false,
    minimum: 0,
    maximum: 200000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200000)
  averageNetPrice?: number;

  @ApiProperty({
    description: 'Annual room and board cost in USD.',
    required: false,
    minimum: 0,
    maximum: 100000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  roomAndBoard?: number;

  @ApiProperty({
    description: 'Application fee in USD.',
    required: false,
    minimum: 0,
    maximum: 500,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  applicationFee?: number;

  @ApiProperty({
    description:
      'Need-blind-for-international status. `true` = verified need-blind, ' +
      '`false` = verified need-aware, `null` = clear status / mark as unreviewed. ' +
      'Omit the property entirely to leave the current value unchanged.',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsBoolean()
  needBlindInternational?: boolean | null;

  @ApiProperty({
    description: 'SAT 25th percentile total score.',
    required: false,
    minimum: 400,
    maximum: 1600,
  })
  @IsOptional()
  @IsInt()
  @Min(400)
  @Max(1600)
  sat25?: number;

  @ApiProperty({
    description: 'SAT median/average total score.',
    required: false,
    minimum: 400,
    maximum: 1600,
  })
  @IsOptional()
  @IsInt()
  @Min(400)
  @Max(1600)
  satAvg?: number;

  @ApiProperty({
    description: 'SAT 75th percentile total score.',
    required: false,
    minimum: 400,
    maximum: 1600,
  })
  @IsOptional()
  @IsInt()
  @Min(400)
  @Max(1600)
  sat75?: number;

  @ApiProperty({
    description: 'ACT 25th percentile composite score.',
    required: false,
    minimum: 1,
    maximum: 36,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  act25?: number;

  @ApiProperty({
    description: 'ACT median/average composite score.',
    required: false,
    minimum: 1,
    maximum: 36,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  actAvg?: number;

  @ApiProperty({
    description: 'ACT 75th percentile composite score.',
    required: false,
    minimum: 1,
    maximum: 36,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  act75?: number;

  @ApiProperty({
    description:
      'Legacy boolean testing-policy indicator. Use only when a source explicitly publishes it.',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  testOptional?: boolean;

  @ApiProperty({
    description: 'Whether application fee waivers are available.',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  feeWaiverAvailable?: boolean;

  @ApiProperty({
    description: 'Whether the school accepts Common App.',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  acceptsCommonApp?: boolean;

  @ApiProperty({
    description: 'Whether the school accepts Coalition App.',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  acceptsCoalition?: boolean;

  @ApiProperty({
    description: 'Whether the school offers Early Decision.',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  hasEarlyDecision?: boolean;

  @ApiProperty({
    description: 'Median salary 6 years after graduation in USD.',
    required: false,
    minimum: 0,
    maximum: 500000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500000)
  salary6YrPostGrad?: number;

  @ApiProperty({
    description:
      'Federal loan default rate percentage. Accepts fraction or percent.',
    required: false,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  loanDefaultRate?: number;

  @ApiProperty({
    description: 'Median monthly loan payment in USD.',
    required: false,
    minimum: 0,
    maximum: 5000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  monthlyLoanPayment?: number;

  @ApiProperty({
    description:
      'Provenance tag — required for audit. e.g. "cds-2024-25:uc-davis", "ipeds:2024:unitid-110644", "manual:admin-review".',
    required: true,
    example: 'cds-2024-25:uc-davis',
  })
  @IsString()
  @MaxLength(200)
  source!: string;

  @ApiProperty({
    description: 'Optional source URL. Recorded in audit log for traceability.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceUrl?: string;

  @ApiProperty({
    description: 'Cycle year (e.g. 2024 for 2024-25 CDS).',
    required: false,
    minimum: 2000,
    maximum: 2100,
  })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  cycleYear?: number;

  @ApiProperty({
    description:
      'Optional provenance confidence for inferred/heuristic rows, 0-1.',
    required: false,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  sourceConfidence?: number;

  @ApiProperty({
    description: 'Optional short provenance notes for this row.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceNotes?: string;
}

export class BulkUpdateSchoolRatesDto {
  @ApiProperty({
    description: 'Array of school rate updates (max 500 per request).',
    type: [BulkUpdateSchoolRateRowDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateSchoolRateRowDto)
  rows!: BulkUpdateSchoolRateRowDto[];

  @ApiProperty({
    description:
      'When true, validate + report what WOULD change but do not write. Default false (live update).',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
