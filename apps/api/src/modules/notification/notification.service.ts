import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import type { ChatGateway } from '../chat/chat.gateway';

export enum NotificationType {
  // 社交类
  NEW_FOLLOWER = 'NEW_FOLLOWER',
  FOLLOW_ACCEPTED = 'FOLLOW_ACCEPTED',
  NEW_MESSAGE = 'NEW_MESSAGE',

  // 内容类
  CASE_HELPFUL = 'CASE_HELPFUL',
  ESSAY_COMMENT = 'ESSAY_COMMENT',
  POST_REPLY = 'POST_REPLY',
  POST_LIKE = 'POST_LIKE',

  // 系统类
  VERIFICATION_APPROVED = 'VERIFICATION_APPROVED',
  VERIFICATION_REJECTED = 'VERIFICATION_REJECTED',
  POINTS_EARNED = 'POINTS_EARNED',
  LEVEL_UP = 'LEVEL_UP',

  // 提醒类
  DEADLINE_REMINDER = 'DEADLINE_REMINDER',
  PROFILE_INCOMPLETE = 'PROFILE_INCOMPLETE',
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  userId: string;
  actorId?: string; // 触发者ID
  actorName?: string;
  relatedId?: string; // 相关资源ID
  relatedType?: string; // case, post, message等
  read: boolean;
  createdAt: string;
}

const NOTIFICATION_TEMPLATES: Record<
  NotificationType,
  { title: string; content: string }
> = {
  [NotificationType.NEW_FOLLOWER]: {
    title: '新粉丝',
    content: '{actor} 关注了你',
  },
  [NotificationType.FOLLOW_ACCEPTED]: {
    title: '关注成功',
    content: '{actor} 接受了你的关注',
  },
  [NotificationType.NEW_MESSAGE]: {
    title: '新消息',
    content: '{actor} 给你发送了一条消息',
  },
  [NotificationType.CASE_HELPFUL]: {
    title: '案例获赞',
    content: '你的案例被标记为有帮助，获得 +10 积分',
  },
  [NotificationType.ESSAY_COMMENT]: {
    title: '文书评论',
    content: '{actor} 评论了你的文书',
  },
  [NotificationType.POST_REPLY]: {
    title: '帖子回复',
    content: '{actor} 回复了你的帖子',
  },
  [NotificationType.POST_LIKE]: {
    title: '帖子获赞',
    content: '{actor} 赞了你的帖子',
  },
  [NotificationType.VERIFICATION_APPROVED]: {
    title: '认证通过',
    content: '恭喜！你的身份认证已通过，获得 +100 积分',
  },
  [NotificationType.VERIFICATION_REJECTED]: {
    title: '认证未通过',
    content: '你的身份认证未通过，请查看原因并重新提交',
  },
  [NotificationType.POINTS_EARNED]: {
    title: '积分获取',
    content: '你获得了 {points} 积分',
  },
  [NotificationType.LEVEL_UP]: {
    title: '等级提升',
    content: '恭喜！你的等级提升到 {level}',
  },
  [NotificationType.DEADLINE_REMINDER]: {
    title: '截止日期提醒',
    content: '{school} 的申请截止日期还有 {days} 天',
  },
  [NotificationType.PROFILE_INCOMPLETE]: {
    title: '完善档案',
    content: '完善你的档案可获得 +30 积分',
  },
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly NOTIFICATION_KEY_PREFIX = 'notifications:';
  private readonly UNREAD_COUNT_KEY_PREFIX = 'unread_count:';
  private readonly MAX_NOTIFICATIONS = 100;
  private readonly NOTIFICATION_TTL = 60 * 60 * 24 * 30; // 30天

  constructor(
    private readonly redis: RedisService,
    @Inject(forwardRef(() => require('../chat/chat.gateway').ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * 创建并发送通知
   */
  async createNotification(
    userId: string,
    type: NotificationType,
    options: {
      actorId?: string;
      actorName?: string;
      relatedId?: string;
      relatedType?: string;
      customTitle?: string;
      customContent?: string;
      data?: Record<string, string>;
    } = {},
  ): Promise<Notification> {
    const template = NOTIFICATION_TEMPLATES[type];
    let title = options.customTitle || template.title;
    let content = options.customContent || template.content;

    // 替换模板变量
    if (options.actorName) {
      content = content.replace('{actor}', options.actorName);
    }
    if (options.data) {
      Object.entries(options.data).forEach(([key, value]) => {
        content = content.replace(`{${key}}`, value);
        title = title.replace(`{${key}}`, value);
      });
    }

    const notification: Notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      content,
      userId,
      actorId: options.actorId,
      actorName: options.actorName,
      relatedId: options.relatedId,
      relatedType: options.relatedType,
      read: false,
      createdAt: new Date().toISOString(),
    };

    // 存储到Redis
    const key = this.getNotificationKey(userId);
    await this.redis.lpush(key, JSON.stringify(notification));
    await this.redis.ltrim(key, 0, this.MAX_NOTIFICATIONS - 1);
    await this.redis.expire(key, this.NOTIFICATION_TTL);

    // 增加未读计数
    await this.redis.incr(this.getUnreadCountKey(userId));

    // 通过WebSocket推送
    this.chatGateway.sendToUser(userId, 'notification', notification);

    this.logger.log(`Notification created: ${type} for user ${userId}`);

    return notification;
  }

  /**
   * 获取用户通知列表
   */
  async getNotifications(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<Notification[]> {
    const key = this.getNotificationKey(userId);
    const notifications = await this.redis.lrange(
      key,
      offset,
      offset + limit - 1,
    );
    return notifications.map((n) => JSON.parse(n) as Notification);
  }

  /**
   * 获取未读通知数量
   */
  async getUnreadCount(userId: string): Promise<number> {
    const count = await this.redis.get(this.getUnreadCountKey(userId));
    return parseInt(count || '0', 10);
  }

  /**
   * 标记单个通知为已读
   */
  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    const key = this.getNotificationKey(userId);
    const notifications = await this.redis.lrange(key, 0, -1);

    for (let i = 0; i < notifications.length; i++) {
      const notification = JSON.parse(notifications[i]) as Notification;
      if (notification.id === notificationId && !notification.read) {
        notification.read = true;
        await this.redis.lset(key, i, JSON.stringify(notification));
        await this.redis.decr(this.getUnreadCountKey(userId));
        return true;
      }
    }
    return false;
  }

  /**
   * 标记所有通知为已读
   */
  async markAllAsRead(userId: string): Promise<number> {
    const key = this.getNotificationKey(userId);
    const notifications = await this.redis.lrange(key, 0, -1);
    let count = 0;

    for (let i = 0; i < notifications.length; i++) {
      const notification = JSON.parse(notifications[i]) as Notification;
      if (!notification.read) {
        notification.read = true;
        await this.redis.lset(key, i, JSON.stringify(notification));
        count++;
      }
    }

    // 重置未读计数
    await this.redis.set(this.getUnreadCountKey(userId), '0');

    return count;
  }

  /**
   * 删除通知
   */
  async deleteNotification(
    userId: string,
    notificationId: string,
  ): Promise<boolean> {
    const key = this.getNotificationKey(userId);
    const notifications = await this.redis.lrange(key, 0, -1);

    for (const notifStr of notifications) {
      const notification = JSON.parse(notifStr) as Notification;
      if (notification.id === notificationId) {
        await this.redis.lrem(key, 1, notifStr);
        if (!notification.read) {
          await this.redis.decr(this.getUnreadCountKey(userId));
        }
        return true;
      }
    }
    return false;
  }

  /**
   * 清空所有通知
   */
  async clearAll(userId: string): Promise<void> {
    await this.redis.del(this.getNotificationKey(userId));
    await this.redis.set(this.getUnreadCountKey(userId), '0');
  }

  private getNotificationKey(userId: string): string {
    return `${this.NOTIFICATION_KEY_PREFIX}${userId}`;
  }

  private getUnreadCountKey(userId: string): string {
    return `${this.UNREAD_COUNT_KEY_PREFIX}${userId}`;
  }
}
