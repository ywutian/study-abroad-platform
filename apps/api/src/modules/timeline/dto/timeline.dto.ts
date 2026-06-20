import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
  IsDateString,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { MAX_SCHOOLS_PER_BATCH } from '@study-abroad/shared';
import { PersonalEventResponseDto } from './personal-event.dto';

export enum ApplicationRound {
  ED = 'ED',
  ED2 = 'ED2',
  EA = 'EA',
  REA = 'REA',
  SCEA = 'SCEA',
  RD = 'RD',
  ROLLING = 'ROLLING',
}

export enum TimelineStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WAITLISTED = 'WAITLISTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum TaskType {
  ESSAY = 'ESSAY',
  DOCUMENT = 'DOCUMENT',
  TEST = 'TEST',
  INTERVIEW = 'INTERVIEW',
  RECOMMENDATION = 'RECOMMENDATION',
  OTHER = 'OTHER',
}

// ============ Timeline DTOs ============

export class CreateTimelineDto {
  @ApiProperty({ description: 'School ID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  schoolId: string;

  @ApiProperty({ enum: ApplicationRound })
  @IsEnum(ApplicationRound)
  round: ApplicationRound;

  @ApiPropertyOptional({ description: 'Deadline' })
  @IsDateString()
  @IsOptional()
  deadline?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional()
  @MaxLength(2000)
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateTimelineDto {
  @ApiPropertyOptional({ enum: TimelineStatus })
  @IsEnum(TimelineStatus)
  @IsOptional()
  status?: TimelineStatus;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  deadline?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  progress?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}

export class TimelineResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  schoolName: string;

  @ApiProperty({ enum: ApplicationRound })
  round: ApplicationRound;

  @ApiProperty()
  deadline?: Date;

  @ApiProperty({ enum: TimelineStatus })
  status: TimelineStatus;

  @ApiProperty()
  progress: number;

  @ApiProperty()
  priority: number;

  @ApiProperty()
  notes?: string;

  @ApiProperty()
  tasksTotal: number;

  @ApiProperty()
  tasksCompleted: number;

  @ApiProperty()
  createdAt: Date;
}

// ============ Task DTOs ============

export class CreateTaskDto {
  @ApiProperty({ description: 'Timeline ID' })
  @MaxLength(500)
  @IsString()
  @IsNotEmpty()
  timelineId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ enum: TaskType })
  @IsEnum(TaskType)
  @IsOptional()
  type?: TaskType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Essay prompt (for essay-type tasks)' })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  essayPrompt?: string;

  @ApiPropertyOptional({ description: 'Word limit' })
  @IsInt()
  @Min(0)
  @Max(100000)
  @IsOptional()
  wordLimit?: number;
}

export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ enum: TaskType })
  @IsEnum(TaskType)
  @IsOptional()
  type?: TaskType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  completed?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(200)
  essayId?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class TaskResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  timelineId: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: TaskType })
  type: TaskType;

  @ApiProperty()
  description?: string;

  @ApiProperty()
  dueDate?: Date;

  @ApiProperty()
  completed: boolean;

  @ApiProperty()
  completedAt?: Date;

  @ApiProperty()
  essayPrompt?: string;

  @ApiProperty()
  wordLimit?: number;

  @ApiPropertyOptional()
  sourceStatus?:
    | 'generic'
    | 'source_backed'
    | 'source_review_required'
    | 'first_party';

  @ApiPropertyOptional()
  sourcePolicy?: string;

  @ApiProperty()
  sortOrder: number;
}

// ============ Generate Timeline DTO ============

export class GenerateTimelineDto {
  @ApiProperty({
    type: [String],
    description: 'School ID list',
    minItems: 1,
    maxItems: MAX_SCHOOLS_PER_BATCH,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SCHOOLS_PER_BATCH)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @IsNotEmpty({ each: true })
  schoolIds: string[];
}

export class GenerateTimelineFailedItemDto {
  @ApiProperty({ description: 'School ID' })
  schoolId: string;

  @ApiProperty({
    description: 'Failure reason',
    enum: ['SCHOOL_NOT_FOUND', 'DEADLINE_SOURCE_REQUIRED', 'INTERNAL_ERROR'],
  })
  reason: string;
}

export class GenerateTimelinesResultDto {
  @ApiProperty({
    type: [TimelineResponseDto],
    description: 'Successfully created timelines',
  })
  created: TimelineResponseDto[];

  @ApiProperty({
    type: [GenerateTimelineFailedItemDto],
    description: 'Failed schools',
  })
  failed: GenerateTimelineFailedItemDto[];
}

export class TimelineOverviewDto {
  // 学校申请统计
  @ApiProperty()
  totalSchools: number;

  @ApiProperty()
  submitted: number;

  @ApiProperty()
  inProgress: number;

  @ApiProperty()
  notStarted: number;

  @ApiProperty()
  upcomingDeadlines: TimelineResponseDto[];

  @ApiProperty()
  overdueTasks: TaskResponseDto[];

  // 个人事件统计
  @ApiProperty({ description: 'Total personal events' })
  totalPersonalEvents: number;

  @ApiProperty({ description: 'Personal events in progress' })
  personalInProgress: number;

  @ApiProperty({ description: 'Completed personal events' })
  personalCompleted: number;

  @ApiProperty({
    type: [PersonalEventResponseDto],
    description: 'Upcoming personal events',
  })
  upcomingPersonalEvents: PersonalEventResponseDto[];
}
