import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReportPriority } from '@prisma/client';

export class UpdatePriorityDto {
  @ApiProperty({ enum: ReportPriority })
  @IsEnum(ReportPriority)
  priority: ReportPriority;
}
