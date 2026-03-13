import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

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
