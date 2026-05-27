/**
 * Prediction eligibility — single source of truth.
 *
 * Answers one question: "may this profile run an admission prediction?"
 *
 * Consumed identically by:
 * - `profile-readiness.service.ts` (`/profiles/me/readiness` → web UI gate)
 * - `prediction.service.ts` (the `POST /predictions` 412 backstop)
 * - `profile-analysis.service.ts` (`/profiles/me/completeness` → mobile gate)
 *
 * 2026-05: Replaces two drifted gates — readiness used
 * `completenessScore >= 45 && schoolCount > 0` while the predict endpoint
 * used `completeness >= 40`. A pure score threshold also fails to guarantee
 * GPA is present (a profile with tests + activities + awards + schools but
 * no GPA scored 75%). This predicate is field-explicit instead.
 * See docs/architecture/dashboard-invariants.md.
 */
import type {
  PredictionBlocker,
  PredictionEligibility,
} from '@study-abroad/shared';

export interface PredictionEligibilityInput {
  /** Whether the profile has a GPA value (the single most predictive input). */
  hasGpa: boolean;
  /** Whether the profile has basic info — a target major OR a grade. */
  hasBasicInfo: boolean;
  /** Number of schools in the user's `SchoolListItem` list. */
  schoolListCount: number;
}

/** Profile GPA fields — any one present counts as "has a GPA". */
export interface GpaSignalInput {
  gpa?: unknown;
  gpa9?: unknown;
  gpa10?: unknown;
  gpa11?: unknown;
  gpa12?: unknown;
  semesterGpas?: Array<unknown> | null;
}

/**
 * Whether the profile carries any GPA signal — cumulative, grade-level
 * (`gpa9`–`gpa12`), or per-semester. Mirrors `resolveGpaAnchor` in
 * `profile-readiness.service.ts` so the eligibility gate and the readiness
 * GPA anchor never disagree. Only truthiness of each field is checked.
 */
export function hasGpaSignal(
  profile: GpaSignalInput | null | undefined,
): boolean {
  if (!profile) return false;
  return !!(
    profile.gpa ||
    profile.gpa9 ||
    profile.gpa10 ||
    profile.gpa11 ||
    profile.gpa12 ||
    (profile.semesterGpas?.length ?? 0) > 0
  );
}

/**
 * Evaluate whether a profile may run an admission prediction.
 *
 * A prediction may run iff GPA + basic info are present AND the user has at
 * least one target school. Soft material (activities/awards/test scores)
 * genuinely can be filled in later and is intentionally NOT gated here.
 */
export function evaluatePredictionEligibility(
  input: PredictionEligibilityInput,
): PredictionEligibility {
  const blockers: PredictionBlocker[] = [];

  if (!input.hasGpa) {
    blockers.push('MISSING_GPA');
  }
  if (!input.hasBasicInfo) {
    blockers.push('MISSING_BASIC_INFO');
  }
  if (input.schoolListCount <= 0) {
    blockers.push('NO_TARGET_SCHOOLS');
  }

  return { canRunPrediction: blockers.length === 0, blockers };
}

const BLOCKER_ACTION_LABELS: Record<
  'en' | 'zh',
  Record<PredictionBlocker, string>
> = {
  zh: {
    MISSING_GPA: '填写 GPA',
    MISSING_BASIC_INFO: '完善基本信息（目标专业或年级）',
    NO_TARGET_SCHOOLS: '至少添加 1 所目标院校',
  },
  en: {
    MISSING_GPA: 'add your GPA',
    MISSING_BASIC_INFO: 'complete basic info (target major or grade)',
    NO_TARGET_SCHOOLS: 'add at least 1 target school',
  },
};

/**
 * Build a localized, human-readable message for a 412 prediction-blocked
 * response. Falls back to English for any non-`zh` locale.
 */
export function buildPredictionEligibilityMessage(
  blockers: PredictionBlocker[],
  locale?: string | null,
): string {
  const lang: 'en' | 'zh' = locale?.startsWith('zh') ? 'zh' : 'en';
  const actions = blockers.map((b) => BLOCKER_ACTION_LABELS[lang][b]);

  if (actions.length === 0) {
    return lang === 'zh'
      ? '档案信息已满足运行录取预测的要求。'
      : 'Profile is eligible to run an admission prediction.';
  }

  return lang === 'zh'
    ? `运行录取预测前，请先${actions.join('、')}。`
    : `Before running an admission prediction, please ${actions.join(', ')}.`;
}
