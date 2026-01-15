/**
 * 记忆管理 DTO
 */

import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  Max,
  ValidateNested,
  IsIn,
  ArrayMaxSize,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ==================== 枚举 ====================

export enum MemoryTypeEnum {
  FACT = 'FACT',
  PREFERENCE = 'PREFERENCE',
  DECISION = 'DECISION',
  SUMMARY = 'SUMMARY',
  FEEDBACK = 'FEEDBACK',
}

export enum EntityTypeEnum {
  SCHOOL = 'SCHOOL',
  PERSON = 'PERSON',
  EVENT = 'EVENT',
  TOPIC = 'TOPIC',
}

export enum CommunicationStyle {
  FRIENDLY = 'friendly',
  PROFESSIONAL = 'professional',
  CASUAL = 'casual',
}

export enum ResponseLength {
  BRIEF = 'brief',
  MODERATE = 'moderate',
  DETAILED = 'detailed',
}

// ==================== 记忆查询 ====================

export class QueryMemoriesDto {
  @ApiPropertyOptional({ enum: MemoryTypeEnum, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(MemoryTypeEnum, { each: true })
  types?: MemoryTypeEnum[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// ==================== 记忆响应 ====================

export class MemoryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: MemoryTypeEnum })
  type: MemoryTypeEnum;

  @ApiPropertyOptional()
  category?: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  importance: number;

  @ApiProperty()
  accessCount: number;

  @ApiPropertyOptional()
  lastAccessedAt?: Date;

  @ApiProperty()
  createdAt: Date;
}

export class MemoryListResponseDto {
  @ApiProperty({ type: [MemoryItemDto] })
  items: MemoryItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  hasMore: boolean;
}

// ==================== 对话查询 ====================

export class QueryConversationsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ConversationItemDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  summary?: string;

  @ApiPropertyOptional()
  agentType?: string;

  @ApiProperty()
  messageCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ConversationListResponseDto {
  @ApiProperty({ type: [ConversationItemDto] })
  items: ConversationItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  hasMore: boolean;
}

export class ConversationDetailDto extends ConversationItemDto {
  @ApiProperty()
  messages: MessageItemDto[];
}

export class MessageItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  content: string;

  @ApiPropertyOptional()
  agentType?: string;

  @ApiProperty()
  createdAt: Date;
}

// ==================== 实体管理 ====================

export class QueryEntitiesDto {
  @ApiPropertyOptional({ enum: EntityTypeEnum, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(EntityTypeEnum, { each: true })
  types?: EntityTypeEnum[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class EntityItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: EntityTypeEnum })
  type: EntityTypeEnum;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  createdAt: Date;
}

export class EntityListResponseDto {
  @ApiProperty({ type: [EntityItemDto] })
  items: EntityItemDto[];

  @ApiProperty()
  total: number;
}

// ==================== 嵌套 DTO 定义 ====================

/**
 * 学校偏好 DTO
 */
export class SchoolPreferencesDto {
  @ApiPropertyOptional({
    type: [String],
    description: '偏好地区列表',
    example: ['东海岸', '加州'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10, { message: '地区偏好不能超过10个' })
  regions?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: '学校规模偏好',
    enum: ['small', 'medium', 'large'],
    example: ['medium', 'large'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(['small', 'medium', 'large'], {
    each: true,
    message: '学校规模必须是 small, medium, large 之一',
  })
  size?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: '学校类型偏好',
    enum: ['public', 'private', 'lac', 'research', 'comprehensive'],
    example: ['private', 'research'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(['public', 'private', 'lac', 'research', 'comprehensive'], {
    each: true,
    message:
      '学校类型必须是 public, private, lac, research, comprehensive 之一',
  })
  type?: string[];
}

/**
 * 文书偏好 DTO
 */
export class EssayPreferencesDto {
  @ApiPropertyOptional({
    description: '文书风格',
    enum: ['narrative', 'reflective', 'analytical', 'descriptive'],
    example: 'narrative',
  })
  @IsOptional()
  @IsString()
  @IsIn(['narrative', 'reflective', 'analytical', 'descriptive'], {
    message:
      '文书风格必须是 narrative, reflective, analytical, descriptive 之一',
  })
  style?: string;

  @ApiPropertyOptional({
    description: '语气',
    enum: ['formal', 'casual', 'humorous', 'serious', 'optimistic'],
    example: 'casual',
  })
  @IsOptional()
  @IsString()
  @IsIn(['formal', 'casual', 'humorous', 'serious', 'optimistic'], {
    message: '语气必须是 formal, casual, humorous, serious, optimistic 之一',
  })
  tone?: string;
}

// ==================== 偏好设置 ====================

/**
 * AI 偏好设置 DTO
 */
export class AIPreferencesDto {
  @ApiPropertyOptional({ enum: CommunicationStyle, description: '沟通风格' })
  @IsOptional()
  @IsEnum(CommunicationStyle)
  communicationStyle?: CommunicationStyle;

  @ApiPropertyOptional({ enum: ResponseLength, description: '回复长度偏好' })
  @IsOptional()
  @IsEnum(ResponseLength)
  responseLength?: ResponseLength;

  @ApiPropertyOptional({ description: '语言偏好', example: 'zh' })
  @IsOptional()
  @IsString()
  @Length(2, 10, { message: '语言代码长度应在2-10字符之间' })
  language?: string;

  @ApiPropertyOptional({
    type: SchoolPreferencesDto,
    description: '学校偏好设置',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SchoolPreferencesDto)
  schoolPreferences?: SchoolPreferencesDto;

  @ApiPropertyOptional({
    type: EssayPreferencesDto,
    description: '文书偏好设置',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => EssayPreferencesDto)
  essayPreferences?: EssayPreferencesDto;

  @ApiPropertyOptional({ description: '是否启用记忆功能' })
  @IsOptional()
  @IsBoolean()
  enableMemory?: boolean;

  @ApiPropertyOptional({ description: '是否启用建议功能' })
  @IsOptional()
  @IsBoolean()
  enableSuggestions?: boolean;
}

export class AIPreferencesResponseDto extends AIPreferencesDto {
  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ==================== 数据导出 ====================

export class DataExportRequestDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includeMemories?: boolean = true;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includeConversations?: boolean = true;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includeEntities?: boolean = true;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includePreferences?: boolean = true;
}

export class DataExportResponseDto {
  @ApiProperty()
  exportedAt: Date;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  memories?: MemoryItemDto[];

  @ApiPropertyOptional()
  conversations?: ConversationDetailDto[];

  @ApiPropertyOptional()
  entities?: EntityItemDto[];

  @ApiPropertyOptional()
  preferences?: AIPreferencesDto;

  @ApiProperty()
  stats: {
    totalMemories: number;
    totalConversations: number;
    totalMessages: number;
    totalEntities: number;
  };
}

// ==================== 统计信息 ====================

export class MemoryStatsDto {
  @ApiProperty()
  totalMemories: number;

  @ApiProperty()
  totalConversations: number;

  @ApiProperty()
  totalMessages: number;

  @ApiProperty()
  totalEntities: number;

  @ApiProperty()
  memoryByType: Record<string, number>;

  @ApiProperty()
  recentActivity: {
    conversationsLast7Days: number;
    messagesLast7Days: number;
  };

  @ApiProperty()
  storageUsed: {
    memoriesCount: number;
    conversationsCount: number;
  };
}

// ==================== 批量操作 ====================

export class BatchDeleteMemoriesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

export class BatchDeleteResponseDto {
  @ApiProperty()
  deleted: number;

  @ApiProperty()
  failed: number;

  @ApiPropertyOptional()
  errors?: string[];
}

// ==================== 清除操作 ====================

export class ClearDataDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  clearMemories?: boolean = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  clearConversations?: boolean = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  clearEntities?: boolean = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  resetPreferences?: boolean = false;
}

export class ClearDataResponseDto {
  @ApiProperty()
  cleared: {
    memories: number;
    conversations: number;
    entities: number;
    preferencesReset: boolean;
  };

  @ApiProperty()
  timestamp: Date;
}
