import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto, CategoryDto } from './dto';

@Injectable()
export class ForumCategoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get forum statistics including post count, user count, active team count, and daily active users.
   *
   * @returns Forum statistics object
   */
  async getStats(): Promise<{
    postCount: number;
    userCount: number;
    teamingCount: number;
    activeToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [postCount, userCount, teamingCount, activeToday] = await Promise.all(
      [
        // 总帖子数
        this.prisma.forumPost.count(),
        // 发帖用户数
        this.prisma.forumPost
          .groupBy({
            by: ['authorId'],
          })
          .then((groups) => groups.length),
        // 正在组队的帖子数
        this.prisma.forumPost.count({
          where: {
            isTeamPost: true,
            teamStatus: 'RECRUITING',
          },
        }),
        // 今日活跃（今日发帖或评论的用户数）
        Promise.all([
          this.prisma.forumPost.findMany({
            where: { createdAt: { gte: today } },
            select: { authorId: true },
          }),
          this.prisma.forumComment.findMany({
            where: { createdAt: { gte: today } },
            select: { authorId: true },
          }),
        ]).then(([posts, comments]) => {
          const userIds = new Set([
            ...posts.map((p) => p.authorId),
            ...comments.map((c) => c.authorId),
          ]);
          return userIds.size;
        }),
      ],
    );

    return {
      postCount,
      userCount,
      teamingCount,
      activeToday,
    };
  }

  /**
   * Get all active categories with post counts, ordered by sortOrder.
   *
   * @returns Array of categories with post counts
   */
  async getCategories(): Promise<CategoryDto[]> {
    const categories = await this.prisma.forumCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { posts: true } },
      },
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      nameZh: c.nameZh,
      description: c.description || undefined,
      descriptionZh: c.descriptionZh || undefined,
      icon: c.icon || undefined,
      color: c.color || undefined,
      postCount: c._count.posts,
    }));
  }

  /**
   * Create a new forum category. Checks for name uniqueness.
   *
   * @param data - Category creation data
   * @returns The created category
   * @throws {BadRequestException} When a category with the same name already exists
   */
  async createCategory(data: CreateCategoryDto): Promise<CategoryDto> {
    const existing = await this.prisma.forumCategory.findFirst({
      where: {
        OR: [{ name: data.name }, { nameZh: data.nameZh }],
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Category already exists: ${existing.name} / ${existing.nameZh}`,
      );
    }

    const category = await this.prisma.forumCategory.create({
      data: {
        name: data.name,
        nameZh: data.nameZh,
        description: data.description,
        descriptionZh: data.descriptionZh,
        icon: data.icon,
        color: data.color,
        sortOrder: data.sortOrder || 0,
      },
    });

    return {
      id: category.id,
      name: category.name,
      nameZh: category.nameZh,
      description: category.description || undefined,
      descriptionZh: category.descriptionZh || undefined,
      icon: category.icon || undefined,
      color: category.color || undefined,
      postCount: 0,
    };
  }
}
