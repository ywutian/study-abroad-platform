import { Injectable, Logger, Optional } from '@nestjs/common';
import { ReviewMethod, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import {
  buildReviewCoachSystemPrompt,
  buildReviewCoachUserPrompt,
  type ReviewerInsight,
  type ReviewCoachContext,
} from './review-coach.prompts';

/**
 * Hall refactor Stage 5 — Review Coach AI feedback.
 *
 * After a reviewer submits a SWIPE review, this service generates reflective
 * feedback on their evaluation style (strict / lenient per dimension) versus
 * the peer cohort. Returns null gracefully when LLM is unavailable so the
 * core review flow is never blocked by an AI failure.
 */
@Injectable()
export class ReviewCoachService {
  private readonly logger = new Logger(ReviewCoachService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly llm?: LLMService,
  ) {}

  async generateInsight(
    reviewerId: string,
    locale: 'en' | 'zh' = 'zh',
  ): Promise<ReviewerInsight | null> {
    if (!this.llm) return null;

    // Pull reviewer's own history (last 30 reviews).
    const history = await this.prisma.review.findMany({
      where: {
        reviewerId,
        status: ReviewStatus.PUBLISHED,
        reviewMethod: ReviewMethod.SWIPE,
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        academicScore: true,
        testScore: true,
        activityScore: true,
        awardScore: true,
        swipeData: true,
        reviewerConfidence: true,
      },
    });

    if (history.length === 0) return null;

    const latest = history[0];

    // Peer cohort: all SWIPE reviews (across reviewers) for cohort baseline.
    const cohort = await this.prisma.review.findMany({
      where: {
        status: ReviewStatus.PUBLISHED,
        reviewMethod: ReviewMethod.SWIPE,
        reviewerId: { not: reviewerId },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        academicScore: true,
        testScore: true,
        activityScore: true,
        awardScore: true,
      },
    });

    const avg = (arr: number[]): number =>
      arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

    const swipeData = latest.swipeData as
      | { directionsPerStep?: Record<string, string> }
      | null;
    const directions = swipeData?.directionsPerStep;
    const ctx: ReviewCoachContext = {
      currentReview: {
        swipes: {
          academic: directions?.academic ?? 'right',
          test: directions?.test ?? 'right',
          activity: directions?.activity ?? 'right',
          award: directions?.award ?? 'right',
        },
        confidences: {
          overall: latest.reviewerConfidence ?? 50,
        },
        derivedScores: {
          academic: latest.academicScore,
          test: latest.testScore,
          activity: latest.activityScore,
          award: latest.awardScore,
        },
      },
      reviewerHistory: {
        totalReviews: history.length,
        avgByDimension: {
          academic: roundTo1(avg(history.map((r) => r.academicScore))),
          test: roundTo1(avg(history.map((r) => r.testScore))),
          activity: roundTo1(avg(history.map((r) => r.activityScore))),
          award: roundTo1(avg(history.map((r) => r.awardScore))),
        },
      },
      peerCohortStats: {
        sampleSize: cohort.length,
        avgByDimension: {
          academic: roundTo1(avg(cohort.map((r) => r.academicScore))),
          test: roundTo1(avg(cohort.map((r) => r.testScore))),
          activity: roundTo1(avg(cohort.map((r) => r.activityScore))),
          award: roundTo1(avg(cohort.map((r) => r.awardScore))),
        },
      },
    };

    try {
      const raw = await this.llm.chatSimple(
        [
          { role: 'system', content: buildReviewCoachSystemPrompt(locale) },
          { role: 'user', content: buildReviewCoachUserPrompt(ctx, locale) },
        ],
        { maxTokens: 400, temperature: 0.3 },
      );
      const insight = extractJsonFromLlm<ReviewerInsight>(raw);
      // Defensive validation — never let bad shape reach the client.
      if (
        !insight ||
        typeof insight.insight !== 'string' ||
        typeof insight.suggestion !== 'string' ||
        !insight.styleProfile ||
        !Array.isArray(insight.styleProfile.strict) ||
        !Array.isArray(insight.styleProfile.lenient)
      ) {
        this.logger.warn(
          'Review coach returned invalid shape — discarding',
        );
        return null;
      }
      return insight;
    } catch (error) {
      this.logger.warn('Review coach generation failed', error);
      return null;
    }
  }
}

function roundTo1(n: number): number {
  return Math.round(n * 10) / 10;
}
