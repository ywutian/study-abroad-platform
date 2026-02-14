import { Controller, Get, Put, Delete, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators';
import { Role } from '@prisma/client';
import { ForumService } from './forum.service';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('admin/forums')
@ApiBearerAuth()
@Controller('admin/forums')
@Roles(Role.ADMIN)
export class ForumAdminController {
  constructor(
    private readonly forumService: ForumService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('posts')
  @ApiOperation({ summary: '管理员查看所有帖子' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'isLocked', required: false })
  @ApiQuery({ name: 'isPinned', required: false })
  @ApiQuery({ name: 'search', required: false })
  async getPosts(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('categoryId') categoryId?: string,
    @Query('isLocked') isLocked?: string,
    @Query('isPinned') isPinned?: string,
    @Query('search') search?: string,
  ) {
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 20;
    const where: any = {};

    if (categoryId) where.categoryId = categoryId;
    if (isLocked === 'true') where.isLocked = true;
    if (isLocked === 'false') where.isLocked = false;
    if (isPinned === 'true') where.isPinned = true;
    if (isPinned === 'false') where.isPinned = false;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [posts, total] = await Promise.all([
      this.prisma.forumPost.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, email: true, role: true } },
          category: { select: { id: true, name: true } },
          _count: { select: { comments: true, likes: true } },
        },
      }),
      this.prisma.forumPost.count({ where }),
    ]);

    return {
      data: posts,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  @Put('posts/:id/pin')
  @ApiOperation({ summary: '置顶/取消置顶帖子' })
  async togglePin(@Param('id') id: string) {
    const post = await this.prisma.forumPost.findUniqueOrThrow({
      where: { id },
    });
    const updated = await this.prisma.forumPost.update({
      where: { id },
      data: { isPinned: !post.isPinned },
      select: { id: true, isPinned: true },
    });
    return updated;
  }

  @Put('posts/:id/lock')
  @ApiOperation({ summary: '锁定/解锁帖子' })
  async toggleLock(@Param('id') id: string) {
    const post = await this.prisma.forumPost.findUniqueOrThrow({
      where: { id },
    });
    const updated = await this.prisma.forumPost.update({
      where: { id },
      data: { isLocked: !post.isLocked },
      select: { id: true, isLocked: true },
    });
    return updated;
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: '管理员删除帖子（绕过 owner 检查）' })
  async deletePost(@Param('id') id: string) {
    await this.prisma.forumPost.delete({ where: { id } });
    return { message: 'Post deleted' };
  }

  @Delete('comments/:id')
  @ApiOperation({ summary: '管理员删除评论' })
  async deleteComment(@Param('id') id: string) {
    await this.prisma.forumComment.delete({ where: { id } });
    return { message: 'Comment deleted' };
  }

  @Put('categories/:id')
  @ApiOperation({ summary: '更新论坛分类' })
  async updateCategory(
    @Param('id') id: string,
    @Query('name') name?: string,
    @Query('description') description?: string,
    @Query('isActive') isActive?: string,
  ) {
    const data: any = {};
    if (name) data.name = name;
    if (description) data.description = description;
    if (isActive !== undefined) data.isActive = isActive === 'true';

    return this.prisma.forumCategory.update({
      where: { id },
      data,
    });
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: '删除/归档论坛分类' })
  async deleteCategory(@Param('id') id: string) {
    // Soft-archive by setting isActive = false instead of hard delete
    return this.prisma.forumCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
