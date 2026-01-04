import { Controller, Get, Post, Body, Param, Query, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Get my conversations' })
  async getConversations(@CurrentUser() user: CurrentUserPayload) {
    return this.chatService.getConversations(user.id);
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Start conversation with user' })
  async startConversation(@CurrentUser() user: CurrentUserPayload, @Body() data: { userId: string }) {
    return this.chatService.getOrCreateConversation(user.id, data.userId);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages in conversation' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'before', required: false })
  async getMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') conversationId: string,
    @Query('limit') limit?: number,
    @Query('before') before?: string
  ) {
    return this.chatService.getMessages(conversationId, user.id, limit || 50, before);
  }

  @Post('conversations/:id/read')
  @ApiOperation({ summary: 'Mark conversation as read' })
  async markAsRead(@CurrentUser() user: CurrentUserPayload, @Param('id') conversationId: string) {
    await this.chatService.markAsRead(conversationId, user.id);
    return { success: true };
  }

  // Follow/Unfollow
  @Post('follow/:userId')
  @ApiOperation({ summary: 'Follow user' })
  async followUser(@CurrentUser() user: CurrentUserPayload, @Param('userId') userId: string) {
    await this.chatService.followUser(user.id, userId);
    return { success: true };
  }

  @Delete('follow/:userId')
  @ApiOperation({ summary: 'Unfollow user' })
  async unfollowUser(@CurrentUser() user: CurrentUserPayload, @Param('userId') userId: string) {
    await this.chatService.unfollowUser(user.id, userId);
    return { success: true };
  }

  @Get('followers')
  @ApiOperation({ summary: 'Get my followers' })
  async getFollowers(@CurrentUser() user: CurrentUserPayload) {
    return this.chatService.getFollowers(user.id);
  }

  @Get('following')
  @ApiOperation({ summary: 'Get users I follow' })
  async getFollowing(@CurrentUser() user: CurrentUserPayload) {
    return this.chatService.getFollowing(user.id);
  }

  // Block/Unblock
  @Get('blocked')
  @ApiOperation({ summary: 'Get blocked users' })
  async getBlocked(@CurrentUser() user: CurrentUserPayload) {
    return this.chatService.getBlocked(user.id);
  }

  @Post('block/:userId')
  @ApiOperation({ summary: 'Block user' })
  async blockUser(@CurrentUser() user: CurrentUserPayload, @Param('userId') userId: string) {
    await this.chatService.blockUser(user.id, userId);
    return { success: true };
  }

  @Delete('block/:userId')
  @ApiOperation({ summary: 'Unblock user' })
  async unblockUser(@CurrentUser() user: CurrentUserPayload, @Param('userId') userId: string) {
    await this.chatService.unblockUser(user.id, userId);
    return { success: true };
  }

  // Report
  @Post('report')
  @ApiOperation({ summary: 'Report user or message' })
  async report(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: { targetType: 'USER' | 'MESSAGE' | 'CASE' | 'REVIEW'; targetId: string; reason: string; detail?: string }
  ) {
    await this.chatService.report(user.id, data.targetType, data.targetId, data.reason, data.detail);
    return { success: true };
  }
}

