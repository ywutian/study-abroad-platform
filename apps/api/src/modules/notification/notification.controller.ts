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
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get notification list' })
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
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser() user: CurrentUserPayload) {
    const count = await this.notificationService.getUnreadCount(user.id);
    return { count };
  }

  @Post('push-token')
  @ApiOperation({ summary: 'Register or refresh a mobile push token' })
  async registerPushToken(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: RegisterPushTokenDto,
  ) {
    await this.notificationService.registerPushToken(
      user.id,
      body.token,
      body.platform,
    );
    return { success: true };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  async getPreferences(@CurrentUser() user: CurrentUserPayload) {
    return this.notificationService.getPreferences(user.id);
  }

  @Post('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updatePreferences(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationService.updatePreferences(user.id, body);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark single notification as read' })
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
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: CurrentUserPayload) {
    const count = await this.notificationService.markAllAsRead(user.id);
    return { count };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete single notification' })
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
  @ApiOperation({ summary: 'Clear all notifications' })
  async clearAll(@CurrentUser() user: CurrentUserPayload) {
    await this.notificationService.clearAll(user.id);
    return { success: true };
  }
}
