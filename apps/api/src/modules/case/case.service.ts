import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdmissionCase, Prisma, Visibility, Role } from '@prisma/client';
import { PaginationDto, createPaginatedResponse, PaginatedResponseDto } from '../../common/dto/pagination.dto';

interface CaseFilters {
  schoolId?: string;
  year?: number;
  result?: string;
  search?: string;
  visibility?: Visibility;
}

@Injectable()
export class CaseService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    pagination: PaginationDto,
    filters: CaseFilters,
    requesterId?: string | null,
    requesterRole?: Role | null
  ): Promise<PaginatedResponseDto<AdmissionCase>> {
    const { page = 1, pageSize = 20 } = pagination;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AdmissionCaseWhereInput = {};

    if (filters.schoolId) {
      where.schoolId = filters.schoolId;
    }

    if (filters.year) {
      where.year = filters.year;
    }

    if (filters.result) {
      where.result = filters.result as any;
    }

    if (filters.search) {
      where.OR = [
        { major: { contains: filters.search, mode: 'insensitive' } },
        { school: { name: { contains: filters.search, mode: 'insensitive' } } },
        { school: { nameZh: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    // Visibility filter based on requester role
    if (requesterRole === Role.ADMIN) {
      // Admin sees all
    } else if (requesterRole === Role.VERIFIED && requesterId) {
      where.AND = [
        where.OR ? { OR: where.OR } : {},
        {
          OR: [
            { visibility: Visibility.ANONYMOUS },
            { visibility: Visibility.VERIFIED_ONLY },
            { userId: requesterId },
          ],
        },
      ];
      delete where.OR;
    } else if (requesterId) {
      where.AND = [
        where.OR ? { OR: where.OR } : {},
        {
          OR: [{ visibility: Visibility.ANONYMOUS }, { userId: requesterId }],
        },
      ];
      delete where.OR;
    } else {
      // Unauthenticated user - only show anonymous cases
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { visibility: Visibility.ANONYMOUS }];
        delete where.OR;
      } else {
        where.visibility = Visibility.ANONYMOUS;
      }
    }

    const [cases, total] = await Promise.all([
      this.prisma.admissionCase.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          school: { select: { id: true, name: true, nameZh: true } },
        },
      }),
      this.prisma.admissionCase.count({ where }),
    ]);

    return createPaginatedResponse(cases, total, page, pageSize);
  }

  async findById(id: string, requesterId: string, requesterRole: Role): Promise<AdmissionCase> {
    const caseItem = await this.prisma.admissionCase.findUnique({
      where: { id },
      include: {
        school: { select: { id: true, name: true, nameZh: true } },
      },
    });

    if (!caseItem) {
      throw new NotFoundException('Case not found');
    }

    // Check visibility
    if (caseItem.userId === requesterId || requesterRole === Role.ADMIN) {
      return caseItem;
    }

    if (caseItem.visibility === Visibility.PRIVATE) {
      throw new ForbiddenException('This case is private');
    }

    if (caseItem.visibility === Visibility.VERIFIED_ONLY && requesterRole !== Role.VERIFIED) {
      throw new ForbiddenException('Only verified users can view this case');
    }

    return caseItem;
  }

  async create(userId: string, data: {
    schoolId: string;
    year: number;
    round?: string;
    result: string;
    major?: string;
    gpaRange?: string;
    satRange?: string;
    actRange?: string;
    toeflRange?: string;
    tags?: string[];
    visibility?: 'PRIVATE' | 'ANONYMOUS' | 'VERIFIED_ONLY';
  }): Promise<AdmissionCase> {
    const { schoolId, ...rest } = data;
    return this.prisma.admissionCase.create({
      data: {
        ...rest,
        result: rest.result as any,
        user: { connect: { id: userId } },
        school: { connect: { id: schoolId } },
      },
    });
  }

  async update(id: string, userId: string, data: Partial<{
    schoolId: string;
    year: number;
    round: string;
    result: string;
    major: string;
    gpaRange: string;
    satRange: string;
    actRange: string;
    toeflRange: string;
    tags: string[];
    visibility: 'PRIVATE' | 'ANONYMOUS' | 'VERIFIED_ONLY';
  }>): Promise<AdmissionCase> {
    const caseItem = await this.prisma.admissionCase.findUnique({
      where: { id },
    });

    if (!caseItem || caseItem.userId !== userId) {
      throw new NotFoundException('Case not found');
    }

    const { schoolId, result, visibility, ...rest } = data;
    return this.prisma.admissionCase.update({
      where: { id },
      data: {
        ...rest,
        ...(result && { result: result as any }),
        ...(visibility && { visibility: visibility as any }),
        ...(schoolId && { school: { connect: { id: schoolId } } }),
      },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const caseItem = await this.prisma.admissionCase.findUnique({
      where: { id },
    });

    if (!caseItem || caseItem.userId !== userId) {
      throw new NotFoundException('Case not found');
    }

    await this.prisma.admissionCase.delete({
      where: { id },
    });
  }

  async getMyCases(userId: string): Promise<AdmissionCase[]> {
    return this.prisma.admissionCase.findMany({
      where: { userId },
      include: {
        school: { select: { id: true, name: true, nameZh: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

