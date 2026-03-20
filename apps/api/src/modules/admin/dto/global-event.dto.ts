import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  IsEnum,
  MaxLength,
  Min,
} from 'class-validator';
import { GlobalEventCategory } from '@prisma/client';

export class CreateGlobalEventDto {
  @ApiProperty({ description: 'Event title (English)' })
  @MaxLength(200)
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Event title (Chinese)' })
  @MaxLength(200)
  @IsString()
  @IsOptional()
  titleZh?: string;

  @ApiProperty({ enum: GlobalEventCategory })
  @IsEnum(GlobalEventCategory)
  category: GlobalEventCategory;

  @ApiProperty({ description: 'Event date' })
  @IsDateString()
  eventDate: string;

  @ApiPropertyOptional({ description: 'Registration deadline' })
  @IsDateString()
  @IsOptional()
  registrationDeadline?: string;

  @ApiPropertyOptional({ description: 'Late registration deadline' })
  @IsDateString()
  @IsOptional()
  lateDeadline?: string;

  @ApiPropertyOptional({ description: 'Score release date' })
  @IsDateString()
  @IsOptional()
  resultDate?: string;

  @ApiPropertyOptional()
  @MaxLength(2000)
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @MaxLength(2000)
  @IsString()
  @IsOptional()
  descriptionZh?: string;

  @ApiPropertyOptional()
  @MaxLength(2048)
  @IsString()
  @IsOptional()
  url?: string;

  @ApiProperty({ description: 'Year' })
  @IsInt()
  @Min(2020)
  year: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;
}

export class UpdateGlobalEventDto {
  @ApiPropertyOptional()
  @MaxLength(200)
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @MaxLength(200)
  @IsString()
  @IsOptional()
  titleZh?: string;

  @ApiPropertyOptional({ enum: GlobalEventCategory })
  @IsEnum(GlobalEventCategory)
  @IsOptional()
  category?: GlobalEventCategory;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  eventDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  registrationDeadline?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  lateDeadline?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  resultDate?: string;

  @ApiPropertyOptional()
  @MaxLength(2000)
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @MaxLength(2000)
  @IsString()
  @IsOptional()
  descriptionZh?: string;

  @ApiPropertyOptional()
  @MaxLength(2048)
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  year?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
