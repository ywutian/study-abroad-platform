import type { AIAnalysisResult } from './ai-agent';

export type ApplicationAnalysisRenderSection =
  | 'profileContext'
  | 'schoolListDiagnosis'
  | 'focusSchools'
  | 'actionPlan'
  | 'unknowns'
  | 'feedback';

export interface ApplicationAnalysisRenderFixture {
  caseId: string;
  locale: 'en' | 'zh';
  tags: string[];
  analysis: AIAnalysisResult;
  expectedSections: ApplicationAnalysisRenderSection[];
  expectedSchoolOrder: string[];
  forbiddenKeywords: string[];
  maskSelectors: string[];
}
