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
  totalEnrollment?: number;
  isPrivate?: boolean;
  nicheSafetyGrade?: string;
  nicheLifeGrade?: string;
  nicheFoodGrade?: string;
  nicheOverallGrade?: string;
  testOptional?: boolean;
  hasEarlyDecision?: boolean;
  acceptsCommonApp?: boolean;
  rankings?: SchoolRanking[];
  fieldSources?: SchoolFieldSources;
  communityRatingSummary?: SchoolCommunityRatingSummary;
}
