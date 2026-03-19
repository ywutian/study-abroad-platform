export interface SchoolInfo {
  id: string;
  name: string;
  nameZh?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
}

export interface RecommendationItem {
  schoolId: string;
  probability: number;
  reason: string;
  highlights: string[];
  school?: SchoolInfo;
}

export interface RecommendationResponse {
  reach: RecommendationItem[];
  target: RecommendationItem[];
  safety: RecommendationItem[];
  summary: string;
  status?: 'cached' | 'profile_incomplete' | 'ai_error';
}
