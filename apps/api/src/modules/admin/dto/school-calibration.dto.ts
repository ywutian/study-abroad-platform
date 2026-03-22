import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  MaxLength,
  ArrayMaxSize,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSchoolCalibrationDto {
  @ApiProperty({ description: 'School ID to calibrate' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  schoolId: string;

  @ApiProperty({
    description:
      'Probability multiplier (0.5–2.0). >1 boosts probability, <1 reduces it.',
    example: 1.15,
  })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.5)
  @Max(2.0)
  multiplier: number;

  @ApiPropertyOptional({
    description: 'Reason for this calibration adjustment',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class BulkCreateCalibrationDto {
  @ApiProperty({
    description: 'Array of calibration items to create or update',
    type: [CreateSchoolCalibrationDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSchoolCalibrationDto)
  @ArrayMaxSize(50)
  items: CreateSchoolCalibrationDto[];
}

export class UpdateSchoolCalibrationDto {
  @ApiPropertyOptional({
    description: 'Updated probability multiplier (0.5–2.0)',
    example: 1.2,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.5)
  @Max(2.0)
  multiplier?: number;

  @ApiPropertyOptional({ description: 'Updated reason' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
