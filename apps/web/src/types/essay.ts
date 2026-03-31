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
