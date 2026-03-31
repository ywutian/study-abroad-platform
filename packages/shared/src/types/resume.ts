// Resume System

export enum ResumeStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum ResumeType {
  COLLEGE_APPLICATION = 'COLLEGE_APPLICATION',
  INTERNSHIP = 'INTERNSHIP',
  GRADUATE_CV = 'GRADUATE_CV',
}

export enum ResumeSectionType {
  HEADER = 'HEADER',
  EDUCATION = 'EDUCATION',
  TEST_SCORES = 'TEST_SCORES',
  RESEARCH = 'RESEARCH',
  WORK_EXPERIENCE = 'WORK_EXPERIENCE',
  PROJECTS = 'PROJECTS',
  ACTIVITIES = 'ACTIVITIES',
  COMMUNITY_SERVICE = 'COMMUNITY_SERVICE',
  AWARDS = 'AWARDS',
  SKILLS = 'SKILLS',
  PUBLICATIONS = 'PUBLICATIONS',
  TEACHING = 'TEACHING',
  CERTIFICATIONS = 'CERTIFICATIONS',
  CUSTOM = 'CUSTOM',
}

export interface Resume {
  id: string;
  userId: string;
  title: string;
  status: ResumeStatus;
  type: ResumeType;
  templateId: string;
  language: string;
  settings: ResumeSettings;
  sections: ResumeSection[];
  version: number;
  lastImportedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeSummary {
  id: string;
  title: string;
  status: ResumeStatus;
  type: ResumeType;
  templateId: string;
  language: string;
  version: number;
  updatedAt: string;
  createdAt: string;
  _count: { sections: number };
}

export interface ResumeSection {
  id: string;
  resumeId: string;
  type: ResumeSectionType;
  title: string;
  content: Record<string, unknown>;
  isVisible: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeSnapshot {
  id: string;
  resumeId: string;
  version: number;
  description?: string;
  createdAt: string;
}

// ─── Resume Customization Settings ───

export interface ResumeColorSettings {
  primary?: string;
  text?: string;
  textLight?: string;
  background?: string;
  border?: string;
  sidebarBg?: string;
  sidebarText?: string;
  headerBg?: string;
  headerText?: string;
}

export interface ResumeFontSettings {
  heading?: string;
  body?: string;
}

export interface ResumeFontSizeSettings {
  name?: number;
  sectionTitle?: number;
  body?: number;
  small?: number;
}

export interface ResumeSpacingSettings {
  pageMarginX?: number;
  pageMarginY?: number;
  sectionGap?: number;
  itemGap?: number;
  lineHeight?: number;
}

export interface ResumeDecorationSettings {
  sectionDivider?: 'line' | 'double-line' | 'dots' | 'none';
  headingStyle?: 'underline' | 'background' | 'border-left' | 'uppercase' | 'plain';
  bulletStyle?: 'disc' | 'dash' | 'arrow' | 'square';
  pageSize?: 'LETTER' | 'A4';
  dateFormat?: 'MMM YYYY' | 'MM/YYYY' | 'YYYY';
}

export interface ResumeSettings {
  colors?: ResumeColorSettings;
  fonts?: ResumeFontSettings;
  fontSize?: ResumeFontSizeSettings;
  spacing?: ResumeSpacingSettings;
  decorations?: ResumeDecorationSettings;
}

// Resume Section Content Types

export interface HeaderContent {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  linkedIn?: string;
  github?: string;
  website?: string;
  targetMajor?: string;
}

export interface EducationItem {
  id: string;
  schoolName: string;
  location?: string;
  degree?: string;
  major?: string;
  gpa?: number;
  gpaScale?: number;
  startDate: string;
  endDate?: string;
  coursework?: string[];
  honors?: string[];
  description?: string;
}

export interface TestScoreItem {
  id: string;
  type: string;
  score: number;
  subScores?: Record<string, number>;
  testDate?: string;
}

export interface ExperienceItem {
  id: string;
  title: string;
  company?: string;
  institution?: string;
  advisor?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  bullets: string[];
}

export interface ProjectItem {
  id: string;
  name: string;
  techStack?: string[];
  url?: string;
  startDate?: string;
  endDate?: string;
  bullets: string[];
}

export interface ActivityItem {
  id: string;
  name: string;
  role: string;
  organization?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  isOngoing?: boolean;
  bullets: string[];
  hoursPerWeek?: number;
  weeksPerYear?: number;
}

export interface AwardItem {
  id: string;
  name: string;
  level: string;
  issuer?: string;
  year?: number;
  description?: string;
}

export interface SkillCategory {
  name: string;
  items: string[];
}

export interface PublicationItem {
  id: string;
  title: string;
  authors?: string;
  venue?: string;
  date?: string;
  doi?: string;
  status?: string;
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  date?: string;
  url?: string;
}

// Resume AI Review Types — v1 (legacy)
export interface ResumeReviewResultV1 {
  overallScore: number;
  dimensions: Array<{
    name: string;
    score: number;
    status: 'green' | 'yellow' | 'red';
    feedback: string;
    improvements: string[];
  }>;
  bulletQuality: {
    actionVerbUsage: number;
    quantificationRate: number;
    averageLength: number;
  };
  contentGaps: string[];
  summary: string;
}

// Resume AI Review Types — v2
export type ReviewIssueType =
  | 'weak_verb'
  | 'no_quantification'
  | 'too_vague'
  | 'missing_result'
  | 'too_long'
  | 'too_short'
  | 'formatting'
  | 'relevance'
  | 'missing_info'
  | 'tense_inconsistency'
  | 'generic_claim';

export type ReviewSeverity = 'high' | 'medium' | 'low';

export interface ReviewCriterion {
  key: string;
  name: string;
  score: number;
  maxScore: number;
  detail: string;
}

export interface SectionIssue {
  type: ReviewIssueType;
  severity: ReviewSeverity;
  original: string;
  suggestion: string;
  reason: string;
  bulletIndex?: number;
}

export interface SectionFeedback {
  sectionType: string;
  sectionTitle: string;
  sectionId?: string;
  issues: SectionIssue[];
}

export interface ContentGap {
  sectionType: string;
  description: string;
  priority: ReviewSeverity;
  example?: string;
}

export interface ResumeReviewResult {
  version: 2;
  overallScore: number;
  dimensions: Array<{
    name: string;
    score: number;
    status: 'green' | 'yellow' | 'red';
    feedback: string;
    criteria: ReviewCriterion[];
    improvements: string[];
  }>;
  sectionFeedback: SectionFeedback[];
  contentGaps: ContentGap[];
  bulletQuality: {
    actionVerbUsage: number;
    quantificationRate: number;
    averageLength: number;
  };
  summary: string;
}

export interface BulletOptimizeResult {
  optimized: Array<{
    original: string;
    improved: string;
    reason: string;
  }>;
  newSuggestions?: string[];
}

export interface ContentSuggestionResult {
  suggestions: Array<{
    text: string;
    category: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  tips: string[];
  exampleBullets?: string[];
}
