import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { PersonalEventCategory, PersonalEventStatus } from '@prisma/client';

// ============ PersonalEvent DTOs ============

export class CreatePersonalEventDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ enum: PersonalEventCategory })
  @IsEnum(PersonalEventCategory)
  category: PersonalEventCategory;

  @ApiPropertyOptional({
    description: 'Primary deadline (e.g. registration deadline)',
  })
  @IsDateString()
  @IsOptional()
  deadline?: string;

  @ApiPropertyOptional({
    description: 'Event date (e.g. test day, competition day)',
  })
  @IsDateString()
  @IsOptional()
  eventDate?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional()
  @MaxLength(2000)
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @MaxLength(2048)
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional()
  @MaxLength(2000)
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdatePersonalEventDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(200)
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
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @MaxLength(2048)
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional()
  @MaxLength(2000)
  @IsString()
  @IsOptional()
  notes?: string;
}

export class SubscribeGlobalEventDto {
  @ApiProperty({ description: 'Global event ID' })
  @MaxLength(500)
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
  @ApiProperty({ description: 'Parent event ID' })
  @MaxLength(500)
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty()
  @MaxLength(200)
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
