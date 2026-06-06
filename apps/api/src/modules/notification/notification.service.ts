import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OnEvent } from '@nestjs/event-emitter';
import { RedisService } from '../../common/redis/redis.service';
import { REDIS_TTL } from '../../common/redis/redis-ttl.constants';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CHAT_MESSAGE_OFFLINE,
  NOTIFICATION_PUSH,
  type ChatMessageOfflinePayload,
  type NotificationPushPayload,
} from '../../common/events/notification.events';

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

  // 审核类
  CASE_REVIEW_APPROVED = 'CASE_REVIEW_APPROVED',
  CASE_REVIEW_REJECTED = 'CASE_REVIEW_REJECTED',

  // 文书题目
  NEW_ESSAY_PROMPTS = 'NEW_ESSAY_PROMPTS',

  // 管理员广播
  SYSTEM_BROADCAST = 'SYSTEM_BROADCAST',
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

interface NotificationPreferenceRecord {
  readinessInAppSurface: boolean;
  readinessRedisNotificationFeed: boolean;
  readinessRemotePush: boolean;
  readinessEmail: boolean;
  updatedAt?: Date | string | null;
}

export interface NotificationPreferences {
  source: 'default' | 'user';
  readiness: {
    inAppSurface: boolean;
    redisNotificationFeed: boolean;
    remotePush: boolean;
    email: boolean;
  };
  updatedAt: string | null;
}

export interface UpdateNotificationPreferencesInput {
  readinessInAppSurface?: boolean;
  readinessRedisNotificationFeed?: boolean;
  readinessRemotePush?: boolean;
  readinessEmail?: boolean;
}

export type ReadinessLiveChannel =
  | 'redis_notification_feed'
  | 'remote_push'
  | 'email';

export interface ReadinessLiveChannelConsent {
  preferences: NotificationPreferences;
  channels: Record<
    ReadinessLiveChannel,
    {
      allowed: boolean;
      preference: boolean;
      reason: string;
      pushTokenCount?: number;
    }
  >;
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
  [NotificationType.CASE_REVIEW_APPROVED]: {
    title: '案例审核通过',
    content: '你的案例已通过审核，现在对其他用户可见',
  },
  [NotificationType.CASE_REVIEW_REJECTED]: {
    title: '案例审核未通过',
    content: '你的案例未通过审核，请查看原因并修正后重新提交',
  },
  [NotificationType.NEW_ESSAY_PROMPTS]: {
    title: '新文书题目',
    content: '{school} 有 {count} 个新文书题目',
  },
  [NotificationType.SYSTEM_BROADCAST]: {
    title: '系统通知',
    content: '{message}',
  },
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly NOTIFICATION_KEY_PREFIX = 'notifications:';
  private readonly UNREAD_COUNT_KEY_PREFIX = 'unread_count:';
  private readonly PUSH_TOKEN_KEY_PREFIX = 'notification_push_tokens:';
  private readonly MAX_NOTIFICATIONS = 100;
  private readonly NOTIFICATION_TTL = REDIS_TTL.NOTIFICATION;
  private readonly PUSH_TOKEN_TTL = REDIS_TTL.PUSH_TOKEN;
  private readonly EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

  constructor(
    private readonly redis: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
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

    // 通过事件推送到 WebSocket（ChatGateway 监听）
    this.eventEmitter.emit(NOTIFICATION_PUSH, {
      userId,
      event: 'notification',
      data: notification,
    } satisfies NotificationPushPayload);

    try {
      await this.sendRemotePush(notification);
    } catch (error) {
      this.logger.warn(
        `Remote push dispatch failed for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    this.logger.log(`Notification created: ${type} for user ${userId}`);

    return notification;
  }

  async registerPushToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android',
  ): Promise<void> {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      return;
    }

    const key = this.getPushTokenKey(userId);
    await this.redis.sadd(key, normalizedToken);
    await this.redis.expire(key, this.PUSH_TOKEN_TTL);
    this.logger.log(
      `Push token registered for user ${userId} on ${platform}: ${normalizedToken.slice(0, 24)}...`,
    );
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const preference = (await this.preferenceModel.findUnique({
      where: { userId },
    })) as NotificationPreferenceRecord | null;
    return this.toPreferenceView(preference, preference ? 'user' : 'default');
  }

  async updatePreferences(
    userId: string,
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences> {
    const data = {
      ...(input.readinessInAppSurface !== undefined && {
        readinessInAppSurface: input.readinessInAppSurface,
      }),
      ...(input.readinessRedisNotificationFeed !== undefined && {
        readinessRedisNotificationFeed: input.readinessRedisNotificationFeed,
      }),
      ...(input.readinessRemotePush !== undefined && {
        readinessRemotePush: input.readinessRemotePush,
      }),
      ...(input.readinessEmail !== undefined && {
        readinessEmail: input.readinessEmail,
      }),
    };

    const preference = (await this.preferenceModel.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    })) as NotificationPreferenceRecord;
    return this.toPreferenceView(preference, 'user');
  }

  async getReadinessLiveChannelConsent(
    userId: string,
  ): Promise<ReadinessLiveChannelConsent> {
    const preferences = await this.getPreferences(userId);
    const pushTokens = await this.getValidExpoPushTokens(userId);
    const hasUserPreferences = preferences.source === 'user';

    return {
      preferences,
      channels: {
        redis_notification_feed: this.toReadinessChannelConsent(
          preferences.readiness.redisNotificationFeed,
          hasUserPreferences,
        ),
        remote_push: {
          ...this.toReadinessChannelConsent(
            preferences.readiness.remotePush,
            hasUserPreferences,
          ),
          allowed:
            hasUserPreferences &&
            preferences.readiness.remotePush &&
            pushTokens.length > 0,
          reason: this.getReadinessRemotePushReason(
            preferences,
            pushTokens.length,
          ),
          pushTokenCount: pushTokens.length,
        },
        email: this.toReadinessChannelConsent(
          preferences.readiness.email,
          hasUserPreferences,
        ),
      },
    };
  }

  /**
   * 监听离线消息事件，自动创建通知
   */
  @OnEvent(CHAT_MESSAGE_OFFLINE)
  async handleChatMessageOffline(payload: ChatMessageOfflinePayload) {
    await this.createNotification(
      payload.recipientId,
      NotificationType.NEW_MESSAGE,
      {
        actorId: payload.senderId,
        relatedId: payload.conversationId,
        relatedType: 'conversation',
      },
    );
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

  /**
   * Notify users who have a school in their school list about new essay prompts
   */
  async notifyNewEssayPrompts(
    schoolId: string,
    schoolName: string,
    newPromptCount: number,
  ): Promise<void> {
    try {
      const schoolListItems = await this.prisma.schoolListItem.findMany({
        where: { schoolId },
        select: { userId: true },
      });

      const userIds = [...new Set(schoolListItems.map((i) => i.userId))];

      this.logger.log(
        `Notifying ${userIds.length} users about ${newPromptCount} new essay prompts for ${schoolName}`,
      );

      for (const userId of userIds) {
        await this.createNotification(
          userId,
          NotificationType.NEW_ESSAY_PROMPTS,
          {
            relatedId: schoolId,
            relatedType: 'school',
            data: {
              school: schoolName,
              count: String(newPromptCount),
            },
          },
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to send new essay prompt notifications: ${error?.message}`,
      );
    }
  }

  private getNotificationKey(userId: string): string {
    return `${this.NOTIFICATION_KEY_PREFIX}${userId}`;
  }

  private getUnreadCountKey(userId: string): string {
    return `${this.UNREAD_COUNT_KEY_PREFIX}${userId}`;
  }

  private getPushTokenKey(userId: string): string {
    return `${this.PUSH_TOKEN_KEY_PREFIX}${userId}`;
  }

  private get preferenceModel() {
    return (this.prisma as unknown as Record<string, any>)
      .userNotificationPreference;
  }

  private toPreferenceView(
    preference: NotificationPreferenceRecord | null,
    source: NotificationPreferences['source'],
  ): NotificationPreferences {
    return {
      source,
      readiness: {
        inAppSurface: preference?.readinessInAppSurface ?? true,
        redisNotificationFeed:
          preference?.readinessRedisNotificationFeed ?? false,
        remotePush: preference?.readinessRemotePush ?? false,
        email: preference?.readinessEmail ?? false,
      },
      updatedAt: preference?.updatedAt
        ? new Date(preference.updatedAt).toISOString()
        : null,
    };
  }

  private async getValidExpoPushTokens(userId: string): Promise<string[]> {
    return (await this.redis.smembers(this.getPushTokenKey(userId))).filter(
      (token) => token.startsWith('ExponentPushToken['),
    );
  }

  private toReadinessChannelConsent(
    preference: boolean,
    hasUserPreferences: boolean,
  ) {
    return {
      allowed: hasUserPreferences && preference,
      preference,
      reason: hasUserPreferences
        ? preference
          ? 'user_opted_in'
          : 'user_opted_out'
        : 'default_opt_out',
    };
  }

  private getReadinessRemotePushReason(
    preferences: NotificationPreferences,
    pushTokenCount: number,
  ): string {
    if (preferences.source !== 'user') return 'default_opt_out';
    if (!preferences.readiness.remotePush) return 'user_opted_out';
    if (pushTokenCount === 0) return 'missing_push_token';
    return 'user_opted_in_with_push_token';
  }

  private async sendRemotePush(notification: Notification): Promise<void> {
    const pushTokens = await this.getValidExpoPushTokens(notification.userId);

    if (pushTokens.length === 0) {
      return;
    }

    const payload = pushTokens.map((token) => ({
      to: token,
      title: notification.title,
      body: notification.content,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
      data: { notification },
    }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(this.EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(
          `Expo push request failed for user ${notification.userId}: HTTP ${response.status}`,
        );
        return;
      }

      const result = (await response.json().catch(() => null)) as {
        data?: Array<{
          status?: string;
          details?: { error?: string };
          message?: string;
        }>;
      } | null;

      const invalidTokens = (result?.data ?? [])
        .map((ticket, index) =>
          ticket?.status === 'error' &&
          ticket.details?.error === 'DeviceNotRegistered'
            ? pushTokens[index]
            : null,
        )
        .filter((token): token is string => !!token);

      if (invalidTokens.length > 0) {
        await this.redis.srem(
          this.getPushTokenKey(notification.userId),
          ...invalidTokens,
        );
        this.logger.warn(
          `Removed ${invalidTokens.length} stale Expo push token(s) for user ${notification.userId}`,
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
