import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: jest.Mocked<ChatService>;
  let chatGateway: jest.Mocked<ChatGateway>;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    role: 'USER',
    locale: 'zh',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: {
            getConversations: jest.fn().mockResolvedValue([{ id: 'conv-1' }]),
            getOrCreateConversation: jest
              .fn()
              .mockResolvedValue({ id: 'conv-1' }),
            getMessages: jest
              .fn()
              .mockResolvedValue([{ id: 'msg-1', text: 'hello' }]),
            markAsRead: jest.fn().mockResolvedValue(undefined),
            togglePin: jest
              .fn()
              .mockResolvedValue({ id: 'conv-1', pinned: true }),
            deleteMessage: jest.fn().mockResolvedValue({
              messageId: 'msg-1',
              conversationId: 'conv-1',
            }),
            recallMessage: jest.fn().mockResolvedValue({
              messageId: 'msg-1',
              conversationId: 'conv-1',
            }),
            getTotalUnreadCount: jest.fn().mockResolvedValue({ count: 3 }),
            sendMediaMessage: jest
              .fn()
              .mockResolvedValue({ id: 'msg-2', type: 'IMAGE' }),
            followUser: jest.fn().mockResolvedValue(undefined),
            unfollowUser: jest.fn().mockResolvedValue(undefined),
            getFollowers: jest.fn().mockResolvedValue([{ id: 'user-2' }]),
            getFollowing: jest.fn().mockResolvedValue([{ id: 'user-3' }]),
            getRecommendedUsers: jest
              .fn()
              .mockResolvedValue([{ id: 'user-4' }]),
            getBlocked: jest.fn().mockResolvedValue([]),
            blockUser: jest.fn().mockResolvedValue(undefined),
            unblockUser: jest.fn().mockResolvedValue(undefined),
            report: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ChatGateway,
          useValue: {
            broadcastToConversation: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    chatService = module.get(ChatService);
    chatGateway = module.get(ChatGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========== Conversations ==========

  describe('getConversations', () => {
    it('should return conversations for current user', async () => {
      const result = await controller.getConversations(mockUser as any);

      expect(chatService.getConversations).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([{ id: 'conv-1' }]);
    });
  });

  describe('startConversation', () => {
    it('should get or create a conversation with the target user', async () => {
      const result = await controller.startConversation(mockUser as any, {
        userId: 'user-2',
      });

      expect(chatService.getOrCreateConversation).toHaveBeenCalledWith(
        'user-1',
        'user-2',
      );
      expect(result).toEqual({ id: 'conv-1' });
    });
  });

  describe('getMessages', () => {
    it('should return paginated messages for a conversation', async () => {
      const result = await controller.getMessages(
        mockUser as any,
        'conv-1',
        25,
        'cursor-abc',
      );

      expect(chatService.getMessages).toHaveBeenCalledWith(
        'conv-1',
        'user-1',
        25,
        'cursor-abc',
      );
      expect(result).toEqual([{ id: 'msg-1', text: 'hello' }]);
    });

    it('should default limit to 50 when not provided', async () => {
      await controller.getMessages(
        mockUser as any,
        'conv-1',
        undefined,
        undefined,
      );

      expect(chatService.getMessages).toHaveBeenCalledWith(
        'conv-1',
        'user-1',
        50,
        undefined,
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark conversation as read and return success', async () => {
      const result = await controller.markAsRead(mockUser as any, 'conv-1');

      expect(chatService.markAsRead).toHaveBeenCalledWith('conv-1', 'user-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('togglePin', () => {
    it('should toggle pin status for a conversation', async () => {
      const result = await controller.togglePin(mockUser as any, 'conv-1');

      expect(chatService.togglePin).toHaveBeenCalledWith('conv-1', 'user-1');
      expect(result).toEqual({ id: 'conv-1', pinned: true });
    });
  });

  // ========== Message Operations ==========

  describe('deleteMessage', () => {
    it('should delete message, broadcast event, and return success', async () => {
      const result = await controller.deleteMessage(mockUser as any, 'msg-1');

      expect(chatService.deleteMessage).toHaveBeenCalledWith('msg-1', 'user-1');
      expect(chatGateway.broadcastToConversation).toHaveBeenCalledWith(
        'conv-1',
        'messageDeleted',
        { messageId: 'msg-1', conversationId: 'conv-1' },
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('recallMessage', () => {
    it('should recall message, broadcast event, and return success', async () => {
      const result = await controller.recallMessage(mockUser as any, 'msg-1');

      expect(chatService.recallMessage).toHaveBeenCalledWith('msg-1', 'user-1');
      expect(chatGateway.broadcastToConversation).toHaveBeenCalledWith(
        'conv-1',
        'messageRecalled',
        { messageId: 'msg-1', conversationId: 'conv-1' },
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('getUnreadCount', () => {
    it('should return total unread count for current user', async () => {
      const result = await controller.getUnreadCount(mockUser as any);

      expect(chatService.getTotalUnreadCount).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('uploadFile', () => {
    it('should send media message, broadcast event, and return the message', async () => {
      const mockFile = {
        buffer: Buffer.from('test'),
        mimetype: 'image/png',
        originalname: 'photo.png',
      } as Express.Multer.File;

      const result = await controller.uploadFile(
        mockUser as any,
        'conv-1',
        mockFile,
      );

      expect(chatService.sendMediaMessage).toHaveBeenCalledWith(
        'conv-1',
        'user-1',
        {
          buffer: mockFile.buffer,
          mimetype: 'image/png',
          originalname: 'photo.png',
        },
      );
      expect(chatGateway.broadcastToConversation).toHaveBeenCalledWith(
        'conv-1',
        'newMessage',
        { conversationId: 'conv-1', message: { id: 'msg-2', type: 'IMAGE' } },
      );
      expect(result).toEqual({ id: 'msg-2', type: 'IMAGE' });
    });
  });

  // ========== Follow / Unfollow ==========

  describe('followUser', () => {
    it('should follow user and return success', async () => {
      const result = await controller.followUser(mockUser as any, 'user-2');

      expect(chatService.followUser).toHaveBeenCalledWith('user-1', 'user-2');
      expect(result).toEqual({ success: true });
    });
  });

  describe('unfollowUser', () => {
    it('should unfollow user and return success', async () => {
      const result = await controller.unfollowUser(mockUser as any, 'user-2');

      expect(chatService.unfollowUser).toHaveBeenCalledWith('user-1', 'user-2');
      expect(result).toEqual({ success: true });
    });
  });

  describe('getFollowers', () => {
    it('should return followers for current user', async () => {
      const result = await controller.getFollowers(mockUser as any);

      expect(chatService.getFollowers).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([{ id: 'user-2' }]);
    });
  });

  describe('getFollowing', () => {
    it('should return following list for current user', async () => {
      const result = await controller.getFollowing(mockUser as any);

      expect(chatService.getFollowing).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([{ id: 'user-3' }]);
    });
  });

  describe('getRecommendations', () => {
    it('should return recommended users with parsed limit', async () => {
      const result = await controller.getRecommendations(mockUser as any, '5');

      expect(chatService.getRecommendedUsers).toHaveBeenCalledWith('user-1', 5);
      expect(result).toEqual([{ id: 'user-4' }]);
    });

    it('should default limit to 10 when not provided', async () => {
      await controller.getRecommendations(mockUser as any, undefined);

      expect(chatService.getRecommendedUsers).toHaveBeenCalledWith(
        'user-1',
        10,
      );
    });
  });

  // ========== Block / Unblock ==========

  describe('getBlocked', () => {
    it('should return blocked users for current user', async () => {
      const result = await controller.getBlocked(mockUser as any);

      expect(chatService.getBlocked).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('blockUser', () => {
    it('should block user and return success', async () => {
      const result = await controller.blockUser(mockUser as any, 'user-2');

      expect(chatService.blockUser).toHaveBeenCalledWith('user-1', 'user-2');
      expect(result).toEqual({ success: true });
    });
  });

  describe('unblockUser', () => {
    it('should unblock user and return success', async () => {
      const result = await controller.unblockUser(mockUser as any, 'user-2');

      expect(chatService.unblockUser).toHaveBeenCalledWith('user-1', 'user-2');
      expect(result).toEqual({ success: true });
    });
  });

  // ========== Report ==========

  describe('report', () => {
    it('should submit report and return success', async () => {
      const dto = {
        targetType: 'MESSAGE' as any,
        targetId: 'msg-1',
        reason: 'SPAM' as any,
        detail: 'Unwanted content',
      };
      const result = await controller.report(mockUser as any, dto);

      expect(chatService.report).toHaveBeenCalledWith(
        'user-1',
        'MESSAGE',
        'msg-1',
        'SPAM',
        'Unwanted content',
      );
      expect(result).toEqual({ success: true });
    });
  });
});
