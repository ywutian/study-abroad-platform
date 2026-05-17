import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  ReviewerLevel,
  ReviewMethod,
  ReviewStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Hall refactor Stage 2 — Review aggregation service.
 *
 * Computes the "I received reviews" summary shown to applicants. Combines
 * legacy CLASSIC scores and new SWIPE-mode signals into one payload, using
 * trimmed mean (drops outliers), median (robust to bimodal), and reviewer
 * level weighting (L3 = ×3, L2 = ×1, L1 vote-only is excluded from rating
 * aggregation).
 *
 * Threshold rule: only expose detailed aggregates when ≥7 reviews are in.
 * Below that, return `inProgress: true` so the UI can show a friendly
 * "we're collecting reviews (X / 7)" screen instead of trauma-inducing
 * tiny-sample scores.
 *
 * Caching is deferred to Stage 5 (Redis @TTL 5min) — current scale is
 * small enough that an O(n) in-memory aggregation per request is fine.
 */
@Injectable()
export class HallReviewAggregatorService {
  private readonly logger = new Logger(HallReviewAggregatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregate all PUBLISHED reviews for an applicant into a single payload.
   * Returns `null` when the applicant has opted out of receiving reviews.
   */
  async aggregateForApplicant(
    applicantUserId: string,
  ): Promise<AggregatedReviewPayload | null> {
    const profileOwner = await this.prisma.user.findUnique({
      where: { id: applicantUserId },
      select: { acceptPeerReview: true },
    });
    if (!profileOwner) return null;
    if (!profileOwner.acceptPeerReview) {
      // Honor privacy toggle — never aggregate for users who opted out.
      return {
        ...EMPTY_AGGREGATE,
        inProgress: false,
        acceptingReviews: false,
      };
    }

    const reviews = await this.prisma.review.findMany({
      where: {
        profileUserId: applicantUserId,
        status: ReviewStatus.PUBLISHED,
      },
      include: {
        reviewer: {
          select: { id: true, reviewerLevel: true, reviewerCredit: true },
        },
      },
    });

    if (reviews.length === 0) {
      return { ...EMPTY_AGGREGATE, reviewCount: 0, acceptingReviews: true };
    }

    if (reviews.length < MIN_REVIEWS_TO_REVEAL) {
      // Below threshold — return shape but keep dimensions empty + inProgress flag.
      return {
        ...EMPTY_AGGREGATE,
        reviewCount: reviews.length,
        inProgress: true,
        progressTarget: MIN_REVIEWS_TO_REVEAL,
        acceptingReviews: true,
      };
    }

    const dimensions = (
      ['academic', 'test', 'activity', 'award', 'overall'] as const
    ).map((dim) => this.aggregateDimension(reviews, dim));

    const distribution = this.computeDistribution(reviews);

    // Quick tag frequency (Stage 1 added quickTags[] for SWIPE reviews)
    const tagCount = new Map<string, number>();
    for (const r of reviews) {
      for (const t of [...r.tags, ...r.quickTags]) {
        tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
      }
    }
    const topTags = Array.from(tagCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));

    return {
      reviewCount: reviews.length,
      inProgress: false,
      progressTarget: MIN_REVIEWS_TO_REVEAL,
      acceptingReviews: true,
      dimensions: Object.fromEntries(
        dimensions.map((d) => [d.dimension, d]),
      ) as AggregatedReviewPayload['dimensions'],
      distribution,
      topTags,
      methodBreakdown: this.countByMethod(reviews),
    };
  }

  private aggregateDimension(
    reviews: ReviewWithReviewer[],
    dimension: 'academic' | 'test' | 'activity' | 'award' | 'overall',
  ): DimensionAggregate {
    const scoreKey = `${dimension}Score` as const;
    // L1 is vote-only; their writes never reach Review table, but be defensive.
    const sample = reviews.filter(
      (r) => r.reviewer.reviewerLevel !== ReviewerLevel.L1,
    );

    const weighted = sample
      .map((r) => {
        const weight = LEVEL_WEIGHT[r.reviewer.reviewerLevel] ?? 1.0;
        // Credit penalty: <50 reviewer credit caps weight at 0.5
        const creditFactor =
          r.reviewer.reviewerCredit < 50
            ? 0.5
            : Math.min(1, r.reviewer.reviewerCredit / 100);
        return {
          value: r[scoreKey],
          weight: weight * creditFactor,
        };
      })
      .filter((x) => Number.isFinite(x.value));

    if (weighted.length === 0) {
      return {
        dimension,
        mean: 0,
        weightedMean: 0,
        trimmedMean: 0,
        median: 0,
        sampleSize: 0,
      };
    }

    const values = weighted.map((w) => w.value).sort((a, b) => a - b);
    const totalWeight = weighted.reduce((acc, w) => acc + w.weight, 0);
    const weightedMean =
      weighted.reduce((acc, w) => acc + w.value * w.weight, 0) / totalWeight;

    // Trimmed mean: drop top + bottom 10%
    const trimCount = Math.floor(values.length * 0.1);
    const trimmed = values.slice(trimCount, values.length - trimCount || undefined);
    const trimmedMean =
      trimmed.length > 0
        ? trimmed.reduce((a, b) => a + b, 0) / trimmed.length
        : 0;

    const median =
      values.length % 2 === 0
        ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
        : values[Math.floor(values.length / 2)];

    const mean = values.reduce((a, b) => a + b, 0) / values.length;

    return {
      dimension,
      mean: roundTo1(mean),
      weightedMean: roundTo1(weightedMean),
      trimmedMean: roundTo1(trimmedMean),
      median: roundTo1(median),
      sampleSize: weighted.length,
    };
  }

  private computeDistribution(
    reviews: ReviewWithReviewer[],
  ): Record<string, number[]> {
    // 10-bucket histogram per dimension (score 1-10 mapped to bucket index 0-9)
    const dims = ['academic', 'test', 'activity', 'award', 'overall'] as const;
    const result: Record<string, number[]> = {};
    for (const dim of dims) {
      const buckets = new Array(10).fill(0) as number[];
      for (const r of reviews) {
        const score = r[`${dim}Score` as const];
        const idx = Math.max(0, Math.min(9, Math.floor(score) - 1));
        buckets[idx] += 1;
      }
      result[dim] = buckets;
    }
    return result;
  }

  private countByMethod(reviews: ReviewWithReviewer[]) {
    const counts = {
      [ReviewMethod.CLASSIC]: 0,
      [ReviewMethod.SWIPE]: 0,
    };
    for (const r of reviews) {
      counts[r.reviewMethod] = (counts[r.reviewMethod] ?? 0) + 1;
    }
    return counts;
  }
}

// ============== Types ==============

type ReviewWithReviewer = Prisma.ReviewGetPayload<{
  include: {
    reviewer: {
      select: { id: true; reviewerLevel: true; reviewerCredit: true };
    };
  };
}>;

export interface DimensionAggregate {
  dimension: 'academic' | 'test' | 'activity' | 'award' | 'overall';
  mean: number;
  weightedMean: number;
  trimmedMean: number;
  median: number;
  sampleSize: number;
}

export interface AggregatedReviewPayload {
  reviewCount: number;
  /** True when below MIN_REVIEWS_TO_REVEAL — UI should show progress, not data. */
  inProgress: boolean;
  progressTarget: number;
  /** False when applicant opted out via User.acceptPeerReview. */
  acceptingReviews: boolean;
  dimensions: {
    academic: DimensionAggregate;
    test: DimensionAggregate;
    activity: DimensionAggregate;
    award: DimensionAggregate;
    overall: DimensionAggregate;
  };
  distribution: Record<string, number[]>;
  topTags: Array<{ tag: string; count: number }>;
  methodBreakdown: Record<ReviewMethod, number>;
}

// ============== Constants ==============

const MIN_REVIEWS_TO_REVEAL = 7;

const LEVEL_WEIGHT: Record<ReviewerLevel, number> = {
  [ReviewerLevel.L1]: 0, // vote-only, not in aggregation
  [ReviewerLevel.L2]: 1.0,
  [ReviewerLevel.L3]: 3.0,
};

const EMPTY_DIMENSION: DimensionAggregate = {
  dimension: 'overall',
  mean: 0,
  weightedMean: 0,
  trimmedMean: 0,
  median: 0,
  sampleSize: 0,
};

const EMPTY_AGGREGATE: AggregatedReviewPayload = {
  reviewCount: 0,
  inProgress: false,
  progressTarget: MIN_REVIEWS_TO_REVEAL,
  acceptingReviews: true,
  dimensions: {
    academic: { ...EMPTY_DIMENSION, dimension: 'academic' },
    test: { ...EMPTY_DIMENSION, dimension: 'test' },
    activity: { ...EMPTY_DIMENSION, dimension: 'activity' },
    award: { ...EMPTY_DIMENSION, dimension: 'award' },
    overall: { ...EMPTY_DIMENSION, dimension: 'overall' },
  },
  distribution: {},
  topTags: [],
  methodBreakdown: {
    [ReviewMethod.CLASSIC]: 0,
    [ReviewMethod.SWIPE]: 0,
  },
};

function roundTo1(n: number): number {
  return Math.round(n * 10) / 10;
}
