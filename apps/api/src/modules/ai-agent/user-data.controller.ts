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
  HttpCode,
  HttpStatus,
  Res,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
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
@Controller('ai-agent/user-data')
@UseGuards(JwtAuthGuard)
export class UserDataController {
  constructor(private userDataService: UserDataService) {}

  // ==================== 记忆管理 ====================

  @Get('memories')
  @ApiOperation({ summary: '获取记忆列表' })
  @ApiResponse({ status: 200, type: MemoryListResponseDto })
  async getMemories(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryMemoriesDto,
  ): Promise<MemoryListResponseDto> {
    return this.userDataService.getMemories(user.userId, query);
  }

  @Get('memories/:id')
  @ApiOperation({ summary: '获取单条记忆' })
  @ApiParam({ name: 'id', description: '记忆ID' })
  @ApiResponse({ status: 200, type: MemoryItemDto })
  async getMemory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<MemoryItemDto | null> {
    return this.userDataService.getMemory(user.userId, id);
  }

  @Delete('memories/:id')
  @ApiOperation({ summary: '删除单条记忆' })
  @ApiParam({ name: 'id', description: '记忆ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMemory(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.userDataService.deleteMemory(user.userId, id);
  }

  @Post('memories/batch-delete')
  @ApiOperation({ summary: '批量删除记忆' })
  @ApiResponse({ status: 200, type: BatchDeleteResponseDto })
  async batchDeleteMemories(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: BatchDeleteMemoriesDto,
  ): Promise<BatchDeleteResponseDto> {
    return this.userDataService.deleteMemories(user.userId, body.ids);
  }

  @Delete('memories')
  @ApiOperation({ summary: '清除所有记忆' })
  @ApiResponse({ status: 200, description: '返回删除的记忆数量' })
  async clearAllMemories(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ deleted: number }> {
    const deleted = await this.userDataService.clearAllMemories(user.userId);
    return { deleted };
  }

  // ==================== 对话管理 ====================

  @Get('conversations')
  @ApiOperation({ summary: '获取对话列表' })
  @ApiResponse({ status: 200, type: ConversationListResponseDto })
  async getConversations(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryConversationsDto,
  ): Promise<ConversationListResponseDto> {
    return this.userDataService.getConversations(user.userId, query);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: '获取对话详情（含消息）' })
  @ApiParam({ name: 'id', description: '对话ID' })
  @ApiResponse({ status: 200, type: ConversationDetailDto })
  async getConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<ConversationDetailDto | null> {
    return this.userDataService.getConversation(user.userId, id);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: '删除对话' })
  @ApiParam({ name: 'id', description: '对话ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.userDataService.deleteConversation(user.userId, id);
  }

  @Delete('conversations')
  @ApiOperation({ summary: '清除所有对话' })
  @ApiResponse({ status: 200, description: '返回删除的对话数量' })
  async clearAllConversations(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ deleted: number }> {
    const deleted = await this.userDataService.clearAllConversations(
      user.userId,
    );
    return { deleted };
  }

  // ==================== 实体管理 ====================

  @Get('entities')
  @ApiOperation({ summary: '获取实体列表' })
  @ApiResponse({ status: 200, type: EntityListResponseDto })
  async getEntities(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryEntitiesDto,
  ): Promise<EntityListResponseDto> {
    return this.userDataService.getEntities(user.userId, query);
  }

  @Delete('entities/:id')
  @ApiOperation({ summary: '删除实体' })
  @ApiParam({ name: 'id', description: '实体ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEntity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.userDataService.deleteEntity(user.userId, id);
  }

  @Delete('entities')
  @ApiOperation({ summary: '清除所有实体' })
  @ApiResponse({ status: 200, description: '返回删除的实体数量' })
  async clearAllEntities(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ deleted: number }> {
    const deleted = await this.userDataService.clearAllEntities(user.userId);
    return { deleted };
  }

  // ==================== 偏好设置 ====================

  @Get('preferences')
  @ApiOperation({ summary: '获取 AI 偏好设置' })
  @ApiResponse({ status: 200, type: AIPreferencesResponseDto })
  async getPreferences(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AIPreferencesResponseDto> {
    return this.userDataService.getPreferences(user.userId);
  }

  @Put('preferences')
  @ApiOperation({ summary: '更新 AI 偏好设置' })
  @ApiResponse({ status: 200, type: AIPreferencesResponseDto })
  async updatePreferences(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: AIPreferencesDto,
  ): Promise<AIPreferencesResponseDto> {
    return this.userDataService.updatePreferences(user.userId, body);
  }

  @Post('preferences/reset')
  @ApiOperation({ summary: '重置偏好设置为默认值' })
  @ApiResponse({ status: 200, type: AIPreferencesResponseDto })
  async resetPreferences(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AIPreferencesResponseDto> {
    await this.userDataService.resetPreferences(user.userId);
    return this.userDataService.getPreferences(user.userId);
  }

  // ==================== 数据导出 ====================

  @Post('export')
  @ApiOperation({ summary: '导出用户所有 AI 数据' })
  @ApiResponse({ status: 200, type: DataExportResponseDto })
  async exportData(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: DataExportRequestDto,
  ): Promise<DataExportResponseDto> {
    return this.userDataService.exportData(user.userId, body);
  }

  @Get('export/download')
  @ApiOperation({ summary: '下载导出数据（JSON 文件）' })
  @Header('Content-Type', 'application/json')
  async downloadExport(
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.userDataService.exportData(user.userId, {
      includeMemories: true,
      includeConversations: true,
      includeEntities: true,
      includePreferences: true,
    });

    const filename = `ai-data-export-${user.userId}-${Date.now()}.json`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  }

  // ==================== 统计信息 ====================

  @Get('stats')
  @ApiOperation({ summary: '获取用户数据统计' })
  @ApiResponse({ status: 200, type: MemoryStatsDto })
  async getStats(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<MemoryStatsDto> {
    return this.userDataService.getStats(user.userId);
  }

  // ==================== 批量清除 ====================

  @Post('clear')
  @ApiOperation({ summary: '批量清除数据' })
  @ApiResponse({ status: 200, type: ClearDataResponseDto })
  async clearData(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: ClearDataDto,
  ): Promise<ClearDataResponseDto> {
    return this.userDataService.clearData(user.userId, body);
  }

  @Delete('all')
  @ApiOperation({ summary: '清除所有 AI 数据（记忆+对话+实体）' })
  @ApiResponse({ status: 200, type: ClearDataResponseDto })
  async clearAllData(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ClearDataResponseDto> {
    return this.userDataService.clearData(user.userId, {
      clearMemories: true,
      clearConversations: true,
      clearEntities: true,
      resetPreferences: false,
    });
  }
}
