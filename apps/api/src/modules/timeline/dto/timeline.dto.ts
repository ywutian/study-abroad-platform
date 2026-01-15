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
} from 'class-validator';

export enum ApplicationRound {
  ED = 'ED',
  ED2 = 'ED2',
  EA = 'EA',
  REA = 'REA',
  RD = 'RD',
  ROLLING = 'Rolling',
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
  @ApiProperty({ description: '学校ID' })
  @IsString()
  @IsNotEmpty()
  schoolId: string;

  @ApiProperty({ enum: ApplicationRound })
  @IsEnum(ApplicationRound)
  round: ApplicationRound;

  @ApiPropertyOptional({ description: '截止日期' })
  @IsDateString()
  @IsOptional()
  deadline?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional()
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
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
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
  @ApiProperty({ description: '时间线ID' })
  @IsString()
  @IsNotEmpty()
  timelineId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ enum: TaskType })
  @IsEnum(TaskType)
  @IsOptional()
  type?: TaskType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: '文书题目（文书类型任务）' })
  @IsString()
  @IsOptional()
  essayPrompt?: string;

  @ApiPropertyOptional({ description: '字数限制' })
  @IsInt()
  @IsOptional()
  wordLimit?: number;
}

export class UpdateTaskDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ enum: TaskType })
  @IsEnum(TaskType)
  @IsOptional()
  type?: TaskType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
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
  essayId?: string;

  @ApiPropertyOptional()
  @IsInt()
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

  @ApiProperty()
  sortOrder: number;
}

// ============ Generate Timeline DTO ============

export class GenerateTimelineDto {
  @ApiProperty({ type: [String], description: '学校ID列表' })
  @IsString({ each: true })
  schoolIds: string[];
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
  @ApiProperty({ description: '个人事件总数' })
  totalPersonalEvents: number;

  @ApiProperty({ description: '进行中的个人事件' })
  personalInProgress: number;

  @ApiProperty({ description: '已完成的个人事件' })
  personalCompleted: number;

  @ApiProperty({ description: '即将到来的个人事件' })
  upcomingPersonalEvents: any[];
}
