import type {
  SchoolCommunityRatingSummary,
  SchoolFieldSources,
  SchoolPublicMedia,
} from '@study-abroad/shared';
import { type SchoolRanking } from '@/lib/utils/ranking';
import type { SchoolTestingPolicy } from '@study-abroad/shared';

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
  roomAndBoard?: number;
  studentOrgsCount?: number;
  countriesRepresented?: number;
  isPrivate?: boolean;
  nicheSafetyGrade?: string;
  nicheLifeGrade?: string;
  nicheFoodGrade?: string;
  nicheOverallGrade?: string;
  testingPolicy?: SchoolTestingPolicy;
  testOptional?: boolean;
  hasEarlyDecision?: boolean;
  acceptsCommonApp?: boolean;
  rankings?: SchoolRanking[];
  media?: SchoolPublicMedia;
  fieldSources?: SchoolFieldSources;
  communityRatingSummary?: SchoolCommunityRatingSummary;
  fitScore?: number;
}
