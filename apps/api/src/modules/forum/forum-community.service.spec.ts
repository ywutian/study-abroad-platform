import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ForumCommunityService } from './forum-community.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CommunityScope } from './dto';

describe('ForumCommunityService', () => {
  let service: ForumCommunityService;
  let prisma: any;

  const community = {
    id: 'community-1',
    slug: 'sat',
    name: 'SAT',
    description: null,
    postCount: 12,
    followerCount: 3,
    isOfficial: true,
    isActive: true,
    createdAt: new Date(),
    followers: [],
  };

  beforeEach(() => {
    prisma = {
      forumCommunity: {
        findMany: jest.fn().mockResolvedValue([community]),
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(community),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...community,
          followers: [{ id: 'follow-1' }],
        }),
        create: jest.fn().mockResolvedValue(community),
        update: jest.fn().mockResolvedValue(community),
      },
      forumCommunityFollow: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'follow-1' }),
        delete: jest.fn().mockResolvedValue({ id: 'follow-1' }),
      },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    service = new ForumCommunityService(prisma as PrismaService);
  });

  it('returns an empty mine scope for anonymous users', async () => {
    const result = await service.getCommunities(null, {
      scope: CommunityScope.MINE,
    });

    expect(result).toEqual([]);
    expect(prisma.forumCommunity.findMany).not.toHaveBeenCalled();
  });

  it('creates a slugged community', async () => {
    prisma.forumCommunity.findUnique.mockResolvedValue(null);

    await service.createCommunity('user-1', { name: 'Personal Essay' });

    expect(prisma.forumCommunity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'personal-essay',
          createdById: 'user-1',
        }),
      }),
    );
  });

  it('rejects names without usable slug characters', async () => {
    await expect(
      service.createCommunity('user-1', { name: '!!!' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('follows a community idempotently', async () => {
    prisma.forumCommunityFollow.findUnique.mockResolvedValue(null);

    const result = await service.followCommunity('user-1', 'community-1');

    expect(result.isFollowing).toBe(true);
    expect(prisma.forumCommunityFollow.create).toHaveBeenCalled();
    expect(prisma.forumCommunity.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { followerCount: { increment: 1 } } }),
    );
  });

  it('throws when following a missing community', async () => {
    prisma.forumCommunity.findFirst.mockResolvedValue(null);

    await expect(service.followCommunity('user-1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
