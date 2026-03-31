// School & Ranking

export interface School {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  usNewsRank?: number;
  /** 0–100 percentage (e.g. 4.0 means 4%) */
  acceptanceRate?: number;
  tuition?: number;
  avgSalary?: number;
}

export interface RankingWeights {
  usNewsRank: number;
  /** Weight for acceptanceRate (0–100 scale) */
  acceptanceRate: number;
  tuition: number;
  avgSalary: number;
}

export interface CustomRanking {
  id: string;
  userId: string;
  name: string;
  weights: RankingWeights;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchoolDeadline {
  id: string;
  schoolId: string;
  year: number;
  round: string;
  applicationDeadline: string;
  financialAidDeadline?: string;
  decisionDate?: string;
  notes?: string;
  applicationFee?: number;
}

export interface SchoolMetric {
  id: string;
  schoolId: string;
  year: number;
  metricKey: string;
  value: number;
}

export interface EssayPrompt {
  id: string;
  schoolId?: string;
  type?: string;
  status?: string;
  year?: number;
  prompt: string;
  promptZh?: string;
  wordLimit?: number;
  isRequired?: boolean;
  sortOrder?: number;
}
