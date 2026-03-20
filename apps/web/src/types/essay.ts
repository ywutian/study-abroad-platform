export interface Essay {
  id: string;
  title: string;
  prompt?: string;
  content: string;
  wordCount?: number;
  schoolId?: string;
  essayPromptId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EssayReview {
  overallScore: number;
  structure: { score: number; feedback: string };
  content: { score: number; feedback: string };
  language: { score: number; feedback: string };
  suggestions: string[];
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
