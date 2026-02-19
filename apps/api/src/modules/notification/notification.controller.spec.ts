import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

describe('NotificationController', () => {
  let controller: NotificationController;
  let notificationService: NotificationService;

  const mockUser = { id: 'user-1', email: 'test@test.com', role: 'USER' };

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
      const result = await controller.getNotifications(
        mockUser as any,
        '10',
        '5',
      );

      expect(notificationService.getNotifications).toHaveBeenCalledWith(
        'user-1',
        10,
        5,
      );
      expect(result).toEqual([mockNotification]);
    });

    it('should use default limit=20 and offset=0 when not provided', async () => {
      await controller.getNotifications(mockUser as any, undefined, undefined);

      expect(notificationService.getNotifications).toHaveBeenCalledWith(
        'user-1',
        20,
        0,
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return the unread count for the user', async () => {
      const result = await controller.getUnreadCount(mockUser as any);

      expect(notificationService.getUnreadCount).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ count: 5 });
    });
  });

  describe('markAsRead', () => {
    it('should call notificationService.markAsRead with userId and notificationId', async () => {
      const result = await controller.markAsRead(mockUser as any, 'notif-1');

      expect(notificationService.markAsRead).toHaveBeenCalledWith(
        'user-1',
        'notif-1',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('markAllAsRead', () => {
    it('should call notificationService.markAllAsRead with userId', async () => {
      const result = await controller.markAllAsRead(mockUser as any);

      expect(notificationService.markAllAsRead).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('deleteNotification', () => {
    it('should call notificationService.deleteNotification with userId and id', async () => {
      const result = await controller.deleteNotification(
        mockUser as any,
        'notif-1',
      );

      expect(notificationService.deleteNotification).toHaveBeenCalledWith(
        'user-1',
        'notif-1',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('clearAll', () => {
    it('should call notificationService.clearAll with userId', async () => {
      const result = await controller.clearAll(mockUser as any);

      expect(notificationService.clearAll).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ success: true });
    });
  });
});
