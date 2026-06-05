import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { Type, Transform } from 'class-transformer';
import { TestingPolicy } from '@prisma/client';
import {
  NICHE_GRADE_QUERY_VALUES,
  type NicheGradeQueryValue,
} from '@study-abroad/shared/scoring';

export enum SchoolType {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export enum SchoolSortBy {
  RANK = 'rank',
  NAME = 'name',
  ACCEPTANCE = 'acceptance',
  SALARY = 'salary',
  WEIGHTED = 'weighted',
}

export enum SchoolRankingSource {
  US_NEWS = 'US_NEWS',
}

export enum SchoolRankingList {
  US_NEWS_CORE = 'US_NEWS_CORE',
  NATIONAL_UNIVERSITY = 'NATIONAL_UNIVERSITY',
  LIBERAL_ARTS = 'LIBERAL_ARTS',
  REGIONAL_UNIVERSITY = 'REGIONAL_UNIVERSITY',
  ART_DESIGN = 'ART_DESIGN',
  MUSIC = 'MUSIC',
  ENGINEERING_NO_PHD = 'ENGINEERING_NO_PHD',
}

export class SchoolQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Country code' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  country?: string;

  @ApiPropertyOptional({ description: 'Search keyword' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'State/province' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  state?: string;

  @ApiPropertyOptional({ description: 'Region (northeast/midwest/south/west)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  region?: string;

  @ApiPropertyOptional({ description: 'Minimum rank' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  rankMin?: number;

  @ApiPropertyOptional({ description: 'Maximum rank' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(500)
  rankMax?: number;

  @ApiPropertyOptional({
    description:
      'Response projection. "list" returns a slim list-card payload (omits provenance/metadata, ~5x smaller).',
    enum: ['list'],
  })
  @IsOptional()
  @IsIn(['list'])
  view?: 'list';

  @ApiPropertyOptional({ description: 'Minimum acceptance rate (%)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  acceptanceMin?: number;

  @ApiPropertyOptional({ description: 'Maximum acceptance rate (%)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(100)
  acceptanceMax?: number;

  @ApiPropertyOptional({ description: 'Minimum tuition (USD)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tuitionMin?: number;

  @ApiPropertyOptional({ description: 'Maximum tuition (USD)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tuitionMax?: number;

  @ApiPropertyOptional({ description: 'Minimum student count' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sizeMin?: number;

  @ApiPropertyOptional({ description: 'Maximum student count' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sizeMax?: number;

  @ApiPropertyOptional({ description: 'Minimum post-graduation salary (USD)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({ description: 'Maximum post-graduation salary (USD)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  salaryMax?: number;

  @ApiPropertyOptional({
    description: 'School list sort',
    enum: SchoolSortBy,
  })
  @IsOptional()
  @IsEnum(SchoolSortBy)
  sortBy?: SchoolSortBy;

  @ApiPropertyOptional({
    description: 'Ranking source',
    enum: SchoolRankingSource,
    default: SchoolRankingSource.US_NEWS,
  })
  @IsOptional()
  @IsEnum(SchoolRankingSource)
  rankingSource?: SchoolRankingSource;

  @ApiPropertyOptional({
    description: 'Ranking list context',
    enum: SchoolRankingList,
    default: SchoolRankingList.US_NEWS_CORE,
  })
  @IsOptional()
  @IsEnum(SchoolRankingList)
  rankingList?: SchoolRankingList;

  @ApiPropertyOptional({ description: 'Weighted sort rank weight' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  weightRank?: number;

  @ApiPropertyOptional({ description: 'Weighted sort acceptance rate weight' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  weightAcceptance?: number;

  @ApiPropertyOptional({ description: 'Weighted sort tuition weight' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  weightTuition?: number;

  @ApiPropertyOptional({ description: 'Weighted sort salary weight' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  weightSalary?: number;

  @ApiPropertyOptional({ description: 'Weighted sort campus safety weight' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  weightCampusSafety?: number;

  @ApiPropertyOptional({ description: 'Weighted sort campus life weight' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  weightCampusLife?: number;

  @ApiPropertyOptional({ description: 'Weighted sort campus food weight' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  weightCampusFood?: number;

  @ApiPropertyOptional({
    description: 'School type (public/private)',
    enum: SchoolType,
  })
  @IsOptional()
  @IsEnum(SchoolType)
  schoolType?: SchoolType;

  @ApiPropertyOptional({ description: 'Whether test optional' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  testOptional?: boolean;

  @ApiPropertyOptional({ enum: TestingPolicy, description: 'Testing policy' })
  @IsOptional()
  @IsEnum(TestingPolicy)
  testingPolicy?: TestingPolicy;

  @ApiPropertyOptional({ description: 'Whether need-blind' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  needBlind?: boolean;

  @ApiPropertyOptional({ description: 'Whether Early Decision is offered' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasEarlyDecision?: boolean;

  @ApiPropertyOptional({
    description: 'Minimum Niche safety grade, URL-safe (e.g. A_MINUS)',
    enum: NICHE_GRADE_QUERY_VALUES,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(NICHE_GRADE_QUERY_VALUES)
  minSafetyGrade?: NicheGradeQueryValue;

  @ApiPropertyOptional({
    description: 'Minimum Niche campus life grade, URL-safe (e.g. B_PLUS)',
    enum: NICHE_GRADE_QUERY_VALUES,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(NICHE_GRADE_QUERY_VALUES)
  minLifeGrade?: NicheGradeQueryValue;

  @ApiPropertyOptional({
    description: 'Minimum Niche food grade, URL-safe (e.g. A_MINUS)',
    enum: NICHE_GRADE_QUERY_VALUES,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(NICHE_GRADE_QUERY_VALUES)
  minFoodGrade?: NicheGradeQueryValue;
}
