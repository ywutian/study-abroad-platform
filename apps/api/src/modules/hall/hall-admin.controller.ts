import { Controller, Get, Put, Delete, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles, RequirePermission } from '../../common/decorators';
import { Permission } from '../../common/constants/permissions';
import { Role, ReviewStatus } from '@prisma/client';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('admin/reviews')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('admin/reviews')
@Roles(Role.ADMIN)
@RequirePermission(Permission.CONTENT_MODERATE)
export class HallAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Admin view all reviews' })
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
  @ApiOperation({ summary: 'Hide review' })
  async hideReview(@Param('id') id: string) {
    return this.prisma.review.update({
      where: { id },
      data: { status: ReviewStatus.HIDDEN },
      select: { id: true, status: true },
    });
  }

  @Put(':id/unhide')
  @ApiOperation({ summary: 'Unhide review' })
  async unhideReview(@Param('id') id: string) {
    return this.prisma.review.update({
      where: { id },
      data: { status: ReviewStatus.PUBLISHED },
      select: { id: true, status: true },
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Admin delete review' })
  async deleteReview(@Param('id') id: string) {
    await this.prisma.review.delete({ where: { id } });
    return { message: 'Review deleted' };
  }
}
