export interface CoverageStats {
  year: number;
  totalSchools: number;
  schoolsWithPrompts: number;
  schoolsWithVerified: number;
  coveragePercent: number;
  totalPrompts: number;
  pendingReview: number;
}

export interface FreshnessItem {
  id: string;
  sourceType: string;
  url: string;
  scrapeGroup: string;
  lastScrapedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  school: {
    id: string;
    name: string;
    nameZh: string | null;
    usNewsRank: number | null;
  };
}

export interface PipelineRun {
  id: string;
  trigger: string;
  year: number;
  status: string;
  totalSchools: number;
  successCount: number;
  failedCount: number;
  newPrompts: number;
  changedPrompts: number;
  startedAt: string;
  completedAt: string | null;
}

export interface TestScrapeEssay {
  prompt: string;
  promptZh?: string;
  wordLimit?: number;
  type?: string;
  isRequired?: boolean;
  confidence?: number;
  changeType?: string;
  aiTips?: string;
  aiCategory?: string;
}

export interface TestScrapeResult {
  school: string;
  schoolId?: string;
  source: string;
  scrapeGroup: string;
  year: number;
  essays: TestScrapeEssay[];
  rawContentPreview: string;
}
