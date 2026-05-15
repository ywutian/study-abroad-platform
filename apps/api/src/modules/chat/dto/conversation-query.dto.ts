import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export const CHAT_CONVERSATION_FILTERS = [
  'all',
  'unread',
  'pinned',
  'direct',
  'groups',
  'archived',
] as const;

export type ChatConversationFilter = (typeof CHAT_CONVERSATION_FILTERS)[number];

export class ConversationQueryDto {
  @ApiPropertyOptional({
    description: 'Search by title, participant, or last message',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({
    enum: CHAT_CONVERSATION_FILTERS,
    description: 'Conversation workbench filter',
  })
  @IsIn(CHAT_CONVERSATION_FILTERS)
  @IsOptional()
  filter?: ChatConversationFilter;

  @ApiPropertyOptional({
    description: 'Maximum conversations to return',
    default: 50,
  })
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Opaque cursor; currently a conversation id',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  cursor?: string;
}
