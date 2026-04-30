import type { SchoolCommunityRatingSummary, SchoolFieldSources } from '@study-abroad/shared';
import { type SchoolRanking } from '@/lib/utils/ranking';

export interface School {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  city?: string;
  usNewsRank?: number;
  qsRank?: number;
  acceptanceRate?: number;
  tuition?: number;
  studentCount?: number;
  website?: string;
  logoUrl?: string;
  avgSalary?: number;
  salary6YrPostGrad?: number;
  totalEnrollment?: number;
  percentNeedMet?: number;
  averageNetPrice?: number;
  averageAidPackage?: number;
  isPrivate?: boolean;
  nicheSafetyGrade?: string;
  nicheLifeGrade?: string;
  nicheFoodGrade?: string;
  nicheOverallGrade?: string;
  testingPolicy?: 'REQUIRED' | 'OPTIONAL' | 'BLIND' | 'UNKNOWN';
  testOptional?: boolean;
  hasEarlyDecision?: boolean;
  acceptsCommonApp?: boolean;
  rankings?: SchoolRanking[];
  fieldSources?: SchoolFieldSources;
  communityRatingSummary?: SchoolCommunityRatingSummary;
  fitScore?: number;
}
