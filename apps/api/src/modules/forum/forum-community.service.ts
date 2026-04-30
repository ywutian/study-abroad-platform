import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CommunityDto,
  CommunityQueryDto,
  CommunityScope,
  CreateCommunityDto,
} from './dto';

@Injectable()
export class ForumCommunityService {
  constructor(private prisma: PrismaService) {}

  async getCommunities(
    userId: string | null,
    query: CommunityQueryDto,
  ): Promise<CommunityDto[]> {
    const scope = query.scope || CommunityScope.POPULAR;
    const where: any = { isActive: true };

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { slug: { contains: this.slugify(query.q), mode: 'insensitive' } },
      ];
    }

    if (scope === CommunityScope.MINE) {
      if (!userId) return [];
      where.followers = { some: { userId } };
    }

    const communities = await this.prisma.forumCommunity.findMany({
      where,
      orderBy:
        scope === CommunityScope.ALL
          ? [{ isOfficial: 'desc' }, { name: 'asc' }]
          : [
              { isOfficial: 'desc' },
              { followerCount: 'desc' },
              { postCount: 'desc' },
            ],
      take: scope === CommunityScope.ALL ? 50 : 20,
      include: {
        followers: userId ? { where: { userId }, select: { id: true } } : false,
      },
    });

    return communities.map((community) => this.mapCommunity(community, userId));
  }

  async createCommunity(
    userId: string,
    data: CreateCommunityDto,
  ): Promise<CommunityDto> {
    const name = data.name.trim();
    const slug = this.slugify(name);
    if (!slug) {
      throw new BadRequestException(
        'Community name must include letters or numbers',
      );
    }

    const existing = await this.prisma.forumCommunity.findUnique({
      where: { slug },
      include: {
        followers: { where: { userId }, select: { id: true } },
      },
    });

    if (existing) {
      return this.mapCommunity(existing, userId);
    }

    const community = await this.prisma.forumCommunity.create({
      data: {
        slug,
        name,
        description: data.description?.trim() || undefined,
        createdById: userId,
      },
      include: {
        followers: { where: { userId }, select: { id: true } },
      },
    });

    return this.mapCommunity(community, userId);
  }

  async followCommunity(
    userId: string,
    communityId: string,
  ): Promise<CommunityDto> {
    const community = await this.prisma.forumCommunity.findFirst({
      where: { id: communityId, isActive: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const existing = await this.prisma.forumCommunityFollow.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (!existing) {
      await this.prisma.$transaction([
        this.prisma.forumCommunityFollow.create({
          data: { userId, communityId },
        }),
        this.prisma.forumCommunity.update({
          where: { id: communityId },
          data: { followerCount: { increment: 1 } },
        }),
      ]);
    }

    const updated = await this.prisma.forumCommunity.findUniqueOrThrow({
      where: { id: communityId },
      include: { followers: { where: { userId }, select: { id: true } } },
    });
    return this.mapCommunity(updated, userId);
  }

  async unfollowCommunity(
    userId: string,
    communityId: string,
  ): Promise<CommunityDto> {
    const community = await this.prisma.forumCommunity.findFirst({
      where: { id: communityId, isActive: true },
    });
    if (!community) throw new NotFoundException('Community not found');

    const existing = await this.prisma.forumCommunityFollow.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (existing) {
      await this.prisma.$transaction([
        this.prisma.forumCommunityFollow.delete({ where: { id: existing.id } }),
        this.prisma.forumCommunity.update({
          where: { id: communityId },
          data: { followerCount: { decrement: 1 } },
        }),
      ]);
    }

    const updated = await this.prisma.forumCommunity.findUniqueOrThrow({
      where: { id: communityId },
      include: { followers: { where: { userId }, select: { id: true } } },
    });
    return this.mapCommunity(updated, userId);
  }

  slugify(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private mapCommunity(community: any, userId: string | null): CommunityDto {
    return {
      id: community.id,
      slug: community.slug,
      name: community.name,
      description: community.description || undefined,
      postCount: community.postCount,
      followerCount: community.followerCount,
      isOfficial: community.isOfficial,
      isFollowing: userId ? (community.followers || []).length > 0 : false,
      createdAt: community.createdAt,
    };
  }
}
