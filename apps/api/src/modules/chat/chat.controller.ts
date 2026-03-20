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
  FileTypeValidator,
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
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import { StartConversationDto, CreateReportDto } from './dto';

@ApiTags('chat')
@ApiBearerAuth()
@ThrottleRelaxed()
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
  @ApiOperation({ summary: 'Get my conversation list' })
  async getConversations(@CurrentUser() user: CurrentUserPayload) {
    return this.chatService.getConversations(user.id);
  }

  @Post('conversations')
  @ApiOperation({
    summary:
      'Start conversation (requires VERIFIED/ADMIN role + mutual follow)',
  })
  async startConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: StartConversationDto,
  ) {
    return this.chatService.getOrCreateConversation(user.id, dto.userId);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get conversation messages (paginated)' })
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
  @ApiOperation({ summary: 'Mark conversation as read' })
  async markAsRead(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') conversationId: string,
  ) {
    await this.chatService.markAsRead(conversationId, user.id);
    return { success: true };
  }

  @Post('conversations/:id/pin')
  @ApiOperation({ summary: 'Toggle conversation pin' })
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
  @ApiOperation({ summary: 'Delete message (soft delete)' })
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
  @ApiOperation({ summary: 'Recall message (within 2 minutes)' })
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
  @ApiOperation({ summary: 'Get total unread message count' })
  async getUnreadCount(@CurrentUser() user: CurrentUserPayload) {
    return this.chatService.getTotalUnreadCount(user.id);
  }

  @Post('conversations/:id/upload')
  @ApiOperation({ summary: 'Upload chat file/image' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') conversationId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType:
              /^(image\/(jpeg|png|gif|webp)|application\/pdf|audio\/(mpeg|wav|ogg))$/,
          }),
        ],
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
  @ApiOperation({ summary: 'Follow user' })
  async followUser(
    @CurrentUser() user: CurrentUserPayload,
    @Param('userId') userId: string,
  ) {
    await this.chatService.followUser(user.id, userId);
    return { success: true };
  }

  @Delete('follow/:userId')
  @ApiOperation({ summary: 'Unfollow user' })
  async unfollowUser(
    @CurrentUser() user: CurrentUserPayload,
    @Param('userId') userId: string,
  ) {
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

  @Get('recommendations')
  @ApiOperation({ summary: 'Get recommended users to follow' })
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
  @ApiOperation({ summary: 'Get blocked users' })
  async getBlocked(@CurrentUser() user: CurrentUserPayload) {
    return this.chatService.getBlocked(user.id);
  }

  @Post('block/:userId')
  @ApiOperation({ summary: 'Block user' })
  async blockUser(
    @CurrentUser() user: CurrentUserPayload,
    @Param('userId') userId: string,
  ) {
    await this.chatService.blockUser(user.id, userId);
    return { success: true };
  }

  @Delete('block/:userId')
  @ApiOperation({ summary: 'Unblock user' })
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
  @ApiOperation({ summary: 'Report user/message' })
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
