import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HighSchoolType } from '@prisma/client';

@Injectable()
export class HighSchoolService {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: {
    search?: string;
    country?: string;
    type?: HighSchoolType;
    tier?: number;
    pageSize?: number;
  }) {
    const { search, country, type, tier, pageSize = 20 } = params;
    const where: any = { isActive: true };

    if (country) where.country = country;
    if (type) where.type = type;
    if (tier) where.tier = tier;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { nameZh: { contains: search, mode: 'insensitive' } },
        { abbreviation: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.highSchool.findMany({
      where,
      orderBy: [{ tier: 'desc' }, { name: 'asc' }],
      take: Math.min(pageSize, 100),
    });
  }

  async findById(id: string) {
    return this.prisma.highSchool.findUnique({ where: { id } });
  }
}
