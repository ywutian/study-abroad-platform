/**
 * Agent API 控制器
 */

import { Controller, Post, Delete, Get, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AgentService } from './agent.service';
import { CurrentUser } from '../../../common/decorators';
import type { CurrentUserPayload } from '../../../common/decorators';
import { IsString, IsOptional } from 'class-validator';

class AgentChatDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}

@ApiTags('agent')
@ApiBearerAuth()
@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  /**
   * 与 Agent 对话
   */
  @Post('chat')
  @ApiOperation({ summary: '与 AI Agent 对话' })
  async chat(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: AgentChatDto,
  ) {
    return this.agentService.chat(
      user.id,
      data.message,
      data.conversationId,
    );
  }

  /**
   * 获取对话历史
   */
  @Get('history')
  @ApiOperation({ summary: '获取对话历史' })
  async getHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query('conversationId') conversationId?: string,
  ) {
    const messages = this.agentService.getSessionHistory(user.id, conversationId);
    return {
      messages: messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
        role: m.role,
        content: m.content,
      })),
    };
  }

  /**
   * 清除对话
   */
  @Delete('session')
  @ApiOperation({ summary: '清除当前对话会话' })
  async clearSession(
    @CurrentUser() user: CurrentUserPayload,
    @Query('conversationId') conversationId?: string,
  ) {
    this.agentService.clearSession(user.id, conversationId);
    return { success: true };
  }
}







