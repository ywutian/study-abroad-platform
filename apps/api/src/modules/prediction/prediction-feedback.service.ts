import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PredictionFeedbackCategory,
  PredictionFeedbackSentiment,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ListPredictionFeedbackDto,
  SubmitPredictionFeedbackDto,
} from './dto/prediction-feedback.dto';

type ServedTraceSnapshot = {
  engine?: string | null;
  counselor?: unknown;
  shadow?: unknown;
};

export interface PredictionFeedbackView {
  id: string;
  predictionResultId: string;
  userId: string;
  userEmail?: string;
  sentiment: PredictionFeedbackSentiment;
  category?: PredictionFeedbackCategory | null;
  notes?: string | null;
  engineSnapshot?: string | null;
  probabilitySnapshot?: number | null;
  createdAt: string;
  updatedAt: string;
  school: {
    id: string;
    name: string;
    nameZh?: string | null;
  } | null;
  prediction: {
    probability: number;
    factors: unknown;
    servedTrace: unknown;
    updatedAt: string;
  };
}

export interface PredictionFeedbackListResult {
  items: PredictionFeedbackView[];
  total: number;
  nextCursor: string | null;
}

@Injectable()
export class PredictionFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submitFeedback(
    userId: string,
    predictionResultId: string,
    dto: SubmitPredictionFeedbackDto,
  ): Promise<PredictionFeedbackView> {
    const prediction = await this.prisma.predictionResult.findUnique({
      where: { id: predictionResultId },
      include: {
        profile: { select: { userId: true } },
      },
    });

    if (!prediction) {
      throw new NotFoundException('Prediction result not found');
    }
    if (prediction.profile.userId !== userId) {
      throw new ForbiddenException('Prediction result belongs to another user');
    }

    const trace = (prediction.servedTrace ??
      null) as ServedTraceSnapshot | null;
    const normalizedNotes = dto.notes?.trim() || null;

    const feedback = await this.prisma.predictionFeedback.upsert({
      where: {
        predictionResultId_userId: {
          predictionResultId,
          userId,
        },
      },
      create: {
        predictionResultId,
        userId,
        sentiment: dto.sentiment,
        category: dto.category,
        notes: normalizedNotes,
        engineSnapshot: trace?.engine ?? null,
        probabilitySnapshot: prediction.probability,
      },
      update: {
        sentiment: dto.sentiment,
        category: dto.category,
        notes: normalizedNotes,
        engineSnapshot: trace?.engine ?? null,
        probabilitySnapshot: prediction.probability,
      },
      include: this.feedbackInclude(),
    });

    return this.mapFeedback(
      feedback,
      await this.loadSchools([prediction.schoolId]),
    );
  }

  async listFeedback(
    filters: ListPredictionFeedbackDto,
  ): Promise<PredictionFeedbackListResult> {
    const take = Math.min(Math.max(filters.take ?? 20, 1), 100);
    const where: Prisma.PredictionFeedbackWhereInput = {};

    if (filters.sentiment) where.sentiment = filters.sentiment;
    if (filters.category) where.category = filters.category;
    if (filters.engineSnapshot) where.engineSnapshot = filters.engineSnapshot;
    if (filters.schoolId) {
      where.predictionResult = { schoolId: filters.schoolId };
    }
    if (filters.daysAgo) {
      where.createdAt = {
        gte: new Date(Date.now() - filters.daysAgo * 24 * 60 * 60 * 1000),
      };
    }

    const [itemsPlusOne, total] = await Promise.all([
      // governance: admin-scope — @Controller("admin/prediction-feedback") + @Roles(Role.ADMIN, Role.SUPER_ADMIN)
      this.prisma.predictionFeedback.findMany({
        where,
        include: this.feedbackInclude(),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        ...(filters.cursor
          ? {
              cursor: { id: filters.cursor },
              skip: 1,
            }
          : {}),
      }),
      // governance: admin-scope — @Controller("admin/prediction-feedback") + @Roles(Role.ADMIN, Role.SUPER_ADMIN)
      this.prisma.predictionFeedback.count({ where }),
    ]);

    const hasMore = itemsPlusOne.length > take;
    const items = hasMore ? itemsPlusOne.slice(0, take) : itemsPlusOne;
    const schoolIds = items.map((item) => item.predictionResult.schoolId);
    const schools = await this.loadSchools(schoolIds);

    return {
      items: items.map((item) => this.mapFeedback(item, schools)),
      total,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  private feedbackInclude() {
    return {
      user: { select: { id: true, email: true } },
      predictionResult: {
        select: {
          id: true,
          schoolId: true,
          probability: true,
          factors: true,
          servedTrace: true,
          updatedAt: true,
        },
      },
    } satisfies Prisma.PredictionFeedbackInclude;
  }

  private async loadSchools(schoolIds: string[]) {
    const uniqueIds = Array.from(new Set(schoolIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return new Map<
        string,
        { id: string; name: string; nameZh: string | null }
      >();
    }
    // governance: admin-scope — @Controller("admin/prediction-feedback") + @Roles(Role.ADMIN, Role.SUPER_ADMIN)
    const schools = await this.prisma.school.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true, nameZh: true },
    });
    return new Map(schools.map((school) => [school.id, school]));
  }

  private mapFeedback(
    feedback: Prisma.PredictionFeedbackGetPayload<{
      include: ReturnType<PredictionFeedbackService['feedbackInclude']>;
    }>,
    schools: Map<string, { id: string; name: string; nameZh: string | null }>,
  ): PredictionFeedbackView {
    const school = schools.get(feedback.predictionResult.schoolId) ?? null;
    return {
      id: feedback.id,
      predictionResultId: feedback.predictionResultId,
      userId: feedback.userId,
      userEmail: feedback.user.email,
      sentiment: feedback.sentiment,
      category: feedback.category,
      notes: feedback.notes,
      engineSnapshot: feedback.engineSnapshot,
      probabilitySnapshot: feedback.probabilitySnapshot
        ? Number(feedback.probabilitySnapshot)
        : null,
      createdAt: feedback.createdAt.toISOString(),
      updatedAt: feedback.updatedAt.toISOString(),
      school,
      prediction: {
        probability: Number(feedback.predictionResult.probability),
        factors: feedback.predictionResult.factors,
        servedTrace: feedback.predictionResult.servedTrace,
        updatedAt: feedback.predictionResult.updatedAt.toISOString(),
      },
    };
  }
}
