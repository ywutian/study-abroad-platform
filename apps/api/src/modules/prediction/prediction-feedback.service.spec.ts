import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  PredictionFeedbackCategory,
  PredictionFeedbackSentiment,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionFeedbackService } from './prediction-feedback.service';

describe('PredictionFeedbackService', () => {
  let service: PredictionFeedbackService;
  let prisma: {
    predictionResult: { findUnique: jest.Mock };
    predictionFeedback: {
      upsert: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    school: { findMany: jest.Mock };
  };

  const prediction = {
    id: 'prediction-1',
    profileId: 'profile-1',
    schoolId: 'school-1',
    probability: new Prisma.Decimal(0.84),
    factors: [{ name: 'School baseline' }],
    servedTrace: { engine: 'counselor' },
    updatedAt: new Date('2026-04-27T10:00:00.000Z'),
    profile: { userId: 'user-1' },
  };

  const feedbackRow = {
    id: 'feedback-1',
    predictionResultId: 'prediction-1',
    userId: 'user-1',
    user: { id: 'user-1', email: 'user@example.com' },
    sentiment: PredictionFeedbackSentiment.NEGATIVE,
    category: PredictionFeedbackCategory.TOO_HIGH,
    notes: 'Feels too high',
    engineSnapshot: 'counselor',
    probabilitySnapshot: new Prisma.Decimal(0.84),
    createdAt: new Date('2026-04-27T11:00:00.000Z'),
    updatedAt: new Date('2026-04-27T11:00:00.000Z'),
    predictionResult: {
      id: 'prediction-1',
      schoolId: 'school-1',
      probability: new Prisma.Decimal(0.84),
      factors: [{ name: 'School baseline' }],
      servedTrace: { engine: 'counselor' },
      updatedAt: new Date('2026-04-27T10:00:00.000Z'),
    },
  };

  beforeEach(() => {
    prisma = {
      predictionResult: {
        findUnique: jest.fn().mockResolvedValue(prediction),
      },
      predictionFeedback: {
        upsert: jest.fn().mockResolvedValue(feedbackRow),
        findMany: jest.fn().mockResolvedValue([feedbackRow]),
        count: jest.fn().mockResolvedValue(1),
      },
      school: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'school-1',
            name: 'Test University',
            nameZh: '测试大学',
          },
        ]),
      },
    };
    service = new PredictionFeedbackService(prisma as unknown as PrismaService);
  });

  it('submits feedback with engine and probability snapshots', async () => {
    const result = await service.submitFeedback('user-1', 'prediction-1', {
      sentiment: PredictionFeedbackSentiment.NEGATIVE,
      category: PredictionFeedbackCategory.TOO_HIGH,
      notes: ' Feels too high ',
    });

    expect(prisma.predictionFeedback.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          predictionResultId_userId: {
            predictionResultId: 'prediction-1',
            userId: 'user-1',
          },
        },
        create: expect.objectContaining({
          engineSnapshot: 'counselor',
          probabilitySnapshot: prediction.probability,
          notes: 'Feels too high',
        }),
      }),
    );
    expect(result.engineSnapshot).toBe('counselor');
    expect(result.probabilitySnapshot).toBe(0.84);
  });

  it('rejects feedback for a prediction owned by another user', async () => {
    await expect(
      service.submitFeedback('other-user', 'prediction-1', {
        sentiment: PredictionFeedbackSentiment.POSITIVE,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found when the prediction result does not exist', async () => {
    prisma.predictionResult.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.submitFeedback('user-1', 'missing', {
        sentiment: PredictionFeedbackSentiment.POSITIVE,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists admin feedback with filters, schools, and cursor pagination', async () => {
    prisma.predictionFeedback.findMany.mockResolvedValueOnce([
      feedbackRow,
      { ...feedbackRow, id: 'feedback-2' },
    ]);

    const result = await service.listFeedback({
      sentiment: PredictionFeedbackSentiment.NEGATIVE,
      engineSnapshot: 'counselor',
      schoolId: 'school-1',
      take: 1,
    });

    expect(prisma.predictionFeedback.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sentiment: PredictionFeedbackSentiment.NEGATIVE,
          engineSnapshot: 'counselor',
          predictionResult: { schoolId: 'school-1' },
        },
        take: 2,
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].school?.name).toBe('Test University');
    expect(result.nextCursor).toBe('feedback-1');
  });
});
