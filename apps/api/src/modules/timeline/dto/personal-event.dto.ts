import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { PersonalEventCategory, PersonalEventStatus } from '@prisma/client';

// ============ PersonalEvent DTOs ============

export class CreatePersonalEventDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ enum: PersonalEventCategory })
  @IsEnum(PersonalEventCategory)
  category: PersonalEventCategory;

  @ApiPropertyOptional({ description: '主截止日期（如报名截止）' })
  @IsDateString()
  @IsOptional()
  deadline?: string;

  @ApiPropertyOptional({ description: '事件日期（如考试日、竞赛日）' })
  @IsDateString()
  @IsOptional()
  eventDate?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdatePersonalEventDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ enum: PersonalEventCategory })
  @IsEnum(PersonalEventCategory)
  @IsOptional()
  category?: PersonalEventCategory;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  deadline?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  eventDate?: string;

  @ApiPropertyOptional({ enum: PersonalEventStatus })
  @IsEnum(PersonalEventStatus)
  @IsOptional()
  status?: PersonalEventStatus;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  progress?: number;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class SubscribeGlobalEventDto {
  @ApiProperty({ description: '全局事件ID' })
  @IsString()
  @IsNotEmpty()
  globalEventId: string;
}

export class PersonalEventResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: PersonalEventCategory })
  category: PersonalEventCategory;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  globalEventId?: string;

  @ApiPropertyOptional()
  deadline?: Date;

  @ApiPropertyOptional()
  eventDate?: Date;

  @ApiProperty({ enum: PersonalEventStatus })
  status: PersonalEventStatus;

  @ApiProperty()
  progress: number;

  @ApiProperty()
  priority: number;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  url?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  tasksTotal: number;

  @ApiProperty()
  tasksCompleted: number;

  @ApiProperty()
  createdAt: Date;
}

// ============ PersonalTask DTOs ============

export class CreatePersonalTaskDto {
  @ApiProperty({ description: '所属事件ID' })
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dueDate?: string;
}

export class PersonalTaskResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  eventId: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  dueDate?: Date;

  @ApiProperty()
  completed: boolean;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiProperty()
  sortOrder: number;
}
