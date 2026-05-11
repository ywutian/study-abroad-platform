'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Briefcase,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  History,
  LayoutTemplate,
  Loader2,
  MoreVertical,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Link, useRouter } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AI_TIMEOUTS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { SortableList, DragHandle, type DragHandleProps } from '@/components/ui/sortable-list';
import { ResumePreview } from '@/components/features/resume/resume-preview';
import { SectionEditor } from '@/components/features/resume/resume-editor/section-editor';
import { TemplatePicker } from '@/components/features/resume/template-picker';
import { CustomizePanel } from '@/components/features/resume/customize-panel';
import { ReviewDialog } from '@/components/features/resume/review-dialog';
import type { SectionConfig } from '@/components/features/resume/pdf/types';
import {
  resumeRoutes,
  type BulletOptimizeResult,
  type ContentSuggestionResult,
  type ResumeReviewResult,
  type ResumeReviewResultV1,
  type ResumeSettings,
  type ResumeTargetContext,
} from '@study-abroad/shared';

type ResumeType = 'COLLEGE_APPLICATION' | 'INTERNSHIP' | 'GRADUATE_CV';
type ResumeStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

interface ResumeSection {
  [key: string]: unknown;
  id: string;
  resumeId: string;
  type: string;
  title: string;
  content: Record<string, unknown>;
  isVisible: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface Resume {
  id: string;
  userId: string;
  title: string;
  status: ResumeStatus;
  type: ResumeType;
  templateId: string;
  language: string;
  settings: ResumeSettings;
  targetContext?: ResumeTargetContext;
  sections: ResumeSection[];
  version: number;
  lastImportedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReviewRecord {
  id: string;
  output: ResumeReviewResult | ResumeReviewResultV1;
  overallScore: number | null;
  createdAt: string;
}

interface SnapshotRecord {
  id: string;
  version: number;
  description?: string | null;
  createdAt: string;
}

type ConfirmState =
  | { type: 'delete-section'; sectionId: string; title: string }
  | { type: 'import-profile' }
  | { type: 'restore-snapshot'; snapshotId: string; version: number }
  | null;

const SECTION_TYPE_LABEL_KEYS: Record<string, string> = {
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

const ALL_SECTION_TYPES = Object.keys(SECTION_TYPE_LABEL_KEYS);

const TYPE_META: Record<
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
};

const STATUS_LABEL_KEYS: Record<ResumeStatus, string> = {
  DRAFT: 'status.DRAFT',
  ACTIVE: 'status.ACTIVE',
  ARCHIVED: 'status.ARCHIVED',
};

const EMPTY_SETTINGS: ResumeSettings = {};
type ResumeTranslator = ReturnType<typeof useTranslations>;

function getSectionTypeLabel(t: ResumeTranslator, type: string, fallback?: string): string {
  const key = SECTION_TYPE_LABEL_KEYS[type];
  return key ? t(key) : (fallback ?? type);
}

function sanitizeContext(context?: ResumeTargetContext): ResumeTargetContext {
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

function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (typeof value === 'object') return Object.values(value).some(hasMeaningfulValue);
  return true;
}

function sectionCompletion(section: ResumeSection): number {
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

function getContentSummary(
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

function replaceOptimizedBullets(
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

function appendExampleBullets(content: Record<string, unknown>, examples: string[]) {
  const next = structuredClone(content) as Record<string, unknown>;
  const items = next.items as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(items) || !items[0]) return next;
  const bullets = Array.isArray(items[0].bullets) ? (items[0].bullets as string[]) : [];
  items[0].bullets = [...bullets, ...examples];
  return next;
}

export default function ResumeEditPage() {
  const t = useTranslations('resume');
  const params = useParams();
  const resumeId = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const sectionSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const resumeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [targetDraft, setTargetDraft] = useState<ResumeTargetContext>({});
  const [pendingSectionIds, setPendingSectionIds] = useState<Set<string>>(new Set());
  const [pendingResumeSave, setPendingResumeSave] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [optimizeState, setOptimizeState] = useState<{
    sectionId: string;
    result: BulletOptimizeResult;
  } | null>(null);
  const [suggestionState, setSuggestionState] = useState<{
    sectionType: string;
    result: ContentSuggestionResult;
  } | null>(null);

  const {
    data: resume,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['resume', resumeId],
    queryFn: () => apiClient.get<Resume>(resumeRoutes.byId(resumeId)),
  });

  const { data: latestReview } = useQuery({
    queryKey: ['resume', resumeId, 'aiReview', 'latest'],
    queryFn: () => apiClient.get<ReviewRecord | null>(resumeRoutes.aiReviewLatest(resumeId)),
    enabled: Boolean(resumeId),
  });

  const { data: snapshots } = useQuery({
    queryKey: ['resume', resumeId, 'snapshots'],
    queryFn: () => apiClient.get<SnapshotRecord[]>(resumeRoutes.snapshots(resumeId)),
    enabled: Boolean(resumeId),
  });

  useEffect(() => {
    if (resume) {
      setTitleDraft(resume.title);
      setTargetDraft(resume.targetContext ?? {});
    }
    // Only initialize local drafts when a different resume is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume?.id]);

  useEffect(() => {
    const timers = sectionSaveTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      if (resumeSaveTimer.current) clearTimeout(resumeSaveTimer.current);
    };
  }, []);

  const patchResumeCache = useCallback(
    (patch: Partial<Resume>) => {
      queryClient.setQueryData<Resume>(['resume', resumeId], (current) =>
        current ? { ...current, ...patch } : current
      );
    },
    [queryClient, resumeId]
  );

  const patchSectionCache = useCallback(
    (sectionId: string, patch: Partial<ResumeSection>) => {
      queryClient.setQueryData<Resume>(['resume', resumeId], (current) => {
        if (!current) return current;
        return {
          ...current,
          sections: current.sections.map((section) =>
            section.id === sectionId ? { ...section, ...patch } : section
          ),
        };
      });
    },
    [queryClient, resumeId]
  );

  const updateResumeMutation = useMutation({
    mutationFn: (
      dto: Partial<Pick<Resume, 'title' | 'status' | 'templateId' | 'settings' | 'targetContext'>>
    ) => apiClient.put<Resume>(resumeRoutes.byId(resumeId), dto),
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
      toast.error(t('workbench.toasts.saveResumeFailed'));
    },
    onSettled: () => {
      setPendingResumeSave(false);
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({
      sectionId,
      dto,
    }: {
      sectionId: string;
      dto: { title?: string; content?: Record<string, unknown>; isVisible?: boolean };
    }) => apiClient.put<ResumeSection>(resumeRoutes.section(resumeId, sectionId), dto),
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
      toast.error(t('workbench.toasts.saveSectionFailed'));
    },
    onSettled: (_data, _error, variables) => {
      setPendingSectionIds((prev) => {
        const next = new Set(prev);
        next.delete(variables.sectionId);
        return next;
      });
    },
  });

  const addSectionMutation = useMutation({
    mutationFn: (dto: { type: string; title?: string; content?: Record<string, unknown> }) =>
      apiClient.post<ResumeSection>(resumeRoutes.sections(resumeId), dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
      setAddSectionOpen(false);
      toast.success(t('workbench.toasts.sectionAdded'));
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: string) => apiClient.delete(resumeRoutes.section(resumeId, sectionId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
      toast.success(t('workbench.toasts.sectionDeleted'));
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (sectionIds: string[]) =>
      apiClient.put(resumeRoutes.reorderSections(resumeId), { sectionIds }),
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
      toast.error(t('workbench.toasts.reorderFailed'));
    },
  });

  const importProfileMutation = useMutation({
    mutationFn: () => apiClient.post<Resume>(resumeRoutes.importProfile(resumeId)),
    onSuccess: (data) => {
      queryClient.setQueryData(['resume', resumeId], data);
      toast.success(t('workbench.toasts.profileImported'));
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: () => apiClient.post<Resume>(resumeRoutes.duplicate(resumeId)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      router.push(`/resume/${data.id}`);
      toast.success(t('workbench.toasts.duplicated'));
    },
  });

  const snapshotMutation = useMutation({
    mutationFn: (description?: string) =>
      apiClient.post(resumeRoutes.snapshots(resumeId), { description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId, 'snapshots'] });
      toast.success(t('workbench.toasts.snapshotSaved'));
    },
  });

  const restoreSnapshotMutation = useMutation({
    mutationFn: (snapshotId: string) =>
      apiClient.post<Resume>(resumeRoutes.snapshotRestore(resumeId, snapshotId)),
    onSuccess: (data) => {
      queryClient.setQueryData(['resume', resumeId], data);
      toast.success(t('workbench.toasts.snapshotRestored'));
    },
  });

  const aiReviewMutation = useMutation({
    mutationFn: () =>
      apiClient.post<ReviewRecord>(
        resumeRoutes.aiReview(resumeId),
        { targetContext: sanitizeContext(targetDraft) },
        { timeout: AI_TIMEOUTS.AI_REQUEST }
      ),
    onSuccess: (record) => {
      queryClient.setQueryData(['resume', resumeId, 'aiReview', 'latest'], record);
      setReviewOpen(true);
      toast.success(t('workbench.toasts.aiReviewComplete'));
    },
    onError: () => toast.error(t('workbench.toasts.aiReviewFailed')),
  });

  const aiOptimizeMutation = useMutation({
    mutationFn: (payload: { sectionId: string; itemId?: string }) =>
      apiClient.post<BulletOptimizeResult>(
        resumeRoutes.aiOptimize(resumeId),
        { ...payload, targetContext: sanitizeContext(targetDraft) },
        { timeout: AI_TIMEOUTS.AI_REQUEST }
      ),
    onSuccess: (result, payload) => {
      setOptimizeState({ sectionId: payload.sectionId, result });
    },
    onError: () => toast.error(t('workbench.toasts.optimizeFailed')),
  });

  const aiSuggestMutation = useMutation({
    mutationFn: (sectionType: string) =>
      apiClient.post<ContentSuggestionResult>(
        resumeRoutes.aiSuggestContent(resumeId),
        { sectionType, targetContext: sanitizeContext(targetDraft) },
        { timeout: AI_TIMEOUTS.AI_REQUEST }
      ),
    onSuccess: (result, sectionType) => {
      setSuggestionState({ sectionType, result });
    },
    onError: () => toast.error(t('workbench.toasts.suggestFailed')),
  });

  const updateResumeDraft = useCallback(
    (patch: Partial<Resume>, debounce = false) => {
      patchResumeCache(patch);
      setPendingResumeSave(true);
      if (resumeSaveTimer.current) clearTimeout(resumeSaveTimer.current);
      const save = () => updateResumeMutation.mutate(patch);
      if (debounce) {
        resumeSaveTimer.current = setTimeout(save, 700);
      } else {
        save();
      }
    },
    [patchResumeCache, updateResumeMutation]
  );

  const updateSectionNow = useCallback(
    (
      sectionId: string,
      dto: { title?: string; content?: Record<string, unknown>; isVisible?: boolean }
    ) => {
      patchSectionCache(sectionId, dto);
      setPendingSectionIds((prev) => new Set(prev).add(sectionId));
      updateSectionMutation.mutate({ sectionId, dto });
    },
    [patchSectionCache, updateSectionMutation]
  );

  const updateSectionContentDebounced = useCallback(
    (sectionId: string, content: Record<string, unknown>) => {
      patchSectionCache(sectionId, { content });
      setPendingSectionIds((prev) => new Set(prev).add(sectionId));
      if (sectionSaveTimers.current[sectionId]) clearTimeout(sectionSaveTimers.current[sectionId]);
      sectionSaveTimers.current[sectionId] = setTimeout(() => {
        updateSectionMutation.mutate({ sectionId, dto: { content } });
      }, 700);
    },
    [patchSectionCache, updateSectionMutation]
  );

  const handleReorderSections = useCallback(
    (sections: ResumeSection[]) => {
      queryClient.setQueryData<Resume>(['resume', resumeId], (current) =>
        current
          ? {
              ...current,
              sections: sections.map((section, index) => ({ ...section, order: index })),
            }
          : current
      );
      reorderMutation.mutate(sections.map((section) => section.id));
    },
    [queryClient, reorderMutation, resumeId]
  );

  const handleExportPdf = useCallback(async () => {
    if (!resume) return;
    try {
      toast.loading(t('workbench.toasts.exportLoading'), { id: 'resume-export' });
      const [{ pdf }, { PreviewDocument }, { registerFonts }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/features/resume/resume-preview/preview-renderer'),
        import('@/components/features/resume/pdf/fonts/register'),
      ]);
      registerFonts();
      const visibleSections = resume.sections.filter((section) => section.isVisible);
      const blob = await pdf(
        <PreviewDocument
          sections={visibleSections}
          templateId={resume.templateId}
          settings={resume.settings}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${resume.title || 'resume'}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(t('workbench.toasts.exportedPdf'), { id: 'resume-export' });
    } catch {
      toast.error(t('workbench.toasts.exportFailed'), { id: 'resume-export' });
    }
  }, [resume, t]);

  const confirmAction = useCallback(() => {
    if (!confirmState) return;
    if (confirmState.type === 'delete-section') {
      deleteSectionMutation.mutate(confirmState.sectionId);
    }
    if (confirmState.type === 'import-profile') {
      importProfileMutation.mutate();
    }
    if (confirmState.type === 'restore-snapshot') {
      restoreSnapshotMutation.mutate(confirmState.snapshotId);
    }
    setConfirmState(null);
  }, [confirmState, deleteSectionMutation, importProfileMutation, restoreSnapshotMutation]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-8 w-72" />
        </div>
        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[250px_minmax(0,1fr)_minmax(360px,42vw)]">
          <Skeleton className="hidden h-full lg:block" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-44 w-full" />
            ))}
          </div>
          <Skeleton className="hidden h-full lg:block" />
        </div>
      </div>
    );
  }

  if (error || !resume) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">{t('workbench.error.loadFailed')}</p>
        <Button variant="outline" onClick={() => router.push('/resume')}>
          {t('workbench.error.backToList')}
        </Button>
      </div>
    );
  }

  const resumeSections = [...resume.sections].sort((a, b) => a.order - b.order);
  const visibleSections: SectionConfig[] = resumeSections
    .filter((section) => section.isVisible)
    .map((section) => ({
      id: section.id,
      type: section.type,
      title: section.title,
      content: section.content,
      isVisible: section.isVisible,
    }));
  const existingSectionTypes = new Set(resumeSections.map((section) => section.type));
  const availableSectionTypes = ALL_SECTION_TYPES.filter((type) => !existingSectionTypes.has(type));
  const meta = TYPE_META[resume.type] ?? TYPE_META.COLLEGE_APPLICATION;
  const TypeIcon = meta.icon;
  const completion = Math.round(
    (resumeSections.reduce((sum, section) => sum + sectionCompletion(section), 0) /
      Math.max(1, resumeSections.length)) *
      100
  );
  const latestReviewResult = latestReview?.output ?? null;

  const editorColumn = (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <TargetContextPanel
          type={resume.type}
          value={targetDraft}
          pending={pendingResumeSave}
          onChange={setTargetDraft}
          onSave={() => updateResumeDraft({ targetContext: sanitizeContext(targetDraft) })}
        />

        <SortableList
          items={resumeSections}
          onReorder={handleReorderSections}
          className="space-y-3"
          withOverlay={false}
          renderItem={(section, index, dragHandleProps) => (
            <WorkbenchSectionCard
              section={section}
              index={index}
              dragHandleProps={dragHandleProps}
              isSaving={pendingSectionIds.has(section.id)}
              onToggleVisibility={() =>
                updateSectionNow(section.id, { isVisible: !section.isVisible })
              }
              onTitleChange={(title) => updateSectionNow(section.id, { title })}
              onContentChange={(content) => updateSectionContentDebounced(section.id, content)}
              onDelete={() =>
                setConfirmState({
                  type: 'delete-section',
                  sectionId: section.id,
                  title: section.title,
                })
              }
              onOptimize={(itemId) => aiOptimizeMutation.mutate({ sectionId: section.id, itemId })}
              onSuggest={() => aiSuggestMutation.mutate(section.type)}
              optimizing={aiOptimizeMutation.isPending}
              suggesting={aiSuggestMutation.isPending}
            />
          )}
        />

        <Button
          variant="outline"
          className="h-11 w-full border-dashed"
          onClick={() => setAddSectionOpen(true)}
          disabled={availableSectionTypes.length === 0}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('workbench.actions.addSection')}
        </Button>
      </div>
    </ScrollArea>
  );

  const rightPanel = (
    <Tabs defaultValue="preview" className="h-full gap-0">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <TabsList className="w-auto">
          <TabsTrigger value="preview">
            <Eye className="h-4 w-4" />
            {t('workbench.tabs.preview')}
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles className="h-4 w-4" />
            AI
          </TabsTrigger>
          <TabsTrigger value="style">
            <Palette className="h-4 w-4" />
            {t('workbench.tabs.style')}
          </TabsTrigger>
        </TabsList>
        <Button variant="outline" size="sm" onClick={handleExportPdf}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {t('workbench.actions.export')}
        </Button>
      </div>

      <TabsContent value="preview" className="min-h-0">
        <ResumePreview
          sections={visibleSections}
          templateId={resume.templateId}
          settings={resume.settings}
        />
      </TabsContent>

      <TabsContent value="ai" className="min-h-0">
        <ScrollArea className="h-full">
          <AiAssistantPanel
            review={latestReview}
            reviewPending={aiReviewMutation.isPending}
            onRunReview={() => aiReviewMutation.mutate()}
            onOpenReview={() => setReviewOpen(true)}
            sections={resumeSections}
            onSuggest={(sectionType) => aiSuggestMutation.mutate(sectionType)}
            suggesting={aiSuggestMutation.isPending}
          />
        </ScrollArea>
      </TabsContent>

      <TabsContent value="style" className="min-h-0">
        <ScrollArea className="h-full">
          <TemplatePicker
            currentTemplateId={resume.templateId}
            resumeType={resume.type}
            onSelect={(templateId) => updateResumeDraft({ templateId })}
            trigger={
              <Button variant="outline" size="sm" className="mx-3 mt-3 w-[calc(100%-1.5rem)]">
                <LayoutTemplate className="mr-2 h-4 w-4" />
                {t('workbench.actions.changeTemplate')}
              </Button>
            }
          />
          <CustomizePanel
            settings={resume.settings ?? EMPTY_SETTINGS}
            templateId={resume.templateId}
            onChange={(settings) => updateResumeDraft({ settings }, true)}
            onReset={() => updateResumeDraft({ settings: EMPTY_SETTINGS })}
          />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-background">
      <header className="flex flex-col gap-3 border-b px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/resume">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label={t('workbench.actions.back')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <TypeIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            {editingTitle ? (
              <Input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={() => {
                  setEditingTitle(false);
                  const title = titleDraft.trim();
                  if (title && title !== resume.title) updateResumeDraft({ title });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                }}
                className="h-8 max-w-[280px] text-base font-semibold"
                autoFocus
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTitleDraft(resume.title);
                  setEditingTitle(true);
                }}
                className="block max-w-[360px] truncate text-left text-base font-semibold hover:text-primary"
              >
                {resume.title || t('workbench.summary.untitledResume')}
              </button>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary">{t(meta.labelKey)}</Badge>
              <Badge variant="outline">{t(STATUS_LABEL_KEYS[resume.status])}</Badge>
              <span className="text-xs text-muted-foreground">
                {pendingResumeSave || pendingSectionIds.size > 0
                  ? t('workbench.summary.saving')
                  : t('workbench.summary.saved')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmState({ type: 'import-profile' })}
            disabled={importProfileMutation.isPending}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {t('workbench.actions.importProfile')}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => aiReviewMutation.mutate()}
            disabled={aiReviewMutation.isPending}
          >
            {aiReviewMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t('workbench.actions.aiReview')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label={t('workbench.actions.more')}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={() => snapshotMutation.mutate('Manual checkpoint')}>
                <Save className="mr-2 h-4 w-4" />
                {t('workbench.actions.saveVersion')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicateMutation.mutate()}>
                <Copy className="mr-2 h-4 w-4" />
                {t('workbench.actions.duplicate')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  updateResumeDraft({ status: resume.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE' })
                }
              >
                <BadgeCheck className="mr-2 h-4 w-4" />
                {resume.status === 'ACTIVE'
                  ? t('workbench.actions.markDraft')
                  : t('workbench.actions.markActive')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2 text-xs">
                <History className="h-3.5 w-3.5" />
                {t('workbench.actions.versionHistory')}
              </DropdownMenuLabel>
              {(snapshots ?? []).slice(0, 5).map((snapshot) => (
                <DropdownMenuItem
                  key={snapshot.id}
                  onClick={() =>
                    setConfirmState({
                      type: 'restore-snapshot',
                      snapshotId: snapshot.id,
                      version: snapshot.version,
                    })
                  }
                >
                  <RotateCcw className="mr-2 h-4 w-4" />v{snapshot.version} ·{' '}
                  {new Date(snapshot.createdAt).toLocaleDateString()}
                </DropdownMenuItem>
              ))}
              {(!snapshots || snapshots.length === 0) && (
                <DropdownMenuItem disabled>{t('workbench.actions.noSnapshots')}</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="hidden min-h-0 flex-1 lg:grid lg:grid-cols-[260px_minmax(0,1fr)_minmax(380px,42vw)]">
        <aside className="border-r bg-muted/20">
          <WorkbenchSidebar
            sections={resumeSections}
            completion={completion}
            onSelect={(id) =>
              document.getElementById(`section-${id}`)?.scrollIntoView({ block: 'start' })
            }
          />
        </aside>
        <main className="min-h-0 border-r">{editorColumn}</main>
        <aside className="min-h-0 bg-muted/20">{rightPanel}</aside>
      </div>

      <Tabs defaultValue="edit" className="min-h-0 flex-1 gap-0 lg:hidden">
        <TabsList className="mx-3 mt-3 grid w-[calc(100%-1.5rem)] grid-cols-4">
          <TabsTrigger value="edit">{t('workbench.tabs.edit')}</TabsTrigger>
          <TabsTrigger value="preview">{t('workbench.tabs.preview')}</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="style">{t('workbench.tabs.style')}</TabsTrigger>
        </TabsList>
        <TabsContent value="edit" className="min-h-0">
          {editorColumn}
        </TabsContent>
        <TabsContent value="preview" className="min-h-0">
          <ResumePreview
            sections={visibleSections}
            templateId={resume.templateId}
            settings={resume.settings}
          />
        </TabsContent>
        <TabsContent value="ai" className="min-h-0">
          <ScrollArea className="h-full">
            <AiAssistantPanel
              review={latestReview}
              reviewPending={aiReviewMutation.isPending}
              onRunReview={() => aiReviewMutation.mutate()}
              onOpenReview={() => setReviewOpen(true)}
              sections={resumeSections}
              onSuggest={(sectionType) => aiSuggestMutation.mutate(sectionType)}
              suggesting={aiSuggestMutation.isPending}
            />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="style" className="min-h-0">
          <ScrollArea className="h-full">
            <TemplatePicker
              currentTemplateId={resume.templateId}
              resumeType={resume.type}
              onSelect={(templateId) => updateResumeDraft({ templateId })}
              trigger={
                <Button variant="outline" size="sm" className="mx-3 mt-3 w-[calc(100%-1.5rem)]">
                  <LayoutTemplate className="mr-2 h-4 w-4" />
                  {t('workbench.actions.changeTemplate')}
                </Button>
              }
            />
            <CustomizePanel
              settings={resume.settings ?? EMPTY_SETTINGS}
              templateId={resume.templateId}
              onChange={(settings) => updateResumeDraft({ settings }, true)}
              onReset={() => updateResumeDraft({ settings: EMPTY_SETTINGS })}
            />
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('workbench.dialogs.addSection')}</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-80 gap-2 overflow-y-auto py-2">
            {availableSectionTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() =>
                  addSectionMutation.mutate({ type, title: getSectionTypeLabel(t, type) })
                }
                className="flex items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{getSectionTypeLabel(t, type)}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        result={latestReviewResult}
        sections={visibleSections}
        reviewedAt={latestReview?.createdAt ?? null}
        isRerunning={aiReviewMutation.isPending}
        onRerun={() => aiReviewMutation.mutate()}
        onSectionContentChange={(sectionId, content) => updateSectionNow(sectionId, { content })}
      />

      <BulletOptimizeDialog
        state={optimizeState}
        onOpenChange={(open) => !open && setOptimizeState(null)}
        onApply={(includeNewSuggestions) => {
          if (!optimizeState) return;
          const section = resumeSections.find((item) => item.id === optimizeState.sectionId);
          if (!section) return;
          updateSectionNow(section.id, {
            content: replaceOptimizedBullets(
              section.content,
              optimizeState.result,
              includeNewSuggestions
            ),
          });
          setOptimizeState(null);
          toast.success(t('workbench.toasts.aiSuggestionApplied'));
        }}
      />

      <ContentSuggestionDialog
        state={suggestionState}
        canApplyExamples={Boolean(
          suggestionState?.result.exampleBullets?.length &&
          ((
            resumeSections.find((section) => section.type === suggestionState.sectionType)?.content
              .items as unknown[] | undefined
          )?.length ?? 0) > 0
        )}
        onOpenChange={(open) => !open && setSuggestionState(null)}
        onApplyExamples={() => {
          if (!suggestionState?.result.exampleBullets?.length) return;
          const section = resumeSections.find((item) => item.type === suggestionState.sectionType);
          if (!section) return;
          updateSectionNow(section.id, {
            content: appendExampleBullets(section.content, suggestionState.result.exampleBullets),
          });
          setSuggestionState(null);
          toast.success(t('workbench.toasts.exampleBulletsAdded'));
        }}
      />

      <ConfirmActionDialog
        state={confirmState}
        loading={
          deleteSectionMutation.isPending ||
          importProfileMutation.isPending ||
          restoreSnapshotMutation.isPending
        }
        onCancel={() => setConfirmState(null)}
        onConfirm={confirmAction}
      />
    </div>
  );
}

function WorkbenchSidebar({
  sections,
  completion,
  onSelect,
}: {
  sections: ResumeSection[];
  completion: number;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('resume');

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-3 border-b p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t('workbench.sidebar.completion')}</span>
          <span className="text-sm font-semibold">{completion}%</span>
        </div>
        <Progress value={completion} className="h-2" />
        <p className="text-xs text-muted-foreground">{t('workbench.sidebar.hint')}</p>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <nav className="space-y-1 p-2">
          {sections.map((section) => {
            const complete = sectionCompletion(section) >= 0.8;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSelect(section.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
              >
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    complete ? 'bg-emerald-500' : 'bg-muted-foreground/35'
                  )}
                />
                <span className="min-w-0 flex-1 truncate">
                  {getSectionTypeLabel(t, section.type, section.title)}
                </span>
                {!section.isVisible && <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}

function TargetContextPanel({
  type,
  value,
  pending,
  onChange,
  onSave,
}: {
  type: ResumeType;
  value: ResumeTargetContext;
  pending: boolean;
  onChange: (value: ResumeTargetContext) => void;
  onSave: () => void;
}) {
  const t = useTranslations('resume');
  const meta = TYPE_META[type];

  const update = (field: keyof ResumeTargetContext, nextValue: string) => {
    onChange({ ...value, [field]: nextValue });
  };

  return (
    <section className="rounded-md border bg-card p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">{t(meta.contextTitleKey)}</h2>
            <p className="text-xs text-muted-foreground">{t('workbench.target.hint')}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onSave} disabled={pending}>
          {pending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          {t('workbench.actions.saveTarget')}
        </Button>
      </div>

      {type === 'COLLEGE_APPLICATION' && (
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label={t('workbench.target.targetSchool')}>
            <Input
              value={value.targetSchool ?? ''}
              onChange={(event) => update('targetSchool', event.target.value)}
            />
          </Field>
          <Field label={t('workbench.target.targetMajor')}>
            <Input
              value={value.targetMajor ?? ''}
              onChange={(event) => update('targetMajor', event.target.value)}
            />
          </Field>
          <Field label={t('workbench.target.applicationRound')}>
            <Input
              value={value.applicationRound ?? ''}
              onChange={(event) => update('applicationRound', event.target.value)}
              placeholder={t('workbench.target.applicationRoundPlaceholder')}
            />
          </Field>
        </div>
      )}

      {type === 'INTERNSHIP' && (
        <div className="grid gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={t('workbench.target.targetRole')}>
              <Input
                value={value.targetRole ?? ''}
                onChange={(event) => update('targetRole', event.target.value)}
              />
            </Field>
            <Field label={t('workbench.target.companyIndustry')}>
              <Input
                value={value.company ?? ''}
                onChange={(event) => update('company', event.target.value)}
              />
            </Field>
          </div>
          <Field label={t('workbench.target.jobRequirements')}>
            <Textarea
              value={value.jobDescription ?? ''}
              onChange={(event) => update('jobDescription', event.target.value)}
              className="min-h-24 text-sm"
              placeholder={t('workbench.target.jobDescriptionPlaceholder')}
            />
          </Field>
        </div>
      )}

      {type === 'GRADUATE_CV' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label={t('workbench.target.programSchool')}>
            <Input
              value={value.programName ?? value.targetSchool ?? ''}
              onChange={(event) => update('programName', event.target.value)}
            />
          </Field>
          <Field label={t('workbench.target.researchArea')}>
            <Input
              value={value.researchArea ?? ''}
              onChange={(event) => update('researchArea', event.target.value)}
            />
          </Field>
          <Field label={t('workbench.target.advisor')}>
            <Input
              value={value.advisorName ?? ''}
              onChange={(event) => update('advisorName', event.target.value)}
            />
          </Field>
          <Field label={t('workbench.target.lab')}>
            <Input
              value={value.labName ?? ''}
              onChange={(event) => update('labName', event.target.value)}
            />
          </Field>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function WorkbenchSectionCard({
  section,
  index,
  dragHandleProps,
  isSaving,
  onToggleVisibility,
  onTitleChange,
  onContentChange,
  onDelete,
  onOptimize,
  onSuggest,
  optimizing,
  suggesting,
}: {
  section: ResumeSection;
  index: number;
  dragHandleProps: DragHandleProps;
  isSaving: boolean;
  onToggleVisibility: () => void;
  onTitleChange: (title: string) => void;
  onContentChange: (content: Record<string, unknown>) => void;
  onDelete: () => void;
  onOptimize: (itemId?: string) => void;
  onSuggest: () => void;
  optimizing: boolean;
  suggesting: boolean;
}) {
  const t = useTranslations('resume');
  const [expanded, setExpanded] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.title);
  const summaries = getContentSummary(section, t);
  const canOptimize = summaries.some((item) => item.id);

  useEffect(() => {
    setTitleDraft(section.title);
  }, [section.title]);

  return (
    <Card
      id={`section-${section.id}`}
      className={cn('scroll-mt-4', !section.isVisible && 'opacity-65')}
    >
      <CardHeader className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <DragHandle {...dragHandleProps} className="mt-0.5 shrink-0" />
            <button
              type="button"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
            >
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', !expanded && '-rotate-90')}
              />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                {editingTitle ? (
                  <Input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onBlur={() => {
                      setEditingTitle(false);
                      if (titleDraft.trim() && titleDraft !== section.title) {
                        onTitleChange(titleDraft.trim());
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                    className="h-7 w-52 text-sm font-medium"
                    autoFocus
                  />
                ) : (
                  <CardTitle
                    className="cursor-pointer truncate text-sm hover:text-primary"
                    onClick={() => setEditingTitle(true)}
                  >
                    {getSectionTypeLabel(t, section.type, section.title)}
                  </CardTitle>
                )}
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                {!section.isVisible && (
                  <Badge variant="outline">{t('workbench.section.hidden')}</Badge>
                )}
              </div>
              {summaries.length > 0 && (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {summaries
                    .slice(0, 2)
                    .map((item) => item.primary)
                    .join(' · ')}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleVisibility}>
              {section.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4 px-4 pb-4 pt-0">
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOptimize(summaries.find((item) => item.id)?.id)}
              disabled={!canOptimize || optimizing}
            >
              {optimizing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t('workbench.actions.optimizeBullets')}
            </Button>
            <Button variant="outline" size="sm" onClick={onSuggest} disabled={suggesting}>
              {suggesting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t('workbench.actions.contentSuggestions')}
            </Button>
            <p className="text-xs text-muted-foreground">{t('workbench.section.aiHint')}</p>
          </div>
          <SectionEditor section={section as never} onChange={onContentChange} />
        </CardContent>
      )}
    </Card>
  );
}

function AiAssistantPanel({
  review,
  reviewPending,
  onRunReview,
  onOpenReview,
  sections,
  onSuggest,
  suggesting,
}: {
  review?: ReviewRecord | null;
  reviewPending: boolean;
  onRunReview: () => void;
  onOpenReview: () => void;
  sections: ResumeSection[];
  onSuggest: (sectionType: string) => void;
  suggesting: boolean;
}) {
  const t = useTranslations('resume');
  const output = review?.output as ResumeReviewResult | undefined;
  const gaps = 'contentGaps' in (output ?? {}) ? (output?.contentGaps ?? []) : [];

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-md border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t('workbench.ai.title')}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t('workbench.ai.description')}</p>
          </div>
          <Button size="sm" onClick={onRunReview} disabled={reviewPending}>
            {reviewPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t('workbench.actions.runReview')}
          </Button>
        </div>
        {review ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <Metric
              label={t('workbench.ai.overallScore')}
              value={String(review.overallScore ?? '—')}
            />
            <Metric label={t('workbench.ai.contentGaps')} value={String(gaps.length)} />
            <Metric
              label={t('workbench.ai.reviewedAt')}
              value={new Date(review.createdAt).toLocaleDateString()}
            />
          </div>
        ) : (
          <p className="mt-4 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            {t('workbench.ai.noReview')}
          </p>
        )}
        {review && (
          <Button variant="outline" className="mt-3 w-full" onClick={onOpenReview}>
            {t('workbench.actions.openReview')}
          </Button>
        )}
      </section>

      <section className="rounded-md border bg-card p-4">
        <h3 className="text-sm font-semibold">{t('workbench.ai.fillBySection')}</h3>
        <div className="mt-3 space-y-2">
          {sections.map((section) => (
            <button
              type="button"
              key={section.id}
              onClick={() => onSuggest(section.type)}
              disabled={suggesting}
              className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-60"
            >
              <span>{getSectionTypeLabel(t, section.type, section.title)}</span>
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function BulletOptimizeDialog({
  state,
  onOpenChange,
  onApply,
}: {
  state: { sectionId: string; result: BulletOptimizeResult } | null;
  onOpenChange: (open: boolean) => void;
  onApply: (includeNewSuggestions: boolean) => void;
}) {
  const t = useTranslations('resume');

  return (
    <Dialog open={Boolean(state)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('workbench.dialogs.bulletOptimizeTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {state?.result.optimized.map((item, index) => (
            <div key={index} className="space-y-2 rounded-md border p-3">
              <p className="rounded bg-red-50 p-2 text-xs text-red-700 line-through dark:bg-red-950/20 dark:text-red-300">
                {item.original}
              </p>
              <p className="rounded bg-green-50 p-2 text-xs text-green-700 dark:bg-green-950/20 dark:text-green-300">
                {item.improved}
              </p>
              <p className="text-xs text-muted-foreground">{item.reason}</p>
            </div>
          ))}
          {state?.result.newSuggestions?.length ? (
            <div className="rounded-md border p-3">
              <p className="text-sm font-medium">{t('workbench.dialogs.newBullets')}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {state.result.newSuggestions.map((item, index) => (
                  <li key={index}>• {item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('workbench.actions.cancel')}
          </Button>
          <Button variant="outline" onClick={() => onApply(false)}>
            {t('workbench.actions.applyRewriteOnly')}
          </Button>
          <Button onClick={() => onApply(true)}>
            {t('workbench.actions.applyRewriteAndSuggestions')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContentSuggestionDialog({
  state,
  canApplyExamples,
  onOpenChange,
  onApplyExamples,
}: {
  state: { sectionType: string; result: ContentSuggestionResult } | null;
  canApplyExamples: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyExamples: () => void;
}) {
  const t = useTranslations('resume');

  return (
    <Dialog open={Boolean(state)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('workbench.dialogs.contentSuggestionTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            {state?.result.suggestions.map((item, index) => (
              <div key={index} className="rounded-md border p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="secondary">{item.category}</Badge>
                  <Badge variant="outline">{item.priority}</Badge>
                </div>
                <p className="text-sm">{item.text}</p>
              </div>
            ))}
          </div>
          {state?.result.tips.length ? (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-medium">{t('workbench.dialogs.writingTips')}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {state.result.tips.map((tip, index) => (
                  <li key={index}>• {tip}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {state?.result.exampleBullets?.length ? (
            <div className="rounded-md border p-3">
              <p className="text-sm font-medium">{t('workbench.dialogs.exampleBullets')}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {state.result.exampleBullets.map((bullet, index) => (
                  <li key={index}>• {bullet}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('workbench.actions.close')}
          </Button>
          <Button onClick={onApplyExamples} disabled={!canApplyExamples}>
            {t('workbench.actions.addExampleBullets')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmActionDialog({
  state,
  loading,
  onCancel,
  onConfirm,
}: {
  state: ConfirmState;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations('resume');
  let title = '';
  let description = '';
  let confirmLabel = t('workbench.actions.confirm');
  if (state?.type === 'delete-section') {
    title = t('workbench.dialogs.confirmDeleteTitle', { title: state.title });
    description = t('workbench.dialogs.confirmDeleteDescription');
    confirmLabel = t('workbench.actions.delete');
  } else if (state?.type === 'import-profile') {
    title = t('workbench.dialogs.confirmImportTitle');
    description = t('workbench.dialogs.confirmImportDescription');
    confirmLabel = t('workbench.actions.import');
  } else if (state?.type === 'restore-snapshot') {
    title = t('workbench.dialogs.confirmRestoreTitle', { version: state.version });
    description = t('workbench.dialogs.confirmRestoreDescription');
    confirmLabel = t('workbench.actions.restore');
  }

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {t('workbench.actions.cancel')}
          </Button>
          <Button
            variant={state?.type === 'delete-section' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
