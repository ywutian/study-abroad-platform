import type { ProfileInput } from '../prediction.prompts';

/**
 * Ablation variant identifiers. Each strips a specific signal from a
 * ProfileInput to measure that signal's marginal contribution to the
 * served probability.
 *
 * Mutators are pure: they MUST return a new ProfileInput and leave
 * the input untouched. Shared arrays/objects must be shallow-cloned
 * before modification.
 */
export type AblationVariantKey =
  | 'baseline'
  | 'academic-only'
  | 'no-essay'
  | 'no-hs-profile'
  | 'no-awards'
  | 'no-activities'
  | 'no-major-cip';

export interface AblationVariantDef {
  key: AblationVariantKey;
  label: string;
  description: string;
  apply: (p: ProfileInput) => ProfileInput;
}

function cloneProfile(p: ProfileInput): ProfileInput {
  return {
    ...p,
    testScores: p.testScores.map((s) => ({ ...s })),
    activities: p.activities.map((a) => ({ ...a })),
    awards: p.awards.map((a) => ({ ...a })),
    assessment: p.assessment ? { ...p.assessment } : undefined,
    legacySchools: p.legacySchools ? [...p.legacySchools] : undefined,
    majorCompetitiveness: p.majorCompetitiveness
      ? { ...p.majorCompetitiveness }
      : undefined,
  };
}

const HS_FIELDS: (keyof ProfileInput)[] = [
  'highSchoolId',
  'highSchoolName',
  'highSchoolTier',
  'highSchoolType',
  'highSchoolLocation',
  'highSchoolRecognition',
  'highSchoolAcademicRigor',
  'highSchoolPlacementRecord',
  'highSchoolStudentQuality',
  'highSchoolResources',
  'highSchoolGradeInflation',
];

export const ABLATION_VARIANTS: Record<AblationVariantKey, AblationVariantDef> =
  {
    baseline: {
      key: 'baseline',
      label: 'Baseline',
      description: 'Unmodified profile — reference point for all deltas.',
      apply: (p) => cloneProfile(p),
    },
    'academic-only': {
      key: 'academic-only',
      label: 'Academic-only',
      description:
        'Keep GPA and test scores only. Drop activities, awards, HS profile, essay, major, assessment, legacy, first-gen.',
      apply: (p) => {
        const next = cloneProfile(p);
        next.activities = [];
        next.awards = [];
        next.essayQualityScore = undefined;
        next.targetMajor = undefined;
        next.majorCompetitiveness = undefined;
        next.assessment = undefined;
        next.isLegacy = false;
        next.legacySchools = undefined;
        next.isFirstGen = false;
        for (const f of HS_FIELDS) (next as any)[f] = undefined;
        return next;
      },
    },
    'no-essay': {
      key: 'no-essay',
      label: 'No essay signal',
      description: 'Strip essayQualityScore only.',
      apply: (p) => {
        const next = cloneProfile(p);
        next.essayQualityScore = undefined;
        return next;
      },
    },
    'no-hs-profile': {
      key: 'no-hs-profile',
      label: 'No HS profile',
      description:
        'Strip all highSchool* enrichment (tier, recognition, academic rigor, placement, student quality, resources, grade inflation, id, name, type, location).',
      apply: (p) => {
        const next = cloneProfile(p);
        for (const f of HS_FIELDS) (next as any)[f] = undefined;
        return next;
      },
    },
    'no-awards': {
      key: 'no-awards',
      label: 'No awards',
      description: 'Drop all awards.',
      apply: (p) => {
        const next = cloneProfile(p);
        next.awards = [];
        return next;
      },
    },
    'no-activities': {
      key: 'no-activities',
      label: 'No activities',
      description: 'Drop all activities.',
      apply: (p) => {
        const next = cloneProfile(p);
        next.activities = [];
        return next;
      },
    },
    'no-major-cip': {
      key: 'no-major-cip',
      label: 'No major / CIP',
      description:
        'Drop targetMajor and majorCompetitiveness — disables the SchoolProgram competitiveness modifier.',
      apply: (p) => {
        const next = cloneProfile(p);
        next.targetMajor = undefined;
        next.majorCompetitiveness = undefined;
        return next;
      },
    },
  };

export const ALL_VARIANT_KEYS: AblationVariantKey[] = [
  'baseline',
  'academic-only',
  'no-essay',
  'no-hs-profile',
  'no-awards',
  'no-activities',
  'no-major-cip',
];
