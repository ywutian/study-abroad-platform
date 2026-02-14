import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
  Patch,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { StartConversationDto, CreateReportDto } from './dto';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chats')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

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

  @Post('conversations/:id/pin')
  @ApiOperation({ summary: '切换会话置顶' })
  async togglePin(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') conversationId: string,
  ) {
    return this.chatService.togglePin(conversationId, user.id);
  }

  // ============================================
  // 消息操作
  // ============================================

  @Delete('messages/:id')
  @ApiOperation({ summary: '删除消息（软删除）' })
  async deleteMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') messageId: string,
  ) {
    const result = await this.chatService.deleteMessage(messageId, user.id);
    // 广播给会话内的其他参与者
    this.chatGateway.broadcastToConversation(
      result.conversationId,
      'messageDeleted',
      { messageId: result.messageId, conversationId: result.conversationId },
    );
    return { success: true };
  }

  @Patch('messages/:id/recall')
  @ApiOperation({ summary: '撤回消息（2分钟内）' })
  async recallMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') messageId: string,
  ) {
    const result = await this.chatService.recallMessage(messageId, user.id);
    this.chatGateway.broadcastToConversation(
      result.conversationId,
      'messageRecalled',
      { messageId: result.messageId, conversationId: result.conversationId },
    );
    return { success: true };
  }

  @Get('unread-count')
  @ApiOperation({ summary: '获取总未读消息数' })
  async getUnreadCount(@CurrentUser() user: CurrentUserPayload) {
    return this.chatService.getTotalUnreadCount(user.id);
  }

  @Post('conversations/:id/upload')
  @ApiOperation({ summary: '上传聊天文件/图片' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') conversationId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    const message = await this.chatService.sendMediaMessage(
      conversationId,
      user.id,
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
      },
    );

    // 广播新消息
    this.chatGateway.broadcastToConversation(conversationId, 'newMessage', {
      conversationId,
      message,
    });

    return message;
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
