import { IsOptional, IsString, IsEnum, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ReportStatus, ReportPriority, Role } from '@prisma/client';

export class ReportQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ReportStatus })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiPropertyOptional({ description: 'Target type filter' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetType?: string;

  @ApiPropertyOptional({ enum: ReportPriority })
  @IsOptional()
  @IsEnum(ReportPriority)
  priority?: ReportPriority;

  @ApiPropertyOptional({
    description:
      'Filter by assignee: user ID for specific admin, "unassigned" for unclaimed items',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  assignedTo?: string;
}

export class UserQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by email or username' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
