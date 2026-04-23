import type { BenchmarkProfileInput } from '@study-abroad/shared';

export type StaticTeacherConfidence = 'low' | 'medium' | 'high';

export interface StaticTeacherBucket {
  key: string;
  bucketValue: number;
  probability: number;
  rawProbability: string;
  confidence: StaticTeacherConfidence;
}

export interface StaticTeacherLookupJson {
  sat: StaticTeacherBucket[];
  gpa: StaticTeacherBucket[];
  sourceUrl?: string;
  harvestedAt?: string;
}

export interface StaticTeacherSchoolRef {
  id: string;
  name: string;
  metadata?: Record<string, unknown> | null;
}

export interface StaticTeacherBucketMatch {
  key: string;
  bucketValue: number;
  probability: number;
  confidence: StaticTeacherConfidence;
  distance: number;
}

export interface StaticTeacherEvaluation {
  probability: number;
  confidence: StaticTeacherConfidence;
  satMatch?: StaticTeacherBucketMatch;
  gpaMatch?: StaticTeacherBucketMatch;
  rawPayload: unknown;
}

export interface StaticTeacherHarvestResult {
  slug: string;
  lookupJson: StaticTeacherLookupJson;
}

export interface StaticTeacher {
  key: string;
  label: string;
  baseUrl: string;
  defaultEnabled?: boolean;
  supportsNumericProbability?: boolean;
  resolveSlug(school: StaticTeacherSchoolRef): string | null;
  harvestSchool(
    school: StaticTeacherSchoolRef,
  ): Promise<StaticTeacherHarvestResult>;
  evaluateProfile(
    profile: BenchmarkProfileInput,
    school: StaticTeacherSchoolRef,
    lookupJson: StaticTeacherLookupJson,
  ): StaticTeacherEvaluation | null;
}
