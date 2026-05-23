import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

describe('NotificationController', () => {
  let controller: NotificationController;
  let notificationService: NotificationService;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };

  const mockNotification = {
    id: 'notif-1',
    userId: 'user-1',
    type: 'SYSTEM',
    title: 'Welcome',
    content: 'Welcome to the platform',
    read: false,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: {
            getNotifications: jest.fn().mockResolvedValue([mockNotification]),
            getUnreadCount: jest.fn().mockResolvedValue(5),
            registerPushToken: jest.fn().mockResolvedValue(undefined),
            getPreferences: jest.fn().mockResolvedValue({
              source: 'default',
              readiness: {
                inAppSurface: true,
                redisNotificationFeed: false,
                remotePush: false,
                email: false,
              },
              updatedAt: null,
            }),
            updatePreferences: jest.fn().mockResolvedValue({
              source: 'user',
              readiness: {
                inAppSurface: true,
                redisNotificationFeed: true,
                remotePush: false,
                email: false,
              },
              updatedAt: '2026-05-20T19:00:00.000Z',
            }),
            markAsRead: jest.fn().mockResolvedValue(true),
            markAllAsRead: jest.fn().mockResolvedValue(3),
            deleteNotification: jest.fn().mockResolvedValue(true),
            clearAll: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
    notificationService = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('should call notificationService.getNotifications with parsed params', async () => {
      const result = await controller.getNotifications(mockUser, '10', '5');

      expect(notificationService.getNotifications).toHaveBeenCalledWith(
        'user-1',
        10,
        5,
      );
      expect(result).toEqual([mockNotification]);
    });

    it('should use default limit=20 and offset=0 when not provided', async () => {
      await controller.getNotifications(mockUser, undefined, undefined);

      expect(notificationService.getNotifications).toHaveBeenCalledWith(
        'user-1',
        20,
        0,
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return the unread count for the user', async () => {
      const result = await controller.getUnreadCount(mockUser);

      expect(notificationService.getUnreadCount).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ count: 5 });
    });
  });

  describe('registerPushToken', () => {
    it('should call notificationService.registerPushToken with userId and dto', async () => {
      const body: RegisterPushTokenDto = {
        token: 'ExponentPushToken[test-token]',
        platform: 'android',
      };

      const result = await controller.registerPushToken(mockUser, body);

      expect(notificationService.registerPushToken).toHaveBeenCalledWith(
        'user-1',
        'ExponentPushToken[test-token]',
        'android',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('preferences', () => {
    it('should return notification preferences for the user', async () => {
      const result = await controller.getPreferences(mockUser);

      expect(notificationService.getPreferences).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(
        expect.objectContaining({
          source: 'default',
          readiness: expect.objectContaining({
            inAppSurface: true,
            redisNotificationFeed: false,
          }),
        }),
      );
    });

    it('should update notification preferences for the user', async () => {
      const body = { readinessRedisNotificationFeed: true };

      const result = await controller.updatePreferences(mockUser, body);

      expect(notificationService.updatePreferences).toHaveBeenCalledWith(
        'user-1',
        body,
      );
      expect(result).toEqual(
        expect.objectContaining({
          source: 'user',
          readiness: expect.objectContaining({
            redisNotificationFeed: true,
          }),
        }),
      );
    });
  });

  describe('markAsRead', () => {
    it('should call notificationService.markAsRead with userId and notificationId', async () => {
      const result = await controller.markAsRead(mockUser, 'notif-1');

      expect(notificationService.markAsRead).toHaveBeenCalledWith(
        'user-1',
        'notif-1',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('markAllAsRead', () => {
    it('should call notificationService.markAllAsRead with userId', async () => {
      const result = await controller.markAllAsRead(mockUser);

      expect(notificationService.markAllAsRead).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('deleteNotification', () => {
    it('should call notificationService.deleteNotification with userId and id', async () => {
      const result = await controller.deleteNotification(mockUser, 'notif-1');

      expect(notificationService.deleteNotification).toHaveBeenCalledWith(
        'user-1',
        'notif-1',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('clearAll', () => {
    it('should call notificationService.clearAll with userId', async () => {
      const result = await controller.clearAll(mockUser);

      expect(notificationService.clearAll).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ success: true });
    });
  });
});
