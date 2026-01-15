import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: '获取通知列表' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getNotifications(
    @CurrentUser() user: CurrentUserPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const notifications = await this.notificationService.getNotifications(
      user.id,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
    return notifications;
  }

  @Get('unread-count')
  @ApiOperation({ summary: '获取未读通知数量' })
  async getUnreadCount(@CurrentUser() user: CurrentUserPayload) {
    const count = await this.notificationService.getUnreadCount(user.id);
    return { count };
  }

  @Post(':id/read')
  @ApiOperation({ summary: '标记单个通知为已读' })
  async markAsRead(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') notificationId: string,
  ) {
    const success = await this.notificationService.markAsRead(
      user.id,
      notificationId,
    );
    return { success };
  }

  @Post('read-all')
  @ApiOperation({ summary: '标记所有通知为已读' })
  async markAllAsRead(@CurrentUser() user: CurrentUserPayload) {
    const count = await this.notificationService.markAllAsRead(user.id);
    return { count };
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除单个通知' })
  async deleteNotification(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') notificationId: string,
  ) {
    const success = await this.notificationService.deleteNotification(
      user.id,
      notificationId,
    );
    return { success };
  }

  @Delete()
  @ApiOperation({ summary: '清空所有通知' })
  async clearAll(@CurrentUser() user: CurrentUserPayload) {
    await this.notificationService.clearAll(user.id);
    return { success: true };
  }
}
