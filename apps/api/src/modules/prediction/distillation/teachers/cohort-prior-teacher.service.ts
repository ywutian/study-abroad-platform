import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { TeacherSignalProvider } from '../types';
import type {
  DistillationEvaluationInput,
  DistillationTeacherSignal,
} from '../types';

/**
 * CohortPriorTeacher — reads SchoolCohortRoundPrior.
 *
 * Signal source: admit-rate aggregates computed by
 * `scripts/backfill-cohort-priors.ts` (or the twin admin endpoint) from
 * approved AdmissionCase rows. Each prior answers the question
 * "historically, for students in cohort X applying round Y to school Z,
 * what fraction got in?" plus a Wilson score 95% CI and sample count.
 *
 * Why this matters
 * ----------------
 * Before this teacher, the distillation stack had four signals — two public
 * (Scorecard / IPEDS) and two China-only (cn-case / cn-outcome). For any
 * non-China applicant with a verified-cases cohort, the school-level admit
 * rate was the only signal beyond Scorecard's four-bucket SAT multiplier.
 * CohortPriorTeacher closes that gap: any cohort with ≥5 verified cases in
 * its (school, cohort, round) cell now gets a data-backed prior.
 *
 * Fallback cascade
 * ----------------
 * The per-(school, cohort, round) cell is the narrowest and most accurate
 * signal. If missing (new school, rare round), we widen:
 *   1. exact (schoolId, cohortKey, round)
 *   2. any round for that (schoolId, cohortKey)
 *   3. any cohort for that (schoolId, round) — round-level at school
 *   4. any cell for that schoolId
 * Each fallback carries a confidence downgrade (narrowest = highest).
 *
 * Why find-first vs a single query with `orderBy narrowness`: Prisma has
 * no way to express "prefer exact match, fall back to wider" in one query
 * without a CASE expression we'd have to hand-write as `$queryRaw`.
 * Four findFirsts is ~3ms each on the existing composite index
 * `(schoolId, cohortKey, round, policyVersionId, setVersion)`, so the
 * total latency tax is bounded and predictable.
 *
 * Authority semantics (relative to PR #45)
 * ----------------------------------------
 * The priors used here are policy-version-agnostic (policyVersionId=NULL),
 * treating them as historical fact rather than a policy-tied signal.
 */
@Injectable()
export class CohortPriorTeacherService implements TeacherSignalProvider {
  readonly key = 'cohort-prior-v1' as const;
  readonly label = 'Cohort × Round Historical Prior';
  readonly sourceType = 'INTERNAL_CASES' as const;
  readonly defaultWeight = 0.12;

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    input: DistillationEvaluationInput,
  ): Promise<
    Omit<DistillationTeacherSignal, 'configuredWeight' | 'effectiveBlendWeight'>
  > {
    const round = input.applicationRound?.toUpperCase() || null;

    // Tier 1 (narrowest): exact (schoolId, cohortKey, round)
    if (round) {
      // governance: system-scope — SchoolCohortRoundPrior — derived school-level priors, no User relation
      const exact = await this.prisma.schoolCohortRoundPrior.findFirst({
        where: {
          schoolId: input.schoolId,
          cohortKey: input.cohortKey,
          round,
          policyVersionId: null,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (exact && this.meetsMinSamples(exact.sampleCount)) {
        return this.toSignal(exact, 'exact', input.cohortKey, round);
      }
    }

    // Tier 2: any round for (schoolId, cohortKey)
    // governance: system-scope — SchoolCohortRoundPrior — derived school-level priors, no User relation
    const cohortAny = await this.prisma.schoolCohortRoundPrior.findFirst({
      where: {
        schoolId: input.schoolId,
        cohortKey: input.cohortKey,
        policyVersionId: null,
      },
      // Prefer the highest-sample-count bucket when multiple rounds exist.
      // sampleCount can be null on legacy rows, so coalesce via orderBy.
      orderBy: [{ sampleCount: 'desc' }, { createdAt: 'desc' }],
    });
    if (cohortAny && this.meetsMinSamples(cohortAny.sampleCount)) {
      return this.toSignal(
        cohortAny,
        'cohort-any-round',
        input.cohortKey,
        null,
      );
    }

    // Tier 3: any cohort for (schoolId, round) — captures "this round is
    // binding at this school" without cohort specificity
    if (round) {
      // governance: system-scope — SchoolCohortRoundPrior — derived school-level priors, no User relation
      const schoolRound = await this.prisma.schoolCohortRoundPrior.findFirst({
        where: {
          schoolId: input.schoolId,
          round,
          policyVersionId: null,
        },
        orderBy: [{ sampleCount: 'desc' }, { createdAt: 'desc' }],
      });
      if (schoolRound && this.meetsMinSamples(schoolRound.sampleCount)) {
        return this.toSignal(
          schoolRound,
          'school-any-cohort-with-round',
          null,
          round,
        );
      }
    }

    // Tier 4 (widest): any cell for this school
    // governance: system-scope — SchoolCohortRoundPrior — derived school-level priors, no User relation
    const schoolAny = await this.prisma.schoolCohortRoundPrior.findFirst({
      where: {
        schoolId: input.schoolId,
        policyVersionId: null,
      },
      orderBy: [{ sampleCount: 'desc' }, { createdAt: 'desc' }],
    });
    if (schoolAny && this.meetsMinSamples(schoolAny.sampleCount)) {
      return this.toSignal(schoolAny, 'school-any', null, null);
    }

    return {
      key: this.key,
      label: this.label,
      sourceName: 'distillation:cohort-prior-v1',
      sourceType: this.sourceType,
      probability: null,
      active: false,
      confidence: 'low',
      missingReasons: ['no_prior_for_school'],
    };
  }

  /**
   * MIN_SAMPLES=5 matches the backfill script's filter. Defense-in-depth:
   * if a legacy or hand-inserted prior row sneaks in below the threshold,
   * this teacher still refuses it rather than serving a noisy signal.
   */
  private meetsMinSamples(sampleCount: number | null): boolean {
    return (sampleCount ?? 0) >= 5;
  }

  /**
   * Confidence drops one rung per fallback tier. At tier 3-4 we're
   * effectively saying "we know *something* about this school" but not
   * specifically about this cohort — keep the confidence low so the blend
   * layer down-weights it accordingly.
   */
  private toSignal(
    prior: {
      priorRate: { toNumber(): number };
      lowerBound: { toNumber(): number } | null;
      upperBound: { toNumber(): number } | null;
      sampleCount: number | null;
      confidence: string | null;
      setVersion: string | null;
    },
    tier:
      | 'exact'
      | 'cohort-any-round'
      | 'school-any-cohort-with-round'
      | 'school-any',
    matchedCohort: string | null,
    matchedRound: string | null,
  ): Omit<
    DistillationTeacherSignal,
    'configuredWeight' | 'effectiveBlendWeight'
  > {
    const baseConfidence = (prior.confidence ?? 'low') as
      'low' | 'medium' | 'high';

    // Tier-based downgrade: exact stays, others step down one rung.
    const tierDowngrade: Record<typeof tier, 'low' | 'medium' | 'high'> = {
      exact: baseConfidence,
      'cohort-any-round':
        baseConfidence === 'high'
          ? 'medium'
          : baseConfidence === 'medium'
            ? 'low'
            : 'low',
      'school-any-cohort-with-round': 'low',
      'school-any': 'low',
    };

    return {
      key: this.key,
      label: this.label,
      sourceName: 'distillation:cohort-prior-v1',
      sourceType: this.sourceType,
      probability: prior.priorRate.toNumber(),
      active: true,
      confidence: tierDowngrade[tier],
      sampleCount: prior.sampleCount ?? undefined,
      bucketKey: tier,
      missingReasons: [],
      metadata: {
        tier,
        matchedCohort,
        matchedRound,
        lowerBound: prior.lowerBound?.toNumber(),
        upperBound: prior.upperBound?.toNumber(),
        setVersion: prior.setVersion,
      },
    };
  }
}
