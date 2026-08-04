/**
 * Types, label maps and pure helpers for the resume editor.
 *
 * Extracted from page.tsx, which was 2,941 lines — six times the 500-line
 * limit the repo's own `page-size-limit` rule sets for a page, and the
 * largest file in apps/web. Nothing here touches JSX, hooks or props: it is
 * the part of the module that can move without changing a single render.
 */
import type { useTranslations } from 'next-intl';
import type {
  BulletOptimizeResult,
  ResumeQualitySummary,
  ResumeReviewResult,
  ResumeReviewResultV1,
  ResumeSettings,
  ResumeTargetContext,
} from '@study-abroad/shared';
import { BookOpen, Briefcase, Building2, GraduationCap } from 'lucide-react';

export type ResumeType = 'COLLEGE_APPLICATION' | 'INTERNSHIP' | 'GRADUATE_CV' | 'FULL_TIME_JOB';
export type ResumeStatus = 'DRAFT' | 'ACTIVE' | 'REVIEWED' | 'APPROVED' | 'EXPORTED' | 'ARCHIVED';
export type ResumeFamily = 'STUDY_ABROAD' | 'CAREER';
export type ResumeVariantKind = 'MASTER' | 'TAILORED';

export interface ResumeSection {
  [key: string]: unknown;
  id: string;
  resumeId: string;
  type: string;
  title: string;
  content: Record<string, unknown>;
  contentSchemaVersion?: number;
  contentHash?: string | null;
  evidenceRefs?: Array<{ evidenceId: string; field?: string; note?: string }>;
  isVisible: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Resume {
  id: string;
  userId: string;
  title: string;
  status: ResumeStatus;
  type: ResumeType;
  family?: ResumeFamily;
  variantKind?: ResumeVariantKind;
  targetId?: string | null;
  baseResumeId?: string | null;
  templateId: string;
  language: string;
  settings: ResumeSettings;
  targetContext?: ResumeTargetContext;
  qualitySummary?: ResumeQualitySummary;
  sections: ResumeSection[];
  version: number;
  lastImportedAt: string | null;
  lastReviewAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRecord {
  id: string;
  output: ResumeReviewResult | ResumeReviewResultV1;
  overallScore: number | null;
  createdAt: string;
}

export interface SnapshotRecord {
  id: string;
  version: number;
  description?: string | null;
  createdAt: string;
}

export type ConfirmState =
  | { type: 'delete-section'; sectionId: string; title: string }
  | { type: 'import-profile' }
  | { type: 'restore-snapshot'; snapshotId: string; version: number }
  | null;

export const SECTION_TYPE_LABEL_KEYS: Record<string, string> = {
  HEADER: 'sections.HEADER',
  EDUCATION: 'sections.EDUCATION',
  TEST_SCORES: 'sections.TEST_SCORES',
  RESEARCH: 'sections.RESEARCH',
  WORK_EXPERIENCE: 'sections.WORK_EXPERIENCE',
  PROJECTS: 'sections.PROJECTS',
  ACTIVITIES: 'sections.ACTIVITIES',
  COMMUNITY_SERVICE: 'sections.COMMUNITY_SERVICE',
  AWARDS: 'sections.AWARDS',
  SKILLS: 'sections.SKILLS',
  PUBLICATIONS: 'sections.PUBLICATIONS',
  TEACHING: 'sections.TEACHING',
  CERTIFICATIONS: 'sections.CERTIFICATIONS',
  CUSTOM: 'sections.CUSTOM',
};

export const ALL_SECTION_TYPES = Object.keys(SECTION_TYPE_LABEL_KEYS);

export const TYPE_META: Record<
  ResumeType,
  { icon: React.ElementType; labelKey: string; contextTitleKey: string }
> = {
  COLLEGE_APPLICATION: {
    icon: GraduationCap,
    labelKey: 'types.COLLEGE_APPLICATION',
    contextTitleKey: 'workbench.typeContextTitles.COLLEGE_APPLICATION',
  },
  INTERNSHIP: {
    icon: Briefcase,
    labelKey: 'types.INTERNSHIP',
    contextTitleKey: 'workbench.typeContextTitles.INTERNSHIP',
  },
  GRADUATE_CV: {
    icon: BookOpen,
    labelKey: 'types.GRADUATE_CV',
    contextTitleKey: 'workbench.typeContextTitles.GRADUATE_CV',
  },
  FULL_TIME_JOB: {
    icon: Building2,
    labelKey: 'types.FULL_TIME_JOB',
    contextTitleKey: 'workbench.typeContextTitles.FULL_TIME_JOB',
  },
};

export const STATUS_LABEL_KEYS: Record<ResumeStatus, string> = {
  DRAFT: 'status.DRAFT',
  ACTIVE: 'status.ACTIVE',
  REVIEWED: 'status.REVIEWED',
  APPROVED: 'status.APPROVED',
  EXPORTED: 'status.EXPORTED',
  ARCHIVED: 'status.ARCHIVED',
};

export const EMPTY_SETTINGS: ResumeSettings = {};
export type ResumeTranslator = ReturnType<typeof useTranslations>;

export function getSectionTypeLabel(t: ResumeTranslator, type: string, fallback?: string): string {
  const key = SECTION_TYPE_LABEL_KEYS[type];
  return key ? t(key) : (fallback ?? type);
}

export function sanitizeContext(context?: ResumeTargetContext): ResumeTargetContext {
  const cleaned: ResumeTargetContext = {};
  Object.entries(context ?? {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const items = value.map((item) => String(item).trim()).filter(Boolean);
      if (items.length > 0) {
        (cleaned as Record<string, unknown>)[key] = items;
      }
      return;
    }
    if (value === undefined || value === null) return;
    const text = String(value).trim();
    if (text) {
      (cleaned as Record<string, unknown>)[key] = text;
    }
  });
  return cleaned;
}

export function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (typeof value === 'object') return Object.values(value).some(hasMeaningfulValue);
  return true;
}

export function sectionCompletion(section: ResumeSection): number {
  const content = section.content ?? {};
  if (section.type === 'HEADER') {
    const hasName = hasMeaningfulValue(content.name);
    const hasContact = hasMeaningfulValue(content.email) || hasMeaningfulValue(content.phone);
    return [hasName, hasContact].filter(Boolean).length / 2;
  }
  if (section.type === 'SKILLS') {
    const categories = content.categories as Array<{ name?: string; items?: string[] }> | undefined;
    if (!categories?.length) return 0;
    const complete = categories.filter(
      (cat) => hasMeaningfulValue(cat.name) && hasMeaningfulValue(cat.items)
    ).length;
    return Math.min(1, complete / Math.max(1, categories.length));
  }
  const items = content.items as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(items)) {
    if (items.length === 0) return 0;
    const complete = items.filter((item) => hasMeaningfulValue(item)).length;
    return Math.min(1, complete / items.length);
  }
  return hasMeaningfulValue(content) ? 1 : 0;
}

export function getContentSummary(
  section: ResumeSection,
  t: ResumeTranslator
): Array<{ id?: string; primary: string; secondary: string }> {
  const content = section.content ?? {};
  if (section.type === 'HEADER') {
    return [
      {
        primary: String(content.name || t('workbench.summary.missingName')),
        secondary: [content.email, content.phone, content.website].filter(Boolean).join(' · '),
      },
    ];
  }
  if (section.type === 'SKILLS') {
    const categories = (content.categories ?? []) as Array<{ name?: string; items?: string[] }>;
    return categories.map((cat) => ({
      primary: cat.name || t('workbench.summary.untitledSkillCategory'),
      secondary: cat.items?.join(', ') ?? '',
    }));
  }
  const items = (content.items ?? []) as Array<Record<string, unknown>>;
  return items.map((item) => {
    const primary =
      (item.name as string) ||
      (item.schoolName as string) ||
      (item.title as string) ||
      (item.role as string) ||
      t('workbench.summary.untitledItem');
    const secondary = [
      item.company,
      item.organization,
      item.institution,
      item.degree,
      item.major,
      item.level,
      item.startDate && `${item.startDate}${item.endDate ? ` - ${item.endDate}` : ''}`,
    ]
      .filter(Boolean)
      .join(' · ');
    return { id: item.id as string | undefined, primary, secondary };
  });
}

export function replaceOptimizedBullets(
  content: Record<string, unknown>,
  result: BulletOptimizeResult,
  includeNewSuggestions: boolean
) {
  const next = structuredClone(content) as Record<string, unknown>;
  const items = next.items as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(items)) return next;

  for (const optimized of result.optimized) {
    for (const item of items) {
      const bullets = item.bullets as string[] | undefined;
      if (!Array.isArray(bullets)) continue;
      const idx = bullets.findIndex(
        (bullet) => bullet === optimized.original || bullet.includes(optimized.original)
      );
      if (idx >= 0) {
        bullets[idx] = optimized.improved;
        break;
      }
    }
  }

  if (includeNewSuggestions && result.newSuggestions?.length && items[0]) {
    const bullets = Array.isArray(items[0].bullets) ? (items[0].bullets as string[]) : [];
    items[0].bullets = [...bullets, ...result.newSuggestions];
  }

  return next;
}

export function appendExampleBullets(content: Record<string, unknown>, examples: string[]) {
  const next = structuredClone(content) as Record<string, unknown>;
  const items = next.items as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(items) || !items[0]) return next;
  const bullets = Array.isArray(items[0].bullets) ? (items[0].bullets as string[]) : [];
  items[0].bullets = [...bullets, ...examples];
  return next;
}

export function toggleSetValue<T>(set: Set<T>, value: T) {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}
