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
            getConversationContext: jest
              .fn()
              .mockResolvedValue({ id: 'conv-1', participants: [], files: [] }),
            updateConversationPreferences: jest.fn().mockResolvedValue({
              isPinned: true,
              isArchived: false,
              mutedUntil: null,
            }),
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
            getSocialOverview: jest.fn().mockResolvedValue({
              counts: { followers: 1, following: 1, mutual: 1, blocked: 0 },
              recommendations: [],
            }),
            getSocialRelations: jest.fn().mockResolvedValue({
              items: [],
              total: 0,
              page: 1,
              pageSize: 20,
              totalPages: 0,
            }),
            applySocialBulkAction: jest.fn().mockResolvedValue({
              action: 'follow',
              results: [{ userId: 'user-2', success: true }],
            }),
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
      const result = await controller.getConversations(mockUser, {});

      expect(chatService.getConversations).toHaveBeenCalledWith('user-1', {});
      expect(result).toEqual([{ id: 'conv-1' }]);
    });
  });

  describe('getConversationContext', () => {
    it('should return workbench context for a conversation', async () => {
      const result = await controller.getConversationContext(
        mockUser,
        'conv-1',
      );

      expect(chatService.getConversationContext).toHaveBeenCalledWith(
        'conv-1',
        'user-1',
      );
      expect(result).toEqual({ id: 'conv-1', participants: [], files: [] });
    });
  });

  describe('startConversation', () => {
    it('should get or create a conversation with the target user', async () => {
      const result = await controller.startConversation(mockUser, {
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
        mockUser,
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
      await controller.getMessages(mockUser, 'conv-1', undefined, undefined);

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
      const result = await controller.markAsRead(mockUser, 'conv-1');

      expect(chatService.markAsRead).toHaveBeenCalledWith('conv-1', 'user-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('togglePin', () => {
    it('should toggle pin status for a conversation', async () => {
      const result = await controller.togglePin(mockUser, 'conv-1');

      expect(chatService.togglePin).toHaveBeenCalledWith('conv-1', 'user-1');
      expect(result).toEqual({ id: 'conv-1', pinned: true });
    });
  });

  describe('updateConversationPreferences', () => {
    it('should update current user conversation preferences', async () => {
      const dto = { isPinned: true, isArchived: false, mutedUntil: null };
      const result = await controller.updateConversationPreferences(
        mockUser,
        'conv-1',
        dto,
      );

      expect(chatService.updateConversationPreferences).toHaveBeenCalledWith(
        'conv-1',
        'user-1',
        dto,
      );
      expect(result).toEqual(dto);
    });
  });

  // ========== Message Operations ==========

  describe('deleteMessage', () => {
    it('should delete message, broadcast event, and return success', async () => {
      const result = await controller.deleteMessage(mockUser, 'msg-1');

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
      const result = await controller.recallMessage(mockUser, 'msg-1');

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
      const result = await controller.getUnreadCount(mockUser);

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
        mockUser,
        'conv-1',
        {},
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
        {
          content: undefined,
          clientMessageId: undefined,
          replyToId: undefined,
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
      const result = await controller.followUser(mockUser, 'user-2');

      expect(chatService.followUser).toHaveBeenCalledWith('user-1', 'user-2');
      expect(result).toEqual({ success: true });
    });
  });

  describe('unfollowUser', () => {
    it('should unfollow user and return success', async () => {
      const result = await controller.unfollowUser(mockUser, 'user-2');

      expect(chatService.unfollowUser).toHaveBeenCalledWith('user-1', 'user-2');
      expect(result).toEqual({ success: true });
    });
  });

  describe('getSocialOverview', () => {
    it('should return social overview for current user', async () => {
      const result = await controller.getSocialOverview(mockUser);

      expect(chatService.getSocialOverview).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({
        counts: { followers: 1, following: 1, mutual: 1, blocked: 0 },
        recommendations: [],
      });
    });
  });

  describe('getSocialRelations', () => {
    it('should pass relation query through to the service', async () => {
      const query = {
        type: 'followers' as const,
        page: 2,
        pageSize: 10,
        search: 'stanford',
        sort: 'name' as const,
        relationship: 'mutual' as const,
        role: 'verified' as const,
      };

      const result = await controller.getSocialRelations(mockUser, query);

      expect(chatService.getSocialRelations).toHaveBeenCalledWith(
        'user-1',
        query,
      );
      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      });
    });
  });

  describe('socialBulk', () => {
    it('should apply bulk social actions for the current user', async () => {
      const dto = { action: 'follow' as const, userIds: ['user-2'] };
      const result = await controller.socialBulk(mockUser, dto);

      expect(chatService.applySocialBulkAction).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual({
        action: 'follow',
        results: [{ userId: 'user-2', success: true }],
      });
    });
  });

  describe('getFollowers', () => {
    it('should return followers for current user', async () => {
      const result = await controller.getFollowers(mockUser);

      expect(chatService.getFollowers).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([{ id: 'user-2' }]);
    });
  });

  describe('getFollowing', () => {
    it('should return following list for current user', async () => {
      const result = await controller.getFollowing(mockUser);

      expect(chatService.getFollowing).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([{ id: 'user-3' }]);
    });
  });

  describe('getRecommendations', () => {
    it('should return recommended users with parsed limit', async () => {
      const result = await controller.getRecommendations(mockUser, '5');

      expect(chatService.getRecommendedUsers).toHaveBeenCalledWith('user-1', 5);
      expect(result).toEqual([{ id: 'user-4' }]);
    });

    it('should default limit to 10 when not provided', async () => {
      await controller.getRecommendations(mockUser, undefined);

      expect(chatService.getRecommendedUsers).toHaveBeenCalledWith(
        'user-1',
        10,
      );
    });
  });

  // ========== Block / Unblock ==========

  describe('getBlocked', () => {
    it('should return blocked users for current user', async () => {
      const result = await controller.getBlocked(mockUser);

      expect(chatService.getBlocked).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('blockUser', () => {
    it('should block user and return success', async () => {
      const result = await controller.blockUser(mockUser, 'user-2');

      expect(chatService.blockUser).toHaveBeenCalledWith('user-1', 'user-2');
      expect(result).toEqual({ success: true });
    });
  });

  describe('unblockUser', () => {
    it('should unblock user and return success', async () => {
      const result = await controller.unblockUser(mockUser, 'user-2');

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
      const result = await controller.report(mockUser, dto);

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
