import { Test, TestingModule } from '@nestjs/testing';
import { ForumTeamService } from './forum-team.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import { ForumMemoryService } from './forum-memory.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

describe('ForumTeamService', () => {
  let service: ForumTeamService;
  let prisma: PrismaService;

  const mockPost = {
    id: 'post-1',
    authorId: 'owner-1',
    isTeamPost: true,
    teamStatus: 'RECRUITING',
    teamSize: 4,
    teamMembers: [{ userId: 'owner-1', role: 'owner' }],
  };

  const mockApplication = {
    id: 'app-1',
    postId: 'post-1',
    applicantId: 'user-2',
    status: 'PENDING',
    message: 'I want to join',
    post: mockPost,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumTeamService,
        {
          provide: PrismaService,
          useValue: {
            forumPost: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            teamApplication: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            teamMember: {
              findUnique: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
              create: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        {
          provide: AuthorizationService,
          useValue: {
            verifyOwnership: jest.fn(),
          },
        },
        {
          provide: ForumMemoryService,
          useValue: {
            recordTeamApplicationToMemory: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<ForumTeamService>(ForumTeamService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getApplicationsForPost', () => {
    it('should return applications when caller is the post author', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
        authorId: 'owner-1',
      });
      (prisma.teamApplication.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getApplicationsForPost(
        'post-1',
        'owner-1',
        'USER',
      );

      expect(result).toEqual([]);
    });

    it('should return applications when caller is ADMIN', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
        authorId: 'owner-1',
      });
      (prisma.teamApplication.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getApplicationsForPost(
        'post-1',
        'admin-1',
        'ADMIN',
      );

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when post does not exist', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getApplicationsForPost('nonexistent', 'user-1', 'USER'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when caller is not author or admin', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
        authorId: 'owner-1',
      });

      await expect(
        service.getApplicationsForPost('post-1', 'user-other', 'USER'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('applyToTeam', () => {
    it('should create an application successfully', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prisma.teamApplication.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.teamApplication.create as jest.Mock).mockResolvedValue({
        id: 'app-new',
      });

      const result = await service.applyToTeam('post-1', 'user-2', {
        message: 'I want to join',
      });

      expect(result.applied).toBe(true);
      expect(prisma.teamApplication.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when post does not exist', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.applyToTeam('nonexistent', 'user-2', { message: 'hi' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for non-team post', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
        ...mockPost,
        isTeamPost: false,
      });

      await expect(
        service.applyToTeam('post-1', 'user-2', { message: 'hi' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when applying to own post', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(mockPost);

      await expect(
        service.applyToTeam('post-1', 'owner-1', { message: 'hi' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when team is not recruiting', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
        ...mockPost,
        teamStatus: 'FULL',
      });

      await expect(
        service.applyToTeam('post-1', 'user-2', { message: 'hi' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user is already a member', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue({
        ...mockPost,
        teamMembers: [{ userId: 'user-2', role: 'member' }],
      });

      await expect(
        service.applyToTeam('post-1', 'user-2', { message: 'hi' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate application', async () => {
      (prisma.forumPost.findUnique as jest.Mock).mockResolvedValue(mockPost);
      (prisma.teamApplication.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing',
      });

      await expect(
        service.applyToTeam('post-1', 'user-2', { message: 'hi' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reviewApplication', () => {
    it('should accept an application and add member', async () => {
      (prisma.teamApplication.findUnique as jest.Mock).mockResolvedValue(
        mockApplication,
      );
      (prisma.teamApplication.update as jest.Mock).mockResolvedValue({});
      (prisma.teamMember.create as jest.Mock).mockResolvedValue({});
      (prisma.teamMember.count as jest.Mock).mockResolvedValue(2);
      (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

      await service.reviewApplication('app-1', 'owner-1', {
        status: 'ACCEPTED',
      });

      expect(prisma.teamMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-2',
            role: 'member',
          }),
        }),
      );
    });

    it('should set team status to FULL when capacity is reached', async () => {
      (prisma.teamApplication.findUnique as jest.Mock).mockResolvedValue(
        mockApplication,
      );
      (prisma.teamApplication.update as jest.Mock).mockResolvedValue({});
      (prisma.teamMember.create as jest.Mock).mockResolvedValue({});
      (prisma.teamMember.count as jest.Mock).mockResolvedValue(4); // equals teamSize
      (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

      await service.reviewApplication('app-1', 'owner-1', {
        status: 'ACCEPTED',
      });

      expect(prisma.forumPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ teamStatus: 'FULL' }),
        }),
      );
    });

    it('should throw NotFoundException when application does not exist', async () => {
      (prisma.teamApplication.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.reviewApplication('nonexistent', 'owner-1', {
          status: 'ACCEPTED',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when reviewer is not the team owner', async () => {
      (prisma.teamApplication.findUnique as jest.Mock).mockResolvedValue(
        mockApplication,
      );

      await expect(
        service.reviewApplication('app-1', 'user-other', {
          status: 'ACCEPTED',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when application is already reviewed', async () => {
      (prisma.teamApplication.findUnique as jest.Mock).mockResolvedValue({
        ...mockApplication,
        status: 'ACCEPTED',
      });

      await expect(
        service.reviewApplication('app-1', 'owner-1', {
          status: 'ACCEPTED',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelApplication', () => {
    it('should cancel own pending application', async () => {
      (prisma.teamApplication.findUnique as jest.Mock).mockResolvedValue({
        id: 'app-1',
        applicantId: 'user-2',
        status: 'PENDING',
      });

      await service.cancelApplication('app-1', 'user-2');

      expect(prisma.teamApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'CANCELLED' },
        }),
      );
    });

    it('should throw ForbiddenException when cancelling others application', async () => {
      (prisma.teamApplication.findUnique as jest.Mock).mockResolvedValue({
        id: 'app-1',
        applicantId: 'user-2',
        status: 'PENDING',
      });

      await expect(
        service.cancelApplication('app-1', 'user-other'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when application is already reviewed', async () => {
      (prisma.teamApplication.findUnique as jest.Mock).mockResolvedValue({
        id: 'app-1',
        applicantId: 'user-2',
        status: 'ACCEPTED',
      });

      await expect(
        service.cancelApplication('app-1', 'user-2'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('leaveTeam', () => {
    it('should remove member and re-open recruitment', async () => {
      (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
        id: 'tm-1',
        userId: 'user-2',
        role: 'member',
        post: mockPost,
      });
      (prisma.teamMember.delete as jest.Mock).mockResolvedValue({});
      (prisma.teamMember.count as jest.Mock).mockResolvedValue(1);
      (prisma.forumPost.update as jest.Mock).mockResolvedValue({});

      await service.leaveTeam('post-1', 'user-2');

      expect(prisma.teamMember.delete).toHaveBeenCalled();
      expect(prisma.forumPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ teamStatus: 'RECRUITING' }),
        }),
      );
    });

    it('should throw NotFoundException when user is not a member', async () => {
      (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.leaveTeam('post-1', 'user-3')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when owner tries to leave', async () => {
      (prisma.teamMember.findUnique as jest.Mock).mockResolvedValue({
        id: 'tm-1',
        userId: 'owner-1',
        role: 'owner',
        post: mockPost,
      });

      await expect(service.leaveTeam('post-1', 'owner-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getMyTeams', () => {
    it('should return empty array when user has no teams', async () => {
      const result = await service.getMyTeams('user-1');

      expect(result).toEqual([]);
    });

    it('should return team posts the user belongs to', async () => {
      const mockAuthor = {
        id: 'owner-1',
        role: 'VERIFIED',
        profile: { realName: 'Owner', avatarUrl: null },
      };
      (prisma.teamMember.findMany as jest.Mock).mockResolvedValue([
        {
          post: {
            id: 'post-1',
            categoryId: 'cat-1',
            author: mockAuthor,
            title: 'Team Post',
            content: 'Content',
            tags: [],
            isTeamPost: true,
            teamSize: 4,
            teamStatus: 'RECRUITING',
            viewCount: 10,
            likeCount: 2,
            isPinned: false,
            isLocked: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            _count: { comments: 0, teamMembers: 2 },
          },
        },
      ]);

      const result = await service.getMyTeams('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].isTeamPost).toBe(true);
      expect(result[0].currentSize).toBe(2);
    });
  });
});
