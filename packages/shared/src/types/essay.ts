// Essay

export enum EssayType {
  COMMON_APP = 'COMMON_APP',
  UC = 'UC',
  MAIN = 'MAIN',
  SUPPLEMENTAL = 'SUPPLEMENTAL',
  WHY_SCHOOL = 'WHY_SCHOOL',
  SHORT_ANSWER = 'SHORT_ANSWER',
  ACTIVITY = 'ACTIVITY',
  OPTIONAL = 'OPTIONAL',
  OTHER = 'OTHER',
}

export interface Essay {
  id: string;
  profileId: string;
  title: string;
  content: string;
  wordCount?: number;
  schoolId?: string;
  essayPromptId?: string;
  promptType?: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'FINAL';
  createdAt: string;
  updatedAt: string;
}

export type EssayDimension = 'hook' | 'structure' | 'voice' | 'insight' | 'fit' | 'detail';

export interface GalleryLearningHighlight {
  text: string;
  dimension: EssayDimension;
}

export interface GalleryParagraphLearningNote {
  paragraphIndex: number;
  paragraphText: string;
  score: number;
  status: 'excellent' | 'good' | 'needs_work';
  comment: string;
  highlights: GalleryLearningHighlight[];
  suggestions: string[];
}

export interface GalleryLearningNotesPayload {
  paragraphs: GalleryParagraphLearningNote[];
  overallScore: number;
  structure: {
    hasStrongOpening: boolean;
    hasClarity: boolean;
    hasGoodConclusion: boolean;
    feedback: string;
  };
  summary: string;
}

export interface GalleryLearningNotesResponse {
  essayId: string;
  status: 'ready' | 'unavailable';
  promptVersion: string;
  generatedAt?: string;
  cached: boolean;
  requestedLocale: string;
  sourceLocale?: string;
  fallbackUsed: boolean;
  payload?: GalleryLearningNotesPayload;
}

export interface GalleryEssayEvidence {
  source: 'essay' | 'learning_notes' | 'case_context' | 'user_essay';
  quote: string;
  paragraphIndex?: number;
  note?: string;
  verified?: boolean;
}

export interface GalleryEssayQuestionRequest {
  question: string;
  paragraphIndex?: number;
  selectedText?: string;
  clientRequestId?: string;
}

export interface GalleryEssayQuestionResponse {
  essayId: string;
  interactionId: string;
  answer: string;
  evidence: GalleryEssayEvidence[];
  followUps: string[];
  tokensUsed: number;
}

export type GalleryEssayCompareFocus =
  | 'theme'
  | 'structure'
  | 'voice'
  | 'schoolFit'
  | 'revisionPlan';

export interface GalleryEssayCompareRequest {
  userEssayId: string;
  focus?: GalleryEssayCompareFocus;
  clientRequestId?: string;
}

export type GalleryEssayOverlapRisk = 'low' | 'medium' | 'high';

export interface GalleryEssayCompareResponse {
  essayId: string;
  userEssayId: string;
  interactionId: string;
  referenceSignals: string[];
  gapAnalysis: string[];
  overlapWarnings: string[];
  overlapRisk: GalleryEssayOverlapRisk;
  overlapRiskReason?: string;
  revisionActions: string[];
  evidence: GalleryEssayEvidence[];
  tokensUsed: number;
  resultId?: string;
}

export type GalleryEssayAIInteractionType = 'question' | 'compare';
export type GalleryEssayAIInteractionStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';
export type GalleryEssayFeedbackSentiment = 'HELPFUL' | 'NOT_HELPFUL';
export type GalleryEssayFeedbackCategory =
  | 'wrong_evidence'
  | 'too_generic'
  | 'template_like'
  | 'cost_not_worth'
  | 'other';

export interface GalleryEssayInteractionFeedback {
  id: string;
  interactionId: string;
  sentiment: GalleryEssayFeedbackSentiment;
  category?: GalleryEssayFeedbackCategory | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryEssayInteractionFeedbackRequest {
  sentiment: GalleryEssayFeedbackSentiment;
  category?: GalleryEssayFeedbackCategory;
  notes?: string;
}

export interface GalleryEssayInteractionFeedbackResponse extends GalleryEssayInteractionFeedback {}

export interface GalleryEssayAIInteractionItem {
  id: string;
  essayId: string;
  type: GalleryEssayAIInteractionType;
  status: GalleryEssayAIInteractionStatus;
  locale: string;
  question?: string | null;
  paragraphIndex?: number | null;
  selectedText?: string | null;
  focus?: GalleryEssayCompareFocus | string | null;
  userEssayId?: string | null;
  essayAIResultId?: string | null;
  resultId?: string | null;
  answer?: string | null;
  followUps?: string[];
  referenceSignals?: string[];
  gapAnalysis?: string[];
  overlapWarnings?: string[];
  overlapRisk?: GalleryEssayOverlapRisk;
  overlapRiskReason?: string;
  revisionActions?: string[];
  evidence: GalleryEssayEvidence[];
  tokensUsed: number;
  pointsAction?: string | null;
  pointsCharged?: number | null;
  pointsHistoryId?: string | null;
  refundPointHistoryId?: string | null;
  refundStatus?: string | null;
  errorMessage?: string | null;
  feedback?: GalleryEssayInteractionFeedback | null;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryEssayInteractionsResponse {
  items: GalleryEssayAIInteractionItem[];
  total: number;
  limit: number;
}

export interface AdminEssayGalleryAIMetricsResponse {
  generatedAt: string;
  period?: {
    from?: string;
    to?: string;
  };
  totals: {
    interactions: number;
    questions: number;
    compares: number;
    succeeded: number;
    failed: number;
    refunded: number;
    feedback: number;
    helpful: number;
    notHelpful: number;
  };
  rates: {
    helpfulRate: number;
    failureRate: number;
  };
  tokens: {
    average: number;
  };
  learningNotes: {
    publicEssayCount: number;
    readyCount: number;
    missingCount: number;
    missingRate: number;
  };
}
