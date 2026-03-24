export interface SchoolDetail {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  city?: string;
  website?: string;
  usNewsRank?: number;
  qsRank?: number;
  acceptanceRate?: number;
  tuition?: number;
  avgSalary?: number;
  totalEnrollment?: number;
  satAvg?: number;
  sat25?: number;
  sat75?: number;
  satMath25?: number;
  satMath75?: number;
  satReading25?: number;
  satReading75?: number;
  actAvg?: number;
  act25?: number;
  act75?: number;
  studentCount?: number;
  graduationRate?: number;
  isPrivate?: boolean;
  logoUrl?: string;
  scorecardId?: string;
  ipedsId?: string;
  nicheSafetyGrade?: string;
  nicheLifeGrade?: string;
  nicheFoodGrade?: string;
  nicheOverallGrade?: string;

  // Retention & Academics
  retentionRate?: number;
  studentFacultyRatio?: number;

  // Financial Aid
  percentNeedMet?: number;
  averageAidPackage?: number;
  averageNetPrice?: number;
  roomAndBoard?: number;

  // Application Info
  applicationFee?: number;
  feeWaiverAvailable?: boolean;
  acceptsCommonApp?: boolean;
  acceptsCoalition?: boolean;
  testOptional?: boolean;
  hasEarlyDecision?: boolean;

  // International
  needBlindInternational?: boolean;
  intlStudentPct?: number;
  intlAcceptanceRate?: number;

  // Post-Graduation
  salary6YrPostGrad?: number;
  loanDefaultRate?: number;
  monthlyLoanPayment?: number;

  // Campus Life
  countriesRepresented?: number;
  studentOrgsCount?: number;

  description?: string;
  descriptionZh?: string;
  metadata?: {
    deadlines?: Record<string, string>;
    applicationType?: string;
    essayCount?: number;
    applicationCycle?: string;
    requirements?: {
      satRange?: string;
      actRange?: string;
      toeflMin?: number;
      ieltsMin?: number;
      applicationFee?: number;
    };
    essayPrompts?: Array<{ id: number; prompt: string; year: number }>;
    provenance?: import('@study-abroad/shared').ProvenanceRecord;
  };
  cases?: Array<{
    id: string;
    year: number;
    round?: string;
    result: string;
    gpaRange?: string;
    satRange?: string;
    tags?: string[];
  }>;
}

export interface EssayPrompt {
  id: string;
  type: string;
  prompt: string;
  promptZh?: string;
  wordLimit?: number;
  isRequired: boolean;
  aiTips?: string;
  aiCategory?: string;
}

export type { SchoolPredictionData as PredictionData } from '@/hooks/use-prediction';
