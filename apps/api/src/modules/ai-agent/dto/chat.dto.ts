/**
 * AI Agent 对话 DTO
 */

import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentType } from '../types';

export class ChatDto {
  @ApiProperty({ description: 'User message content' })
  @IsString()
  @MaxLength(50000)
  message: string;

  @ApiPropertyOptional({
    description: 'Conversation ID (provide when continuing a chat)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  conversationId?: string;

  @ApiPropertyOptional({ description: 'Whether to enable streaming output' })
  @IsOptional()
  @IsBoolean()
  stream?: boolean;

  @ApiPropertyOptional({ description: 'User language preference' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;
}

export class DirectAgentDto {
  @ApiProperty({ description: 'Target agent type', enum: AgentType })
  @IsEnum(AgentType)
  agent: AgentType;

  @ApiProperty({ description: 'User message content' })
  @IsString()
  @MaxLength(50000)
  message: string;

  @ApiPropertyOptional({
    description: 'Conversation ID (provide when continuing a chat)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  conversationId?: string;

  @ApiPropertyOptional({ description: 'User language preference' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;
}
