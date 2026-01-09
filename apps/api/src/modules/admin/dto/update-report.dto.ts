import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportStatus } from '@prisma/client';

export class UpdateReportDto {
  @ApiProperty({ enum: ReportStatus, description: 'New report status' })
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @ApiPropertyOptional({ description: 'Resolution notes', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolution?: string;
}


