import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService, NotificationType } from './notification.service';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('NotificationService', () => {
  let service: NotificationService;
  let redis: RedisService;
  let prisma: PrismaService;
  let mockEventEmitter: { emit: jest.Mock };

  beforeEach(async () => {
    mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: RedisService,
          useValue: {
            lpush: jest.fn().mockResolvedValue(1),
            ltrim: jest.fn().mockResolvedValue('OK'),
            expire: jest.fn().mockResolvedValue(1),
            incr: jest.fn().mockResolvedValue(1),
            decr: jest.fn().mockResolvedValue(0),
            lrange: jest.fn().mockResolvedValue([]),
            lset: jest.fn().mockResolvedValue('OK'),
            lrem: jest.fn().mockResolvedValue(1),
            get: jest.fn().mockResolvedValue('0'),
            set: jest.fn().mockResolvedValue('OK'),
            del: jest.fn().mockResolvedValue(1),
            sadd: jest.fn().mockResolvedValue(1),
            smembers: jest.fn().mockResolvedValue([]),
            srem: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: PrismaService,
          useValue: {
            schoolListItem: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            userNotificationPreference: {
              findUnique: jest.fn().mockResolvedValue(null),
              upsert: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    redis = module.get<RedisService>(RedisService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('createNotification', () => {
    it('should create a notification and store in Redis', async () => {
      const result = await service.createNotification(
        'user-1',
        NotificationType.NEW_FOLLOWER,
        { actorName: 'Alice' },
      );

      expect(result.id).toBeDefined();
      expect(result.type).toBe(NotificationType.NEW_FOLLOWER);
      expect(result.userId).toBe('user-1');
      expect(result.read).toBe(false);
      expect(result.content).toContain('Alice');
      expect(redis.lpush).toHaveBeenCalled();
      expect(redis.ltrim).toHaveBeenCalled();
      expect(redis.expire).toHaveBeenCalled();
      expect(redis.incr).toHaveBeenCalled();
    });

    it('should push notification via EventEmitter', async () => {
      await service.createNotification(
        'user-1',
        NotificationType.VERIFICATION_APPROVED,
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          userId: 'user-1',
          event: 'notification',
          data: expect.objectContaining({
            type: NotificationType.VERIFICATION_APPROVED,
          }),
        }),
      );
    });

    it('should replace template variables with data', async () => {
      const result = await service.createNotification(
        'user-1',
        NotificationType.POINTS_EARNED,
        { data: { points: '50' } },
      );

      expect(result.content).toContain('50');
    });

    it('should replace {actor} in template', async () => {
      const result = await service.createNotification(
        'user-1',
        NotificationType.POST_REPLY,
        { actorName: 'Bob' },
      );

      expect(result.content).toContain('Bob');
    });

    it('should use custom title and content when provided', async () => {
      const result = await service.createNotification(
        'user-1',
        NotificationType.NEW_FOLLOWER,
        {
          customTitle: 'Custom Title',
          customContent: 'Custom content here',
        },
      );

      expect(result.title).toBe('Custom Title');
      expect(result.content).toBe('Custom content here');
    });

    it('should include actorId and relatedId when provided', async () => {
      const result = await service.createNotification(
        'user-1',
        NotificationType.CASE_HELPFUL,
        {
          actorId: 'actor-1',
          relatedId: 'case-1',
          relatedType: 'case',
        },
      );

      expect(result.actorId).toBe('actor-1');
      expect(result.relatedId).toBe('case-1');
      expect(result.relatedType).toBe('case');
    });
  });

  describe('getNotifications', () => {
    it('should return parsed notifications from Redis', async () => {
      const mockNotif = {
        id: 'notif_1',
        type: NotificationType.NEW_FOLLOWER,
        title: '新粉丝',
        content: 'Test followed you',
        userId: 'user-1',
        read: false,
        createdAt: new Date().toISOString(),
      };

      (redis.lrange as jest.Mock).mockResolvedValue([
        JSON.stringify(mockNotif),
      ]);

      const result = await service.getNotifications('user-1', 20, 0);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('notif_1');
      expect(redis.lrange).toHaveBeenCalledWith('notifications:user-1', 0, 19);
    });

    it('should apply offset and limit correctly', async () => {
      (redis.lrange as jest.Mock).mockResolvedValue([]);

      await service.getNotifications('user-1', 10, 5);

      expect(redis.lrange).toHaveBeenCalledWith('notifications:user-1', 5, 14);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count from Redis', async () => {
      (redis.get as jest.Mock).mockResolvedValue('7');

      const count = await service.getUnreadCount('user-1');
      expect(count).toBe(7);
    });

    it('should return 0 when no count exists', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      const count = await service.getUnreadCount('user-1');
      expect(count).toBe(0);
    });
  });

  describe('registerPushToken', () => {
    it('should store the push token in Redis and refresh TTL', async () => {
      await service.registerPushToken(
        'user-1',
        'ExponentPushToken[test-token]',
        'android',
      );

      expect(redis.sadd).toHaveBeenCalledWith(
        'notification_push_tokens:user-1',
        'ExponentPushToken[test-token]',
      );
      expect(redis.expire).toHaveBeenCalledWith(
        'notification_push_tokens:user-1',
        60 * 60 * 24 * 90,
      );
    });
  });

  describe('preferences', () => {
    it('returns conservative readiness defaults before a user preference row exists', async () => {
      const result = await service.getPreferences('user-1');

      expect(
        (prisma as any).userNotificationPreference.findUnique,
      ).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result).toEqual({
        source: 'default',
        readiness: {
          inAppSurface: true,
          redisNotificationFeed: false,
          remotePush: false,
          email: false,
        },
        updatedAt: null,
      });
    });

    it('updates only provided readiness preference fields', async () => {
      (
        (prisma as any).userNotificationPreference.upsert as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        readinessInAppSurface: true,
        readinessRedisNotificationFeed: true,
        readinessRemotePush: false,
        readinessEmail: false,
        updatedAt: new Date('2026-05-20T19:00:00.000Z'),
      });

      const result = await service.updatePreferences('user-1', {
        readinessRedisNotificationFeed: true,
      });

      expect(
        (prisma as any).userNotificationPreference.upsert,
      ).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        create: {
          userId: 'user-1',
          readinessRedisNotificationFeed: true,
        },
        update: {
          readinessRedisNotificationFeed: true,
        },
      });
      expect(result).toEqual({
        source: 'user',
        readiness: {
          inAppSurface: true,
          redisNotificationFeed: true,
          remotePush: false,
          email: false,
        },
        updatedAt: '2026-05-20T19:00:00.000Z',
      });
    });

    it('returns live channel consent as opt-out by default', async () => {
      const result = await service.getReadinessLiveChannelConsent('user-1');

      expect(
        (prisma as any).userNotificationPreference.findUnique,
      ).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(redis.smembers).toHaveBeenCalledWith(
        'notification_push_tokens:user-1',
      );
      expect(result.channels).toEqual({
        redis_notification_feed: {
          allowed: false,
          preference: false,
          reason: 'default_opt_out',
        },
        remote_push: {
          allowed: false,
          preference: false,
          reason: 'default_opt_out',
          pushTokenCount: 0,
        },
        email: {
          allowed: false,
          preference: false,
          reason: 'default_opt_out',
        },
      });
    });

    it('allows readiness push only with explicit preference and a valid token', async () => {
      (
        (prisma as any).userNotificationPreference.findUnique as jest.Mock
      ).mockResolvedValue({
        userId: 'user-1',
        readinessInAppSurface: true,
        readinessRedisNotificationFeed: true,
        readinessRemotePush: true,
        readinessEmail: false,
        updatedAt: new Date('2026-05-20T19:30:00.000Z'),
      });
      (redis.smembers as jest.Mock).mockResolvedValue([
        'not-an-expo-token',
        'ExponentPushToken[ready-user-token]',
      ]);

      const result = await service.getReadinessLiveChannelConsent('user-1');

      expect(result.channels.redis_notification_feed).toEqual({
        allowed: true,
        preference: true,
        reason: 'user_opted_in',
      });
      expect(result.channels.remote_push).toEqual({
        allowed: true,
        preference: true,
        reason: 'user_opted_in_with_push_token',
        pushTokenCount: 1,
      });
      expect(result.channels.email).toEqual({
        allowed: false,
        preference: false,
        reason: 'user_opted_out',
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark an unread notification as read', async () => {
      const unreadNotif = {
        id: 'notif_1',
        type: NotificationType.NEW_FOLLOWER,
        read: false,
      };
      (redis.lrange as jest.Mock).mockResolvedValue([
        JSON.stringify(unreadNotif),
      ]);

      const result = await service.markAsRead('user-1', 'notif_1');

      expect(result).toBe(true);
      expect(redis.lset).toHaveBeenCalled();
      expect(redis.decr).toHaveBeenCalled();
    });

    it('should return false if notification not found', async () => {
      (redis.lrange as jest.Mock).mockResolvedValue([]);

      const result = await service.markAsRead('user-1', 'nonexistent');
      expect(result).toBe(false);
    });

    it('should not decrement if notification already read', async () => {
      const readNotif = {
        id: 'notif_1',
        type: NotificationType.NEW_FOLLOWER,
        read: true,
      };
      (redis.lrange as jest.Mock).mockResolvedValue([
        JSON.stringify(readNotif),
      ]);

      const result = await service.markAsRead('user-1', 'notif_1');
      expect(result).toBe(false);
      expect(redis.decr).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      const notifications = [
        JSON.stringify({ id: '1', read: false }),
        JSON.stringify({ id: '2', read: true }),
        JSON.stringify({ id: '3', read: false }),
      ];
      (redis.lrange as jest.Mock).mockResolvedValue(notifications);

      const count = await service.markAllAsRead('user-1');

      expect(count).toBe(2);
      expect(redis.lset).toHaveBeenCalledTimes(2);
      expect(redis.set).toHaveBeenCalledWith('unread_count:user-1', '0');
    });

    it('should return 0 when all notifications are already read', async () => {
      const notifications = [JSON.stringify({ id: '1', read: true })];
      (redis.lrange as jest.Mock).mockResolvedValue(notifications);

      const count = await service.markAllAsRead('user-1');
      expect(count).toBe(0);
    });
  });

  describe('deleteNotification', () => {
    it('should delete a notification and adjust unread count', async () => {
      const unreadNotif = { id: 'notif_1', read: false };
      (redis.lrange as jest.Mock).mockResolvedValue([
        JSON.stringify(unreadNotif),
      ]);

      const result = await service.deleteNotification('user-1', 'notif_1');

      expect(result).toBe(true);
      expect(redis.lrem).toHaveBeenCalled();
      expect(redis.decr).toHaveBeenCalled();
    });

    it('should not decrement unread count for already-read notification', async () => {
      const readNotif = { id: 'notif_1', read: true };
      (redis.lrange as jest.Mock).mockResolvedValue([
        JSON.stringify(readNotif),
      ]);

      await service.deleteNotification('user-1', 'notif_1');
      expect(redis.decr).not.toHaveBeenCalled();
    });

    it('should return false if notification not found', async () => {
      (redis.lrange as jest.Mock).mockResolvedValue([]);

      const result = await service.deleteNotification('user-1', 'nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should delete all notifications and reset unread count', async () => {
      await service.clearAll('user-1');

      expect(redis.del).toHaveBeenCalledWith('notifications:user-1');
      expect(redis.set).toHaveBeenCalledWith('unread_count:user-1', '0');
    });
  });

  describe('remote push dispatch', () => {
    it('should send a remote Expo push when the user has registered tokens', async () => {
      (redis.smembers as jest.Mock).mockResolvedValue([
        'ExponentPushToken[test-token]',
      ]);
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ status: 'ok' }] }),
      } as Response);

      await service.createNotification(
        'user-1',
        NotificationType.SYSTEM_BROADCAST,
        {
          customContent: 'Push me',
        },
      );

      expect(fetchMock).toHaveBeenCalledWith(
        'https://exp.host/--/api/v2/push/send',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should remove stale Expo tokens when Expo reports DeviceNotRegistered', async () => {
      (redis.smembers as jest.Mock).mockResolvedValue([
        'ExponentPushToken[stale-token]',
      ]);
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              status: 'error',
              details: { error: 'DeviceNotRegistered' },
            },
          ],
        }),
      } as Response);

      await service.createNotification(
        'user-1',
        NotificationType.SYSTEM_BROADCAST,
        {
          customContent: 'Push me',
        },
      );

      expect(redis.srem).toHaveBeenCalledWith(
        'notification_push_tokens:user-1',
        'ExponentPushToken[stale-token]',
      );
    });
  });
});
