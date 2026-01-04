import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { School, Prisma } from '@prisma/client';
import { PaginationDto, createPaginatedResponse, PaginatedResponseDto } from '../../common/dto/pagination.dto';

@Injectable()
export class SchoolService {
  constructor(private prisma: PrismaService) {}

  async findAll(pagination: PaginationDto, filters?: { country?: string; search?: string }): Promise<PaginatedResponseDto<School>> {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SchoolWhereInput = {};

    if (filters?.country) {
      where.country = filters.country;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { nameZh: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [schools, total] = await Promise.all([
      this.prisma.school.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { usNewsRank: 'asc' },
      }),
      this.prisma.school.count({ where }),
    ]);

    return createPaginatedResponse(schools, total, page, pageSize);
  }

  async findById(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      include: {
        metrics: {
          orderBy: { year: 'desc' },
          take: 5,
        },
        cases: {
          where: {
            visibility: { in: ['ANONYMOUS', 'PUBLIC'] },
          },
          select: {
            id: true,
            year: true,
            round: true,
            result: true,
            gpaRange: true,
            satRange: true,
            tags: true,
            isVerified: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    return school;
  }

  async create(data: Prisma.SchoolCreateInput): Promise<School> {
    return this.prisma.school.create({ data });
  }

  async update(id: string, data: Prisma.SchoolUpdateInput): Promise<School> {
    return this.prisma.school.update({
      where: { id },
      data,
    });
  }

  // For calculating custom rankings
  async findAllWithMetrics(): Promise<School[]> {
    return this.prisma.school.findMany({
      where: {
        usNewsRank: { not: null },
      },
      orderBy: { usNewsRank: 'asc' },
    });
  }
}

