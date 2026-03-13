import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AdmissionResultValue {
  ADMITTED = 'ADMITTED',
  REJECTED = 'REJECTED',
  WAITLISTED = 'WAITLISTED',
}

export class ReportResultDto {
  @ApiProperty({
    description: 'Actual admission result for calibration',
    enum: AdmissionResultValue,
  })
  @IsEnum(AdmissionResultValue)
  result: 'ADMITTED' | 'REJECTED' | 'WAITLISTED';
}
