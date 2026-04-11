import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum AdmissionResultValue {
  ADMITTED = 'ADMITTED',
  REJECTED = 'REJECTED',
  WAITLISTED = 'WAITLISTED',
  DEFERRED = 'DEFERRED',
}

export class ReportResultDto {
  @ApiProperty({
    description: 'Actual admission result for calibration',
    enum: AdmissionResultValue,
  })
  @IsEnum(AdmissionResultValue)
  result: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';

  @ApiPropertyOptional({
    description: 'Optional note captured with the outcome label',
    example: 'Uploaded by student after counselor review',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Optional evidence URL for later verification',
    example: 'https://example.com/offer-letter',
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  evidenceUrl?: string;

  @ApiPropertyOptional({
    description: 'Application round attached to this outcome report',
    example: 'ED',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  round?: string;

  @ApiPropertyOptional({
    description: 'Whether the submitted label is the final resolved outcome',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;
}
