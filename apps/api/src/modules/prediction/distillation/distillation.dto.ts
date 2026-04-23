import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BackfillDistillationRollupsDto {
  @ApiProperty({ required: false, description: 'ISO date string (inclusive)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  startDate?: string;

  @ApiProperty({ required: false, description: 'ISO date string (inclusive)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  endDate?: string;

  @ApiProperty({ required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  schoolId?: string;

  @ApiProperty({ required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cohortKey?: string;
}
