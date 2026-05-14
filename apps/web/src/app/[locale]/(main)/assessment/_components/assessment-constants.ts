import { Wrench, ClipboardCheck, Palette, Users, Briefcase, LineChart } from 'lucide-react';

// MBTI dimension display names
export const DIMENSION_NAMES: Record<string, string> = {
  EI: 'E-I',
  SN: 'S-N',
  TF: 'T-F',
  JP: 'J-P',
};

// Estimated seconds per question
export const SECONDS_PER_QUESTION = 8;

// Holland type icons
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const HOLLAND_ICONS: Record<string, any> = {
  R: Wrench,
  I: ClipboardCheck,
  A: Palette,
  S: Users,
  E: Briefcase,
  C: LineChart,
};

// Holland type colors (with dark mode variants)
export const HOLLAND_COLORS: Record<string, string> = {
  R: 'bg-amber-500 dark:bg-amber-600',
  I: 'bg-blue-500 dark:bg-blue-600',
  A: 'bg-primary dark:bg-primary',
  S: 'bg-green-500 dark:bg-green-600',
  E: 'bg-red-500 dark:bg-red-600',
  C: 'bg-cyan-500 dark:bg-cyan-600',
};

// Determine if question uses Likert scale (MBTI new version)
export interface Question {
  id: string;
  text: string;
  textZh: string;
  options: { value: number | string; text: string; textZh: string }[];
  dimension?: string;
}

export interface Assessment {
  id: string;
  type: string;
  title: string;
  titleZh: string;
  description?: string;
  descriptionZh?: string;
  questions: Question[];
}

export interface MbtiResult {
  type: string;
  scores: Record<string, number>;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  strengths: string[];
  careers: string[];
  majors: string[];
}

export interface HollandResult {
  codes: string;
  scores: Record<string, number>;
  types: string[];
  typesZh: string[];
  fields: string[];
  fieldsZh: string[];
  majors: string[];
}

export interface AssessmentResult {
  id: string;
  type: string;
  mbtiResult?: MbtiResult;
  hollandResult?: HollandResult;
  completedAt: string;
}

export const isLikertQuestion = (options: Question['options']) => {
  return options.length === 5 && typeof options[0]?.value === 'number';
};
