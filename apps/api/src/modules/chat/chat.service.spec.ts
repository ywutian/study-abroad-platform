import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { MessageFilterService } from './message-filter.service';
import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('ChatService', () => {
  let service: ChatService;
  let prismaService: PrismaService;

  const mockUser1 = { id: 'user-1', email: 'user1@test.com', role: 'USER' };
  const mockUser2 = { id: 'user-2', email: 'user2@test.com', role: 'USER' };

  const mockConversation = {
    id: 'conv-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    participants: [
      { userId: 'user-1', user: mockUser1 },
      { userId: 'user-2', user: mockUser2 },
    ],
  };

  const mockMessage = {
    id: 'msg-123',
    conversationId: 'conv-123',
    senderId: 'user-1',
    content: 'Hello!',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: MessageFilterService,
          useValue: {
            filterMessage: jest.fn().mockImplementation((content) => content),
            validate: jest.fn().mockResolvedValue({ allowed: true }),
            isSpam: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: StorageService,
          useValue: {
            upload: jest.fn().mockResolvedValue({
              url: 'https://example.com/file.png',
              key: 'file.png',
            }),
            delete: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            follow: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
              deleteMany: jest.fn(),
              findMany: jest.fn(),
            },
            block: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
              deleteMany: jest.fn(),
              findMany: jest.fn(),
            },
            conversation: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            conversationParticipant: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            message: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
            },
            report: {
              create: jest.fn(),
            },
            user: {
              findUnique: jest.fn().mockResolvedValue({ role: 'VERIFIED' }),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkMutualFollow', () => {
    it('should return true when users mutually follow', async () => {
      (prismaService.follow.findUnique as jest.Mock)
        .mockResolvedValueOnce({ followerId: 'user-1', followingId: 'user-2' })
        .mockResolvedValueOnce({ followerId: 'user-2', followingId: 'user-1' });

      const result = await service.checkMutualFollow('user-1', 'user-2');

      expect(result).toBe(true);
    });

    it('should return false when follow is not mutual', async () => {
      (prismaService.follow.findUnique as jest.Mock)
        .mockResolvedValueOnce({ followerId: 'user-1', followingId: 'user-2' })
        .mockResolvedValueOnce(null);

      const result = await service.checkMutualFollow('user-1', 'user-2');

      expect(result).toBe(false);
    });
  });

  describe('checkBlocked', () => {
    it('should return true when user is blocked', async () => {
      (prismaService.block.findUnique as jest.Mock).mockResolvedValue({
        blockerId: 'user-1',
        blockedId: 'user-2',
      });

      const result = await service.checkBlocked('user-1', 'user-2');

      expect(result).toBe(true);
    });

    it('should return false when user is not blocked', async () => {
      (prismaService.block.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.checkBlocked('user-1', 'user-2');

      expect(result).toBe(false);
    });
  });

  describe('getOrCreateConversation', () => {
    it('should throw ForbiddenException when not mutual follow', async () => {
      (prismaService.follow.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        service.getOrCreateConversation('user-1', 'user-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when one user is blocked', async () => {
      (prismaService.follow.findUnique as jest.Mock)
        .mockResolvedValueOnce({ followerId: 'user-1', followingId: 'user-2' })
        .mockResolvedValueOnce({ followerId: 'user-2', followingId: 'user-1' });
      (prismaService.block.findUnique as jest.Mock)
        .mockResolvedValueOnce({ blockerId: 'user-1', blockedId: 'user-2' })
        .mockResolvedValueOnce(null);

      await expect(
        service.getOrCreateConversation('user-1', 'user-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return existing conversation', async () => {
      (prismaService.follow.findUnique as jest.Mock)
        .mockResolvedValueOnce({ followerId: 'user-1', followingId: 'user-2' })
        .mockResolvedValueOnce({ followerId: 'user-2', followingId: 'user-1' });
      (prismaService.block.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.conversation.findFirst as jest.Mock).mockResolvedValue(
        mockConversation,
      );

      const result = await service.getOrCreateConversation('user-1', 'user-2');

      expect(result.id).toBe('conv-123');
      expect(prismaService.conversation.create).not.toHaveBeenCalled();
    });

    it('should create new conversation when none exists', async () => {
      (prismaService.follow.findUnique as jest.Mock)
        .mockResolvedValueOnce({ followerId: 'user-1', followingId: 'user-2' })
        .mockResolvedValueOnce({ followerId: 'user-2', followingId: 'user-1' });
      (prismaService.block.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.conversation.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      (prismaService.conversation.create as jest.Mock).mockResolvedValue(
        mockConversation,
      );

      const result = await service.getOrCreateConversation('user-1', 'user-2');

      expect(result.id).toBe('conv-123');
      expect(prismaService.conversation.create).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('should throw ForbiddenException when not a participant', async () => {
      (
        prismaService.conversationParticipant.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(
        service.sendMessage('conv-123', 'user-3', 'Hello'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when blocked by recipient', async () => {
      (
        prismaService.conversationParticipant.findUnique as jest.Mock
      ).mockResolvedValue({
        conversationId: 'conv-123',
        userId: 'user-1',
      });
      (
        prismaService.conversationParticipant.findFirst as jest.Mock
      ).mockResolvedValue({
        userId: 'user-2',
      });
      (prismaService.block.findUnique as jest.Mock).mockResolvedValue({
        blockerId: 'user-2',
        blockedId: 'user-1',
      });

      await expect(
        service.sendMessage('conv-123', 'user-1', 'Hello'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create message and update conversation', async () => {
      (
        prismaService.conversationParticipant.findUnique as jest.Mock
      ).mockResolvedValue({
        conversationId: 'conv-123',
        userId: 'user-1',
      });
      (
        prismaService.conversationParticipant.findFirst as jest.Mock
      ).mockResolvedValue({
        userId: 'user-2',
      });
      (prismaService.block.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.message.create as jest.Mock).mockResolvedValue(
        mockMessage,
      );
      (prismaService.conversation.update as jest.Mock).mockResolvedValue({});

      const result = await service.sendMessage('conv-123', 'user-1', 'Hello!');

      expect(result.content).toBe('Hello!');
      expect(prismaService.conversation.update).toHaveBeenCalled();
    });
  });

  describe('followUser', () => {
    it('should throw BadRequestException when following yourself', async () => {
      await expect(service.followUser('user-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException when blocked by target', async () => {
      (prismaService.block.findUnique as jest.Mock).mockResolvedValue({
        blockerId: 'user-2',
        blockedId: 'user-1',
      });

      await expect(service.followUser('user-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should create follow relationship', async () => {
      (prismaService.block.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.follow.upsert as jest.Mock).mockResolvedValue({
        followerId: 'user-1',
        followingId: 'user-2',
      });

      const result = await service.followUser('user-1', 'user-2');

      expect(result.followerId).toBe('user-1');
      expect(result.followingId).toBe('user-2');
    });
  });

  describe('blockUser', () => {
    it('should throw BadRequestException when blocking yourself', async () => {
      await expect(service.blockUser('user-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should remove existing follows and create block', async () => {
      (prismaService.follow.deleteMany as jest.Mock).mockResolvedValue({
        count: 2,
      });
      (prismaService.block.upsert as jest.Mock).mockResolvedValue({
        blockerId: 'user-1',
        blockedId: 'user-2',
      });

      const result = await service.blockUser('user-1', 'user-2');

      expect(prismaService.follow.deleteMany).toHaveBeenCalled();
      expect(result.blockerId).toBe('user-1');
    });
  });

  describe('getMessages', () => {
    it('should throw ForbiddenException when not a participant', async () => {
      (
        prismaService.conversationParticipant.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(service.getMessages('conv-123', 'user-3')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return messages', async () => {
      (
        prismaService.conversationParticipant.findUnique as jest.Mock
      ).mockResolvedValue({
        conversationId: 'conv-123',
        userId: 'user-1',
      });
      (prismaService.message.findMany as jest.Mock).mockResolvedValue([
        mockMessage,
      ]);

      const result = await service.getMessages('conv-123', 'user-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('markAsRead', () => {
    it('should update lastReadAt', async () => {
      (
        prismaService.conversationParticipant.update as jest.Mock
      ).mockResolvedValue({});

      await service.markAsRead('conv-123', 'user-1');

      expect(prismaService.conversationParticipant.update).toHaveBeenCalledWith(
        {
          where: {
            conversationId_userId: {
              conversationId: 'conv-123',
              userId: 'user-1',
            },
          },
          data: { lastReadAt: expect.any(Date) },
        },
      );
    });
  });
});
