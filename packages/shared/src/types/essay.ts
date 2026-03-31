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
