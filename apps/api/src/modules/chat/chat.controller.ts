import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { StartConversationDto, CreateReportDto } from './dto';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ============================================
  // 会话
  // ============================================

  @Get('conversations')
  @ApiOperation({ summary: '获取我的会话列表' })
  async getConversations(@CurrentUser() user: CurrentUserPayload) {
    return this.chatService.getConversations(user.id);
  }

  @Post('conversations')
  @ApiOperation({ summary: '发起会话（需 VERIFIED/ADMIN 角色 + 互关）' })
  async startConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: StartConversationDto,
  ) {
    return this.chatService.getOrCreateConversation(user.id, dto.userId);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: '获取会话消息（分页）' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'before', required: false })
  async getMessages(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') conversationId: string,
    @Query('limit') limit?: number,
    @Query('before') before?: string,
  ) {
    return this.chatService.getMessages(
      conversationId,
      user.id,
      limit || 50,
      before,
    );
  }

  @Post('conversations/:id/read')
  @ApiOperation({ summary: '标记会话已读' })
  async markAsRead(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') conversationId: string,
  ) {
    await this.chatService.markAsRead(conversationId, user.id);
    return { success: true };
  }

  // ============================================
  // 关注 / 取关
  // ============================================

  @Post('follow/:userId')
  @ApiOperation({ summary: '关注用户' })
  async followUser(
    @CurrentUser() user: CurrentUserPayload,
    @Param('userId') userId: string,
  ) {
    await this.chatService.followUser(user.id, userId);
    return { success: true };
  }

  @Delete('follow/:userId')
  @ApiOperation({ summary: '取消关注' })
  async unfollowUser(
    @CurrentUser() user: CurrentUserPayload,
    @Param('userId') userId: string,
  ) {
    await this.chatService.unfollowUser(user.id, userId);
    return { success: true };
  }

  @Get('followers')
  @ApiOperation({ summary: '获取我的粉丝' })
  async getFollowers(@CurrentUser() user: CurrentUserPayload) {
    return this.chatService.getFollowers(user.id);
  }

  @Get('following')
  @ApiOperation({ summary: '获取我关注的人' })
  async getFollowing(@CurrentUser() user: CurrentUserPayload) {
    return this.chatService.getFollowing(user.id);
  }

  @Get('recommendations')
  @ApiOperation({ summary: '获取推荐关注的用户' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecommendations(
    @CurrentUser() user: CurrentUserPayload,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getRecommendedUsers(
      user.id,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  // ============================================
  // 屏蔽 / 解除屏蔽
  // ============================================

  @Get('blocked')
  @ApiOperation({ summary: '获取已屏蔽用户' })
  async getBlocked(@CurrentUser() user: CurrentUserPayload) {
    return this.chatService.getBlocked(user.id);
  }

  @Post('block/:userId')
  @ApiOperation({ summary: '屏蔽用户' })
  async blockUser(
    @CurrentUser() user: CurrentUserPayload,
    @Param('userId') userId: string,
  ) {
    await this.chatService.blockUser(user.id, userId);
    return { success: true };
  }

  @Delete('block/:userId')
  @ApiOperation({ summary: '解除屏蔽' })
  async unblockUser(
    @CurrentUser() user: CurrentUserPayload,
    @Param('userId') userId: string,
  ) {
    await this.chatService.unblockUser(user.id, userId);
    return { success: true };
  }

  // ============================================
  // 举报
  // ============================================

  @Post('report')
  @ApiOperation({ summary: '举报用户/消息' })
  async report(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateReportDto,
  ) {
    await this.chatService.report(
      user.id,
      dto.targetType,
      dto.targetId,
      dto.reason,
      dto.detail,
    );
    return { success: true };
  }
}
