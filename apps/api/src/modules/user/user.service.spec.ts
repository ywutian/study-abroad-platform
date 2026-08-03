import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PeerReviewService } from '../peer-review/peer-review.service';
import { NotFoundException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;
  let prismaService: PrismaService;

  // hoisted so hardDelete tests can drive the team-headcount recount
  const txTeamMember = {
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockReturnValue(Promise.resolve({})),
    count: jest.fn().mockResolvedValue(0),
  };
  const txForumPostFindUnique = jest.fn().mockResolvedValue(null);
  const txForumPostUpdate = jest.fn().mockResolvedValue({});
  const txForumComment = {
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockReturnValue(Promise.resolve({})),
    count: jest.fn().mockResolvedValue(0),
  };
  const txForumCommunityFollow = {
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockReturnValue(Promise.resolve({})),
    count: jest.fn().mockResolvedValue(0),
  };
  const txProfileUpdateMany = jest.fn().mockReturnValue(Promise.resolve({}));
  const txForumPostFindMany = jest.fn().mockResolvedValue([]);
  const txPeerReviewFindMany = jest.fn().mockResolvedValue([]);
  const mockPeerReviewService = { updateUserRating: jest.fn() };
  const txForumPostCount = jest.fn().mockResolvedValue(0);
  const txForumCommunityUpdate = jest.fn().mockResolvedValue({});

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed_password',
    role: 'USER',
    emailVerified: false,
    locale: 'zh',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PeerReviewService, useValue: mockPeerReviewService },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            profile: {
              update: jest.fn(),
            },
            refreshToken: {
              deleteMany: jest.fn(),
            },
            $transaction: jest.fn().mockImplementation(async (callback) => {
              const deletedUser = { ...mockUser, deletedAt: new Date() };
              // Helper to create a chainable mock that returns a Promise with .catch()
              const createChainableMock = () =>
                jest.fn().mockReturnValue(Promise.resolve({}));

              const tx = {
                user: {
                  update: jest.fn().mockResolvedValue(deletedUser),
                  delete: jest.fn().mockResolvedValue(deletedUser),
                },
                profile: {
                  update: createChainableMock(),
                  updateMany: txProfileUpdateMany,
                  deleteMany: createChainableMock(),
                },
                refreshToken: {
                  deleteMany: createChainableMock(),
                },
                message: {
                  updateMany: createChainableMock(),
                  deleteMany: createChainableMock(),
                },
                forumPost: {
                  updateMany: createChainableMock(),
                  deleteMany: createChainableMock(),
                  findUnique: txForumPostFindUnique,
                  update: txForumPostUpdate,
                  findMany: txForumPostFindMany,
                  count: txForumPostCount,
                },
                teamMember: txTeamMember,
                peerReview: { findMany: txPeerReviewFindMany },
                forumCommunityFollow: txForumCommunityFollow,
                forumCommunity: { update: txForumCommunityUpdate },
                forumComment: txForumComment,
                admissionCase: {
                  updateMany: createChainableMock(),
                  deleteMany: createChainableMock(),
                },
                vaultItem: {
                  deleteMany: createChainableMock(),
                },
                agentConversation: {
                  deleteMany: createChainableMock(),
                },
                applicationTimeline: {
                  deleteMany: createChainableMock(),
                },
                follow: {
                  deleteMany: createChainableMock(),
                },
                block: {
                  deleteMany: createChainableMock(),
                },
                conversationParticipant: {
                  deleteMany: createChainableMock(),
                },
              };
              return callback(tx);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findById('user-123');

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123', deletedAt: null },
      });
    });

    it('should return null when user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return user when found by email', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@example.com', deletedAt: null },
      });
    });

    it('should return null when email not found', async () => {
      (prismaService.user.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return user when found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findByIdOrThrow('user-123');

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findByIdOrThrow('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createData = {
        email: 'new@example.com',
        passwordHash: 'hashed',
      };
      (prismaService.user.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        ...createData,
      });

      const result = await service.create(createData);

      expect(result.email).toBe('new@example.com');
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: createData,
      });
    });
  });

  describe('update', () => {
    it('should update user data', async () => {
      const updateData = { locale: 'en' };
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        locale: 'en',
      });

      const result = await service.update('user-123', updateData);

      expect(result.locale).toBe('en');
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: updateData,
      });
    });
  });

  describe('softDelete', () => {
    it('should soft delete user by setting deletedAt', async () => {
      const result = await service.softDelete('user-123');

      expect(result.deletedAt).toBeDefined();
      expect(prismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('hardDelete — team headcounts', () => {
    beforeEach(() => {
      txTeamMember.findMany.mockResolvedValue([{ postId: 'post-1' }]);
      txTeamMember.count.mockResolvedValue(2);
      txForumPostUpdate.mockClear();
    });

    it('recounts and re-opens a team the deleted account had filled', async () => {
      // TeamMember cascades off User, so without this the row vanishes and
      // ForumPost.currentSize keeps counting the deleted member forever.
      txForumPostFindUnique.mockResolvedValue({
        teamStatus: 'FULL',
        teamSize: 3,
      });

      await service.hardDelete('user-123');

      expect(txForumPostUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-1' },
          data: { currentSize: 2, teamStatus: 'RECRUITING' },
        }),
      );
    });

    it('recounts but leaves a CLOSED team closed', async () => {
      txForumPostFindUnique.mockResolvedValue({
        teamStatus: 'CLOSED',
        teamSize: 3,
      });

      await service.hardDelete('user-123');

      const data = txForumPostUpdate.mock.calls[0][0].data;
      expect(data.currentSize).toBe(2);
      expect(data).not.toHaveProperty('teamStatus');
    });
  });

  describe('hardDelete — forum counters', () => {
    beforeEach(() => {
      txForumPostUpdate.mockClear();
      txForumCommunityUpdate.mockClear();
      txForumPostFindUnique.mockResolvedValue(null);
      txTeamMember.findMany.mockResolvedValue([]);
    });

    it('recounts commentCount on posts the account had commented on', async () => {
      // ForumComment cascades off User, so these rows vanish with no code run.
      txForumComment.findMany.mockResolvedValue([
        { postId: 'post-9' },
        { postId: 'post-9' },
      ]);
      txForumComment.count.mockResolvedValue(3); // survivors after the delete

      await service.hardDelete('user-123');

      expect(txForumPostUpdate).toHaveBeenCalledWith({
        where: { id: 'post-9' },
        data: { commentCount: 3 },
      });
    });

    it('recounts community postCount and followerCount', async () => {
      txForumComment.findMany.mockResolvedValue([]);
      txForumPostFindMany.mockResolvedValue([{ communityId: 'com-1' }]);
      txForumCommunityFollow.findMany.mockResolvedValue([
        { communityId: 'com-1' },
      ]);
      txForumPostCount.mockResolvedValue(7);
      txForumCommunityFollow.count.mockResolvedValue(4);

      await service.hardDelete('user-123');

      expect(txForumCommunityUpdate).toHaveBeenCalledWith({
        where: { id: 'com-1' },
        data: { postCount: 7, followerCount: 4 },
      });
    });
  });

  describe('hardDelete — peer-review aggregates', () => {
    beforeEach(() => {
      mockPeerReviewService.updateUserRating.mockReset();
      mockPeerReviewService.updateUserRating.mockResolvedValue(undefined);
      txPeerReviewFindMany.mockReset();
    });

    it('recomputes ratings for everyone the account reviewed or was reviewed by', async () => {
      // PeerReview cascades off both sides; each counterparty's stored
      // aggregate mixes forward and reverse scores, so both directions matter.
      txPeerReviewFindMany
        .mockResolvedValueOnce([
          { revieweeId: 'user-b' },
          { revieweeId: 'user-c' },
        ]) // reviews given
        .mockResolvedValueOnce([{ reviewerId: 'user-c' }]); // reviews received

      await service.hardDelete('user-123');

      const recomputed = mockPeerReviewService.updateUserRating.mock.calls
        .map((c) => c[0])
        .sort();
      expect(recomputed).toEqual(['user-b', 'user-c']); // deduped, self excluded
    });

    it('does not fail deletion when a recompute fails', async () => {
      txPeerReviewFindMany
        .mockResolvedValueOnce([{ revieweeId: 'user-b' }])
        .mockResolvedValueOnce([]);
      mockPeerReviewService.updateUserRating.mockRejectedValue(
        new Error('db down'),
      );

      await expect(service.hardDelete('user-123')).resolves.toBeUndefined();
    });
  });

  describe('softDelete — profile anonymisation', () => {
    it('clears the identifiers the profile actually holds', async () => {
      // The endpoint is labelled 注销账号 / 永久删除您的账户和数据. Nothing
      // filters deletedAt when
      // serving profiles or forum posts, and mapForumAuthor reads realName and
      // avatarUrl — so leaving these meant the account stayed named on every
      // post it had written.
      txProfileUpdateMany.mockClear();

      await service.softDelete('user-123');

      expect(txProfileUpdateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: {
          realName: null,
          nickname: null,
          avatarUrl: null,
          bio: null,
          birthday: null,
        },
      });
    });
  });
});
