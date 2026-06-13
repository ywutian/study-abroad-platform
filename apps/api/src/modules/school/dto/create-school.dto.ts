import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsUrl,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  MaxLength,
  IsArray,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TestingPolicy } from '@prisma/client';
import type { Prisma } from '@prisma/client';

export class CreateSchoolDto {
  @ApiProperty({ description: 'School name in English' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'School name in Chinese' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameZh?: string;

  @ApiPropertyOptional({ description: 'Country code', default: 'US' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  country?: string;

  @ApiPropertyOptional({ description: 'State/Province' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  state?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  city?: string;

  @ApiPropertyOptional({ description: 'US News ranking' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usNewsRank?: number;

  @ApiPropertyOptional({ description: 'QS World ranking' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qsRank?: number;

  @ApiPropertyOptional({ description: 'Acceptance rate (0-100)', example: 5.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  acceptanceRate?: number;

  @ApiPropertyOptional({ description: 'Annual tuition in USD' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tuition?: number;

  @ApiPropertyOptional({ description: 'Average salary after graduation' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  avgSalary?: number;

  @ApiPropertyOptional({ description: 'Total enrollment' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalEnrollment?: number;

  @ApiPropertyOptional({ description: 'Average SAT score' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(400)
  @Max(1600)
  satAvg?: number;

  @ApiPropertyOptional({ description: 'SAT 25th percentile (combined)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(400)
  @Max(1600)
  sat25?: number;

  @ApiPropertyOptional({ description: 'SAT 75th percentile (combined)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(400)
  @Max(1600)
  sat75?: number;

  @ApiPropertyOptional({ description: 'SAT Math 25th percentile' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(200)
  @Max(800)
  satMath25?: number;

  @ApiPropertyOptional({ description: 'SAT Math 75th percentile' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(200)
  @Max(800)
  satMath75?: number;

  @ApiPropertyOptional({ description: 'SAT ERW 25th percentile' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(200)
  @Max(800)
  satReading25?: number;

  @ApiPropertyOptional({ description: 'SAT ERW 75th percentile' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(200)
  @Max(800)
  satReading75?: number;

  @ApiPropertyOptional({ description: 'Average ACT score' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  actAvg?: number;

  @ApiPropertyOptional({ description: 'ACT 25th percentile' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  act25?: number;

  @ApiPropertyOptional({ description: 'ACT 75th percentile' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  act75?: number;

  @ApiPropertyOptional({ description: 'Total student population' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  studentCount?: number;

  @ApiPropertyOptional({ description: 'Graduation rate (0-100)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  graduationRate?: number;

  @ApiPropertyOptional({ description: 'Is private institution' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPrivate?: boolean;

  @ApiPropertyOptional({ description: 'Niche safety grade (e.g., A+, A, B+)' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  nicheSafetyGrade?: string;

  @ApiPropertyOptional({ description: 'Niche campus life grade' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  nicheLifeGrade?: string;

  @ApiPropertyOptional({ description: 'Niche food grade' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  nicheFoodGrade?: string;

  @ApiPropertyOptional({ description: 'Niche overall grade' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  nicheOverallGrade?: string;

  @ApiPropertyOptional({ description: 'School website URL' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ description: 'School logo URL (HTTPS only)' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Description in English' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ description: 'Description in Chinese' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descriptionZh?: string;

  // Retention & Academics
  @ApiPropertyOptional({ description: 'First-year retention rate (0-100)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  retentionRate?: number;

  @ApiPropertyOptional({
    description: 'Student-to-faculty ratio (e.g. 6 means 6:1)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentFacultyRatio?: number;

  // Financial Aid
  @ApiPropertyOptional({ description: 'Percentage of need met (0-100)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  percentNeedMet?: number;

  @ApiPropertyOptional({ description: 'Average financial aid package in USD' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  averageAidPackage?: number;

  @ApiPropertyOptional({ description: 'Average net price after aid in USD' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  averageNetPrice?: number;

  @ApiPropertyOptional({ description: 'Annual room and board cost in USD' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  roomAndBoard?: number;

  // Application Info
  @ApiPropertyOptional({ description: 'Application fee in USD' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  applicationFee?: number;

  @ApiPropertyOptional({ description: 'Fee waiver available' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  feeWaiverAvailable?: boolean;

  @ApiPropertyOptional({ description: 'Accepts Common App' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  acceptsCommonApp?: boolean;

  @ApiPropertyOptional({ description: 'Accepts Coalition App' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  acceptsCoalition?: boolean;

  @ApiPropertyOptional({ description: 'Test optional policy' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  testOptional?: boolean;

  @ApiPropertyOptional({ enum: TestingPolicy, description: 'Testing policy' })
  @IsOptional()
  @IsEnum(TestingPolicy)
  testingPolicy?: TestingPolicy;

  @ApiPropertyOptional({ description: 'Has Early Decision option' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  hasEarlyDecision?: boolean;

  // Post-Graduation Outcomes
  @ApiPropertyOptional({
    description: 'Median salary 6 years after graduation in USD',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salary6YrPostGrad?: number;

  @ApiPropertyOptional({ description: 'Federal loan default rate (0-100)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  loanDefaultRate?: number;

  @ApiPropertyOptional({ description: 'Median monthly loan payment in USD' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  monthlyLoanPayment?: number;

  // Campus Life
  @ApiPropertyOptional({
    description: 'Number of countries represented on campus',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  countriesRepresented?: number;

  @ApiPropertyOptional({ description: 'Number of student organizations' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  studentOrgsCount?: number;

  @ApiPropertyOptional({
    description: 'Whether on-campus housing is available',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  housingAvailable?: boolean;

  @ApiPropertyOptional({ description: 'Years of required on-campus housing' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  housingRequiredYears?: number;

  @ApiPropertyOptional({ description: 'Percent of students living on campus' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  percentLivingOnCampus?: number;

  @ApiPropertyOptional({ description: 'Annual meal plan cost in USD' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  mealPlanCost?: number;

  @ApiPropertyOptional({
    description: 'Source-backed campus safety services',
    type: [String],
  })
  @IsOptional()
  // @arraysize-uncapped-allowed: POST /schools is @Roles(ADMIN)-gated school-catalog tooling
  // (no user/mobile consumer sends this field) — not a user-submitted list.
  @IsArray()
  @IsString({ each: true })
  campusSafetyServices?: string[];

  @ApiPropertyOptional({
    description: 'Source-backed campus-life summary facts',
  })
  @IsOptional()
  @IsObject()
  campusLifeSummary?: Prisma.InputJsonValue;

  // Admission Requirements (stored in metadata JSON)
  @ApiPropertyOptional({ description: 'Minimum TOEFL score required' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  toeflMin?: number;

  @ApiPropertyOptional({ description: 'Minimum IELTS score required' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(9)
  ieltsMin?: number;

  @ApiPropertyOptional({
    description: 'Number of supplemental essays required',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  essayCount?: number;
}
