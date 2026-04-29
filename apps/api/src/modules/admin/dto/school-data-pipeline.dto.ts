import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BulkUpdateSchoolRateRowDto } from './bulk-update-school-rates.dto';

export class SchoolDataCoverageQueryDto {
  @ApiPropertyOptional({
    description:
      'When true, include non-US schools. Default false because PR-15 scope is US freshman admissions.',
  })
  @IsOptional()
  @IsBoolean()
  includeAllCountries?: boolean;
}

export class HeuristicFillDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of schools to scan in this request.',
    default: 500,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'When true, overwrite existing HEURISTIC-sourced fields. Official/partner/scraped fields are never overwritten here.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceHeuristic?: boolean;
}

export class SyncIpedsAdmissionsDto {
  @ApiPropertyOptional({
    description: 'IPEDS year. Defaults to previous year.',
  })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ default: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  limit?: number;
}

export class IpedsCsvRowDto {
  @ApiProperty({ description: 'IPEDS UNITID.' })
  @IsString()
  @MaxLength(20)
  unitid!: string;

  @ApiPropertyOptional({
    description:
      'Optional normalized school name. Used as fallback when School.ipedsId is missing.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  schoolNameNorm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  acceptanceRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  intlAcceptanceRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  oosAcceptanceRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  transferAcceptanceRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500000)
  totalEnrollment?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500000)
  studentCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200000)
  tuition?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500000)
  avgSalary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  graduationRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  retentionRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  studentFacultyRatio?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  percentNeedMet?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200000)
  averageAidPackage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200000)
  averageNetPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  roomAndBoard?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  applicationFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500000)
  salary6YrPostGrad?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  loanDefaultRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  monthlyLoanPayment?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  intlStudentPct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(400)
  @Max(1600)
  sat25?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(400)
  @Max(1600)
  satAvg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(400)
  @Max(1600)
  sat75?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  act25?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  actAvg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  act75?: number;
}

export class ImportIpedsCsvDto {
  @ApiProperty({ type: [IpedsCsvRowDto] })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => IpedsCsvRowDto)
  rows!: IpedsCsvRowDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({ default: 2024 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  cycleYear?: number;
}

export class CdsDiscoverDto {
  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(234)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Prioritize schools missing this field. Defaults to intlAcceptanceRate.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsIn([
    'acceptanceRate',
    'intlAcceptanceRate',
    'oosAcceptanceRate',
    'sat25',
    'sat75',
  ])
  missingField?: string;
}

export class CdsExtractDto {
  @ApiProperty({ type: [BulkUpdateSchoolRateRowDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateSchoolRateRowDto)
  rows!: BulkUpdateSchoolRateRowDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
