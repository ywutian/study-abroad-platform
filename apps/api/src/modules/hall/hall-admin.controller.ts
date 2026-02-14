import { Controller, Get, Put, Delete, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators';
import { Role, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('admin/reviews')
@ApiBearerAuth()
@Controller('admin/reviews')
@Roles(Role.ADMIN)
export class HallAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '管理员查看所有评论' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ReviewStatus })
  async getReviews(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
  ) {
    const p = Number(page) || 1;
    const ps = Number(pageSize) || 20;
    const where: any = {};

    const normalizedStatus = status?.toUpperCase();
    if (normalizedStatus === 'VISIBLE') {
      where.status = ReviewStatus.PUBLISHED;
    } else if (normalizedStatus === 'HIDDEN') {
      where.status = ReviewStatus.HIDDEN;
    } else if (
      normalizedStatus &&
      (ReviewStatus as Record<string, ReviewStatus>)[normalizedStatus]
    ) {
      where.status = (ReviewStatus as Record<string, ReviewStatus>)[
        normalizedStatus
      ];
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip: (p - 1) * ps,
        take: ps,
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: { select: { id: true, email: true, role: true } },
          profileUser: { select: { id: true, email: true } },
          _count: { select: { reactions: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: reviews,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  @Put(':id/hide')
  @ApiOperation({ summary: '隐藏评论' })
  async hideReview(@Param('id') id: string) {
    return this.prisma.review.update({
      where: { id },
      data: { status: ReviewStatus.HIDDEN },
      select: { id: true, status: true },
    });
  }

  @Put(':id/unhide')
  @ApiOperation({ summary: '恢复评论' })
  async unhideReview(@Param('id') id: string) {
    return this.prisma.review.update({
      where: { id },
      data: { status: ReviewStatus.PUBLISHED },
      select: { id: true, status: true },
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: '管理员删除评论' })
  async deleteReview(@Param('id') id: string) {
    await this.prisma.review.delete({ where: { id } });
    return { message: 'Review deleted' };
  }
}
