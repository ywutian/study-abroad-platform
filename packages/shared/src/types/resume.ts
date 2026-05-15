// Resume System

export enum ResumeStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  REVIEWED = 'REVIEWED',
  APPROVED = 'APPROVED',
  EXPORTED = 'EXPORTED',
  ARCHIVED = 'ARCHIVED',
}

export enum ResumeType {
  COLLEGE_APPLICATION = 'COLLEGE_APPLICATION',
  INTERNSHIP = 'INTERNSHIP',
  GRADUATE_CV = 'GRADUATE_CV',
  FULL_TIME_JOB = 'FULL_TIME_JOB',
}

export enum ResumeFamily {
  STUDY_ABROAD = 'STUDY_ABROAD',
  CAREER = 'CAREER',
}

export enum ResumeVariantKind {
  MASTER = 'MASTER',
  TAILORED = 'TAILORED',
}

export enum ResumeTargetType {
  COLLEGE_APPLICATION = 'COLLEGE_APPLICATION',
  GRADUATE_PROGRAM = 'GRADUATE_PROGRAM',
  INTERNSHIP = 'INTERNSHIP',
  FULL_TIME_JOB = 'FULL_TIME_JOB',
}

export enum ResumeTargetStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUBMITTED = 'SUBMITTED',
  ARCHIVED = 'ARCHIVED',
}

export enum ResumeEvidenceKind {
  EDUCATION = 'EDUCATION',
  TEST_SCORE = 'TEST_SCORE',
  RESEARCH = 'RESEARCH',
  WORK_EXPERIENCE = 'WORK_EXPERIENCE',
  PROJECT = 'PROJECT',
  ACTIVITY = 'ACTIVITY',
  COMMUNITY_SERVICE = 'COMMUNITY_SERVICE',
  AWARD = 'AWARD',
  SKILL = 'SKILL',
  PUBLICATION = 'PUBLICATION',
  TEACHING = 'TEACHING',
  CERTIFICATION = 'CERTIFICATION',
  CUSTOM = 'CUSTOM',
}

export enum ResumeEvidenceSource {
  PROFILE = 'PROFILE',
  RESUME_IMPORT = 'RESUME_IMPORT',
  MANUAL = 'MANUAL',
  AI_GENERATED = 'AI_GENERATED',
}

export enum ResumePrivacyLevel {
  PRIVATE = 'PRIVATE',
  COUNSELOR_VISIBLE = 'COUNSELOR_VISIBLE',
  PUBLIC_SHAREABLE = 'PUBLIC_SHAREABLE',
}

export enum ResumeAIIssueStatus {
  OPEN = 'OPEN',
  ACCEPTED = 'ACCEPTED',
  DISMISSED = 'DISMISSED',
  APPLIED = 'APPLIED',
  STALE = 'STALE',
}

export enum ResumeExportFormat {
  PDF = 'PDF',
  DOCX = 'DOCX',
  TXT = 'TXT',
  JSON = 'JSON',
}

export enum ResumeExportStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
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
  targetId?: string | null;
  baseResumeId?: string | null;
  title: string;
  status: ResumeStatus;
  type: ResumeType;
  family: ResumeFamily;
  variantKind: ResumeVariantKind;
  templateId: string;
  language: string;
  settings: ResumeSettings;
  targetContext?: ResumeTargetContext;
  qualitySummary?: ResumeQualitySummary;
  sections: ResumeSection[];
  version: number;
  lastImportedAt?: string;
  lastReviewAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeSummary {
  id: string;
  title: string;
  status: ResumeStatus;
  type: ResumeType;
  family: ResumeFamily;
  variantKind: ResumeVariantKind;
  templateId: string;
  language: string;
  targetId?: string | null;
  baseResumeId?: string | null;
  targetContext?: ResumeTargetContext;
  qualitySummary?: ResumeQualitySummary;
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
  contentSchemaVersion?: number;
  contentHash?: string | null;
  evidenceRefs?: ResumeEvidenceRef[];
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

export interface ResumeTargetContext {
  targetSchool?: string;
  targetMajor?: string;
  applicationRound?: string;
  programName?: string;
  researchArea?: string;
  advisorName?: string;
  labName?: string;
  targetRole?: string;
  company?: string;
  jobDescription?: string;
  keywords?: string[];
}

export interface ResumeEvidenceRef {
  evidenceId: string;
  field?: string;
  note?: string;
}

export interface ResumeEvidence {
  id: string;
  userId: string;
  kind: ResumeEvidenceKind;
  source: ResumeEvidenceSource;
  title: string;
  organization?: string | null;
  role?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent: boolean;
  tags: string[];
  skills: string[];
  metrics: Record<string, unknown>;
  proofLinks: string[];
  content: Record<string, unknown>;
  confidence?: number | null;
  privacyLevel: ResumePrivacyLevel;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeTarget {
  id: string;
  userId: string;
  type: ResumeTargetType;
  status: ResumeTargetStatus;
  title: string;
  school?: string | null;
  program?: string | null;
  major?: string | null;
  applicationRound?: string | null;
  advisorName?: string | null;
  researchArea?: string | null;
  labName?: string | null;
  company?: string | null;
  role?: string | null;
  jobDescription?: string | null;
  deadline?: string | null;
  keywords: string[];
  requirements: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeQualityDimension {
  key: string;
  label: string;
  score: number;
  status: 'green' | 'yellow' | 'red';
  checks: string[];
}

export interface ResumeQualitySummary {
  score: number;
  family: ResumeFamily;
  rubricVersion: string;
  dimensions: ResumeQualityDimension[];
  gaps: Array<{
    key: string;
    label: string;
    severity: ReviewSeverity;
    sectionType?: string;
  }>;
  updatedAt: string;
}

export interface ResumeAIIssue {
  id: string;
  resumeId: string;
  reviewId?: string | null;
  sectionId?: string | null;
  type: string;
  severity: ReviewSeverity | string;
  status: ResumeAIIssueStatus;
  title: string;
  original?: string | null;
  suggestion?: string | null;
  reason?: string | null;
  patch: Record<string, unknown>;
  confidence?: number | null;
  source: string;
  baseContentHash?: string | null;
  appliedAt?: string | null;
  dismissedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeExport {
  id: string;
  resumeId: string;
  format: ResumeExportFormat;
  status: ResumeExportStatus;
  templateId: string;
  pageSize?: string | null;
  pageCount?: number | null;
  textExtractable?: boolean | null;
  artifactUrl?: string | null;
  metadata: Record<string, unknown>;
  errorMessage?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeImportPreview {
  resumeId: string;
  sections: Array<{
    sectionId: string;
    sectionType: ResumeSectionType | string;
    title: string;
    currentContent: Record<string, unknown>;
    proposedContent: Record<string, unknown>;
    changeType: 'replace' | 'skip';
    itemCount: number;
  }>;
  warnings: string[];
}

export interface ResumeUploadImportPreview {
  resumeId: string;
  sourceFileName: string;
  rawTextPreview: string;
  sections: Array<{
    sectionId?: string;
    sectionType: ResumeSectionType | string;
    title: string;
    currentContent: Record<string, unknown>;
    proposedContent: Record<string, unknown>;
    changeType: 'replace' | 'create';
    itemCount: number;
  }>;
  evidence: Array<{
    kind: ResumeEvidenceKind | string;
    title: string;
    organization?: string | null;
    role?: string | null;
    description?: string | null;
    tags?: string[];
    skills?: string[];
    content?: Record<string, unknown>;
  }>;
  warnings: string[];
}

export interface ResumeComment {
  id: string;
  resumeId: string;
  sectionId?: string | null;
  itemId?: string | null;
  authorId: string;
  author?: {
    id: string;
    email: string;
    role: string;
  };
  role: 'STUDENT' | 'COUNSELOR' | 'ADMIN' | string;
  body: string;
  status: 'OPEN' | 'RESOLVED' | string;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
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
