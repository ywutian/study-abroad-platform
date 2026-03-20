/**
 * 用户数据管理 Controller
 *
 * 提供记忆、对话、实体的 CRUD 和数据导出 API
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  Header,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ThrottleSensitive } from '../../common/decorators/throttle.decorator';
import { UserDataService } from './memory/user-data.service';
import {
  QueryMemoriesDto,
  MemoryListResponseDto,
  MemoryItemDto,
  QueryConversationsDto,
  ConversationListResponseDto,
  ConversationDetailDto,
  QueryEntitiesDto,
  EntityListResponseDto,
  AIPreferencesDto,
  AIPreferencesResponseDto,
  DataExportRequestDto,
  DataExportResponseDto,
  MemoryStatsDto,
  BatchDeleteMemoriesDto,
  BatchDeleteResponseDto,
  ClearDataDto,
  ClearDataResponseDto,
} from './dto';

@ApiTags('AI Agent - 用户数据管理')
@ApiBearerAuth()
@ThrottleSensitive()
@Controller('ai-agent/user-data')
@UseGuards(JwtAuthGuard)
export class UserDataController {
  constructor(private userDataService: UserDataService) {}

  // ==================== 记忆管理 ====================

  @Get('memories')
  @ApiOperation({ summary: 'Get memory list' })
  @ApiResponse({ status: 200, type: MemoryListResponseDto })
  async getMemories(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryMemoriesDto,
  ): Promise<MemoryListResponseDto> {
    return this.userDataService.getMemories(user.id, query);
  }

  @Get('memories/:id')
  @ApiOperation({ summary: 'Get single memory' })
  @ApiParam({ name: 'id', description: 'Memory ID' })
  @ApiResponse({ status: 200, type: MemoryItemDto })
  async getMemory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<MemoryItemDto | null> {
    return this.userDataService.getMemory(user.id, id);
  }

  @Delete('memories/:id')
  @ApiOperation({ summary: 'Delete single memory' })
  @ApiParam({ name: 'id', description: 'Memory ID' })
  async deleteMemory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.userDataService.deleteMemory(user.id, id);
    return { message: 'Memory deleted' };
  }

  @Post('memories/batch-delete')
  @ApiOperation({ summary: 'Batch delete memories' })
  @ApiResponse({ status: 200, type: BatchDeleteResponseDto })
  async batchDeleteMemories(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: BatchDeleteMemoriesDto,
  ): Promise<BatchDeleteResponseDto> {
    return this.userDataService.deleteMemories(user.id, body.ids);
  }

  @Delete('memories')
  @ApiOperation({ summary: 'Clear all memories' })
  @ApiResponse({
    status: 200,
    description: 'Returns number of deleted memories',
  })
  async clearAllMemories(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ deleted: number }> {
    const deleted = await this.userDataService.clearAllMemories(user.id);
    return { deleted };
  }

  // ==================== 对话管理 ====================

  @Get('conversations')
  @ApiOperation({ summary: 'Get conversation list' })
  @ApiResponse({ status: 200, type: ConversationListResponseDto })
  async getConversations(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryConversationsDto,
  ): Promise<ConversationListResponseDto> {
    return this.userDataService.getConversations(user.id, query);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get conversation details (with messages)' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, type: ConversationDetailDto })
  async getConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<ConversationDetailDto | null> {
    return this.userDataService.getConversation(user.id, id);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  async deleteConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.userDataService.deleteConversation(user.id, id);
    return { message: 'Conversation deleted' };
  }

  @Delete('conversations')
  @ApiOperation({ summary: 'Clear all conversations' })
  @ApiResponse({
    status: 200,
    description: 'Returns number of deleted conversations',
  })
  async clearAllConversations(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ deleted: number }> {
    const deleted = await this.userDataService.clearAllConversations(user.id);
    return { deleted };
  }

  // ==================== 实体管理 ====================

  @Get('entities')
  @ApiOperation({ summary: 'Get entity list' })
  @ApiResponse({ status: 200, type: EntityListResponseDto })
  async getEntities(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryEntitiesDto,
  ): Promise<EntityListResponseDto> {
    return this.userDataService.getEntities(user.id, query);
  }

  @Delete('entities/:id')
  @ApiOperation({ summary: 'Delete entity' })
  @ApiParam({ name: 'id', description: 'Entity ID' })
  async deleteEntity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.userDataService.deleteEntity(user.id, id);
    return { message: 'Entity deleted' };
  }

  @Delete('entities')
  @ApiOperation({ summary: 'Clear all entities' })
  @ApiResponse({
    status: 200,
    description: 'Returns number of deleted entities',
  })
  async clearAllEntities(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ deleted: number }> {
    const deleted = await this.userDataService.clearAllEntities(user.id);
    return { deleted };
  }

  // ==================== 偏好设置 ====================

  @Get('preferences')
  @ApiOperation({ summary: 'Get AI preferences' })
  @ApiResponse({ status: 200, type: AIPreferencesResponseDto })
  async getPreferences(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AIPreferencesResponseDto> {
    return this.userDataService.getPreferences(user.id);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update AI preferences' })
  @ApiResponse({ status: 200, type: AIPreferencesResponseDto })
  async updatePreferences(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: AIPreferencesDto,
  ): Promise<AIPreferencesResponseDto> {
    return this.userDataService.updatePreferences(user.id, body);
  }

  @Post('preferences/reset')
  @ApiOperation({ summary: 'Reset preferences to defaults' })
  @ApiResponse({ status: 200, type: AIPreferencesResponseDto })
  async resetPreferences(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AIPreferencesResponseDto> {
    await this.userDataService.resetPreferences(user.id);
    return this.userDataService.getPreferences(user.id);
  }

  // ==================== 数据导出 ====================

  @Post('export')
  @ApiOperation({ summary: 'Export all user AI data' })
  @ApiResponse({ status: 200, type: DataExportResponseDto })
  async exportData(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: DataExportRequestDto,
  ): Promise<DataExportResponseDto> {
    return this.userDataService.exportData(user.id, body);
  }

  @Get('export/download')
  @ApiOperation({ summary: 'Download exported data (JSON file)' })
  @Header('Content-Type', 'application/json')
  async downloadExport(
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.userDataService.exportData(user.id, {
      includeMemories: true,
      includeConversations: true,
      includeEntities: true,
      includePreferences: true,
    });

    const filename = `ai-data-export-${user.id}-${Date.now()}.json`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  }

  // ==================== 统计信息 ====================

  @Get('stats')
  @ApiOperation({ summary: 'Get user data statistics' })
  @ApiResponse({ status: 200, type: MemoryStatsDto })
  async getStats(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<MemoryStatsDto> {
    return this.userDataService.getStats(user.id);
  }

  // ==================== 批量清除 ====================

  @Post('clear')
  @ApiOperation({ summary: 'Batch clear data' })
  @ApiResponse({ status: 200, type: ClearDataResponseDto })
  async clearData(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: ClearDataDto,
  ): Promise<ClearDataResponseDto> {
    return this.userDataService.clearData(user.id, body);
  }

  @Delete('all')
  @ApiOperation({
    summary: 'Clear all AI data (memories + conversations + entities)',
  })
  @ApiResponse({ status: 200, type: ClearDataResponseDto })
  async clearAllData(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ClearDataResponseDto> {
    return this.userDataService.clearData(user.id, {
      clearMemories: true,
      clearConversations: true,
      clearEntities: true,
      resetPreferences: false,
    });
  }
}
