export interface SchoolInfo {
  id: string;
  name: string;
  nameZh?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
  website?: string;
  rankings?: { source: string; list: string; rank: number; year: number }[];
  sourceUrls?: {
    collegeScorecardUrl?: string;
    ipedsUrl?: string;
    websiteUrl?: string;
  };
}

export interface RecommendationItem {
  schoolId: string;
  probability: number;
  reason: string;
  highlights: string[];
  dataPoints?: string[];
  recommendedMajors?: (string | { name: string; reason: string })[];
  school?: SchoolInfo;
}

export interface SummerProgram {
  name: string;
  reason: string;
}

export interface RecommendationResponse {
  reach: RecommendationItem[];
  target: RecommendationItem[];
  safety: RecommendationItem[];
  summerPrograms?: SummerProgram[];
  summary: string;
  status?: 'cached' | 'profile_incomplete' | 'ai_error';
}
