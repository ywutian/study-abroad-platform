export interface Essay {
  id: string;
  title: string;
  prompt?: string;
  content: string;
  wordCount?: number;
  schoolId?: string;
  essayPromptId?: string;
  linkedPrompt?: {
    id: string;
    type: string;
    prompt: string;
    promptZh?: string;
    wordLimit?: number;
    isRequired?: boolean;
    school?: {
      id: string;
      name: string;
      nameZh?: string;
    };
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface EssayReview {
  overallScore: number;
  scores: {
    clarity: number;
    uniqueness: number;
    storytelling: number;
    authenticity: number;
    language: number;
  };
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  cliches?: Array<{ text: string; suggestion: string }>;
  verdict: string;

  // Legacy fields for backward compatibility with cached results
  structure?: { score: number; feedback: string };
  content?: { score: number; feedback: string };
  language?: { score: number; feedback: string };
}

export interface PolishResult {
  polished: string;
  changes: Array<{ original: string; revised: string; reason: string }>;
}

export interface RewriteResult {
  versions: Array<{ text: string; style: string }>;
}

export interface ContinueResult {
  continuation: string;
  suggestions: string[];
}

export interface OpeningResult {
  openings: Array<{ text: string; style: string }>;
}

export type EssaySuggestionStatus = 'PENDING' | 'APPLIED' | 'REJECTED';

export interface EssaySuggestion {
  id: string;
  essayId: string;
  kind: string;
  originalText?: string | null;
  replacementText: string;
  reason: string;
  impact?: string | null;
  status: EssaySuggestionStatus;
  insertMode: 'replace' | 'append' | 'prepend' | string;
  createdFromRevisionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EssayRevision {
  id: string;
  essayId: string;
  title: string;
  prompt?: string | null;
  content: string;
  wordCount: number;
  reason?: string | null;
  source: string;
  createdAt: string;
}

export interface EssaySuggestEditsResult {
  suggestions: EssaySuggestion[];
  revisionId: string;
  tokenUsed: number;
}
