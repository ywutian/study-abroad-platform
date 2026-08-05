'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  GraduationCap,
  History,
  LayoutTemplate,
  Library,
  Loader2,
  ListChecks,
  MessageSquare,
  MoreVertical,
  Palette,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Lightbulb,
  Target,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { Link, useRouter } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { useAuthReady } from '@/hooks/use-auth-gated-query';
import { cn } from '@/lib/utils';
import { AI_TIMEOUTS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
  type ResumeAIIssue,
  type ResumeComment,
  type ResumeEvidence,
  type ResumeExport,
  type ResumeImportPreview,
  type ResumeQualitySummary,
  type ResumeReviewResult,
  type ResumeReviewResultV1,
  type ResumeSettings,
  type ResumeTarget,
  type ResumeTargetContext,
  type ResumeUploadImportPreview,
} from '@study-abroad/shared';

// Types, label maps and pure helpers — see ./_lib/resume-editor.ts
import {
  ResumeType,
  ResumeStatus,
  ResumeFamily,
  ResumeVariantKind,
  ResumeSection,
  Resume,
  ReviewRecord,
  SnapshotRecord,
  ConfirmState,
  SECTION_TYPE_LABEL_KEYS,
  ALL_SECTION_TYPES,
  TYPE_META,
  STATUS_LABEL_KEYS,
  EMPTY_SETTINGS,
  ResumeTranslator,
  getSectionTypeLabel,
  sanitizeContext,
  hasMeaningfulValue,
  sectionCompletion,
  getContentSummary,
  replaceOptimizedBullets,
  appendExampleBullets,
  toggleSetValue,
} from './_lib/resume-editor';

export default function ResumeEditPage() {
  const t = useTranslations('resume');
  const params = useParams();
  const resumeId = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const authReady = useAuthReady();
  const sectionSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const resumeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [targetDraft, setTargetDraft] = useState<ResumeTargetContext>({});
  const [pendingSectionIds, setPendingSectionIds] = useState<Set<string>>(new Set());
  const [pendingResumeSave, setPendingResumeSave] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [profileImportSectionIds, setProfileImportSectionIds] = useState<Set<string>>(new Set());
  const [uploadImportOpen, setUploadImportOpen] = useState(false);
  const [uploadImportPreview, setUploadImportPreview] = useState<ResumeUploadImportPreview | null>(
    null
  );
  const [uploadSectionIndexes, setUploadSectionIndexes] = useState<Set<number>>(new Set());
  const [uploadEvidenceIndexes, setUploadEvidenceIndexes] = useState<Set<number>>(new Set());
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);
  const [evidenceDraft, setEvidenceDraft] = useState({
    kind: 'CUSTOM',
    title: '',
    description: '',
  });
  const [commentDraft, setCommentDraft] = useState('');
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
    enabled: authReady,
  });

  const { data: latestReview } = useQuery({
    queryKey: ['resume', resumeId, 'aiReview', 'latest'],
    queryFn: () => apiClient.get<ReviewRecord | null>(resumeRoutes.aiReviewLatest(resumeId)),
    enabled: Boolean(resumeId),
  });

  const { data: aiIssues } = useQuery({
    queryKey: ['resume', resumeId, 'aiIssues'],
    queryFn: () => apiClient.get<ResumeAIIssue[]>(resumeRoutes.aiIssues(resumeId)),
    enabled: Boolean(resumeId),
  });

  const { data: comments } = useQuery({
    queryKey: ['resume', resumeId, 'comments'],
    queryFn: () => apiClient.get<ResumeComment[]>(resumeRoutes.comments(resumeId)),
    enabled: Boolean(resumeId),
  });

  const { data: snapshots } = useQuery({
    queryKey: ['resume', resumeId, 'snapshots'],
    queryFn: () => apiClient.get<SnapshotRecord[]>(resumeRoutes.snapshots(resumeId)),
    enabled: Boolean(resumeId),
  });

  const { data: quality } = useQuery({
    queryKey: ['resume', resumeId, 'quality'],
    queryFn: () => apiClient.get<ResumeQualitySummary>(resumeRoutes.quality(resumeId)),
    enabled: Boolean(resumeId),
  });

  const { data: targets } = useQuery({
    queryKey: ['resume', 'targets'],
    queryFn: () => apiClient.get<ResumeTarget[]>(resumeRoutes.targets()),
    enabled: Boolean(resumeId),
  });

  const { data: evidence } = useQuery({
    queryKey: ['resume', 'evidence'],
    queryFn: () => apiClient.get<ResumeEvidence[]>(resumeRoutes.evidence()),
    enabled: Boolean(resumeId),
  });

  const { data: exports } = useQuery({
    queryKey: ['resume', resumeId, 'exports'],
    queryFn: () => apiClient.get<ResumeExport[]>(resumeRoutes.exports(resumeId)),
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
    if (uploadImportPreview) {
      setUploadSectionIndexes(new Set(uploadImportPreview.sections.map((_, index) => index)));
      setUploadEvidenceIndexes(new Set(uploadImportPreview.evidence.map((_, index) => index)));
    }
  }, [uploadImportPreview]);

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
      dto: Partial<
        Pick<Resume, 'title' | 'status' | 'templateId' | 'settings' | 'targetContext' | 'targetId'>
      >
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
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId, 'quality'] });
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

  const importProfilePreviewMutation = useMutation({
    // @cache-invalidation-allowed: preview-only — writes the importable section ids to local state (setProfileImportSectionIds); the apply step (importProfileMutation) does setQueryData + invalidate
    mutationFn: () =>
      apiClient.post<ResumeImportPreview>(resumeRoutes.importProfilePreview(resumeId)),
    onSuccess: (preview) => {
      setProfileImportSectionIds(new Set(preview.sections.map((section) => section.sectionId)));
    },
    onError: () => toast.error(t('workbench.toasts.importPreviewFailed')),
  });

  const importProfileMutation = useMutation({
    mutationFn: () =>
      apiClient.post<Resume>(resumeRoutes.importProfileApply(resumeId), {
        sectionIds: Array.from(profileImportSectionIds),
        snapshotDescription: 'Before profile import',
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['resume', resumeId], data);
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId, 'snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId, 'quality'] });
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
      // @cache-invalidation-allowed: directly writes the restored resume into the ['resume', resumeId] cache via queryClient.setQueryData instead of invalidating
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
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId, 'quality'] });
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId, 'aiIssues'] });
      setReviewOpen(true);
      toast.success(t('workbench.toasts.aiReviewComplete'));
    },
    onError: () => toast.error(t('workbench.toasts.aiReviewFailed')),
  });

  const createExportMutation = useMutation({
    mutationFn: (dto: {
      format: 'PDF';
      templateId: string;
      pageSize?: string;
      pageCount?: number;
      textExtractable: boolean;
      metadata?: Record<string, unknown>;
    }) => apiClient.post<ResumeExport>(resumeRoutes.exports(resumeId), dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId, 'exports'] });
    },
    onError: () => toast.error(t('workbench.toasts.exportRecordFailed')),
  });

  const applyAiIssueMutation = useMutation({
    mutationFn: (issue: ResumeAIIssue) =>
      apiClient.post<Resume>(resumeRoutes.aiIssueApply(resumeId, issue.id), {
        expectedContentHash: issue.baseContentHash ?? undefined,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['resume', resumeId], data);
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId, 'aiIssues'] });
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId, 'quality'] });
      toast.success(t('workbench.toasts.aiIssueApplied'));
    },
    onError: () => toast.error(t('workbench.toasts.aiIssueApplyFailed')),
  });

  const uploadImportPreviewMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiClient.upload<ResumeUploadImportPreview>(
        resumeRoutes.importFilePreview(resumeId),
        formData
      );
    },
    onSuccess: (preview) => {
      setUploadImportPreview(preview);
      setUploadImportOpen(true);
    },
    onError: () => toast.error(t('workbench.toasts.uploadImportFailed')),
  });

  const applyUploadImportMutation = useMutation({
    mutationFn: () => {
      const preview = uploadImportPreview;
      if (!preview) throw new Error('No upload preview');
      return apiClient.post<Resume>(resumeRoutes.importFileApply(resumeId), {
        sections: preview.sections
          .filter((_, index) => uploadSectionIndexes.has(index))
          .map((section) => ({
            sectionId: section.sectionId,
            sectionType: section.sectionType,
            title: section.title,
            content: section.proposedContent,
            isVisible: true,
          })),
        evidence: preview.evidence.filter((_, index) => uploadEvidenceIndexes.has(index)),
        snapshotDescription: 'Before uploaded resume import',
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['resume', resumeId], data);
      queryClient.invalidateQueries({ queryKey: ['resume', 'evidence'] });
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId, 'snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId, 'quality'] });
      setUploadImportOpen(false);
      setUploadImportPreview(null);
      toast.success(t('workbench.toasts.uploadImported'));
    },
    onError: () => toast.error(t('workbench.toasts.uploadImportApplyFailed')),
  });

  const createTargetMutation = useMutation({
    mutationFn: () => {
      if (!resume) throw new Error('No resume loaded');
      const context = sanitizeContext(targetDraft);
      const career = resume.type === 'INTERNSHIP' || resume.type === 'FULL_TIME_JOB';
      const type =
        resume.type === 'GRADUATE_CV'
          ? 'GRADUATE_PROGRAM'
          : resume.type === 'FULL_TIME_JOB'
            ? 'FULL_TIME_JOB'
            : resume.type === 'INTERNSHIP'
              ? 'INTERNSHIP'
              : 'COLLEGE_APPLICATION';
      const title =
        (career
          ? [context.company, context.targetRole].filter(Boolean).join(' · ')
          : [
              context.targetSchool ?? context.programName,
              context.targetMajor ?? context.researchArea,
            ]
              .filter(Boolean)
              .join(' · ')) || resume.title;
      return apiClient.post<ResumeTarget>(resumeRoutes.targets(), {
        type,
        title,
        status: 'ACTIVE',
        school: context.targetSchool,
        program: context.programName,
        major: context.targetMajor,
        applicationRound: context.applicationRound,
        advisorName: context.advisorName,
        researchArea: context.researchArea,
        labName: context.labName,
        company: context.company,
        role: context.targetRole,
        jobDescription: context.jobDescription,
        keywords: context.keywords ?? [],
      });
    },
    onSuccess: (target) => {
      queryClient.invalidateQueries({ queryKey: ['resume', 'targets'] });
      updateResumeDraft({ targetId: target.id, targetContext: sanitizeContext(targetDraft) });
      toast.success(t('workbench.toasts.targetCreated'));
    },
    onError: () => toast.error(t('workbench.toasts.targetCreateFailed')),
  });

  const tailorMutation = useMutation({
    mutationFn: (target?: ResumeTarget) =>
      apiClient.post<Resume>(resumeRoutes.tailor(resumeId), {
        targetId: target?.id,
        title: target ? `${resume?.title ?? t('untitled')} · ${target.title}` : undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      router.push(`/resume/${data.id}`);
      toast.success(t('workbench.toasts.tailoredCreated'));
    },
    onError: () => toast.error(t('workbench.toasts.tailorFailed')),
  });

  const createEvidenceMutation = useMutation({
    mutationFn: () =>
      apiClient.post<ResumeEvidence>(resumeRoutes.evidence(), {
        kind: evidenceDraft.kind,
        title: evidenceDraft.title,
        description: evidenceDraft.description,
        content: { resumeId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', 'evidence'] });
      setEvidenceDialogOpen(false);
      setEvidenceDraft({ kind: 'CUSTOM', title: '', description: '' });
      toast.success(t('workbench.toasts.evidenceCreated'));
    },
    onError: () => toast.error(t('workbench.toasts.evidenceCreateFailed')),
  });

  const createCommentMutation = useMutation({
    mutationFn: () =>
      apiClient.post<ResumeComment>(resumeRoutes.comments(resumeId), {
        body: commentDraft.trim(),
      }),
    onSuccess: () => {
      setCommentDraft('');
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId, 'comments'] });
      toast.success(t('workbench.toasts.commentAdded'));
    },
    onError: () => toast.error(t('workbench.toasts.commentFailed')),
  });

  const resolveCommentMutation = useMutation({
    mutationFn: (commentId: string) =>
      apiClient.put<ResumeComment>(resumeRoutes.comment(resumeId, commentId), {
        status: 'RESOLVED',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId, 'comments'] });
    },
  });

  const aiOptimizeMutation = useMutation({
    // @cache-invalidation-allowed: AI optimize — writes the suggested result to local state (setOptimizeState) for preview; applied later via a separate mutation, no cached list/detail changes here
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
    // @cache-invalidation-allowed: AI suggest — writes the suggested content to local state (setSuggestionState) for preview; applied later via a separate mutation, no cached list/detail changes here
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
      createExportMutation.mutate({
        format: 'PDF',
        templateId: resume.templateId,
        pageSize: resume.settings?.decorations?.pageSize ?? 'LETTER',
        textExtractable: true,
        metadata: {
          source: 'client_pdf_export',
          visibleSectionCount: visibleSections.length,
        },
      });
      toast.success(t('workbench.toasts.exportedPdf'), { id: 'resume-export' });
    } catch {
      toast.error(t('workbench.toasts.exportFailed'), { id: 'resume-export' });
    }
  }, [createExportMutation, resume, t]);

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
        <div className="grid min-w-0 flex-1 gap-4 p-4 lg:grid-cols-[250px_minmax(0,1fr)_minmax(360px,42vw)]">
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
          onCreateTarget={() => createTargetMutation.mutate()}
          creatingTarget={createTargetMutation.isPending}
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
          <TabsTrigger value="match">
            <ListChecks className="h-4 w-4" />
            {t('workbench.tabs.match')}
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Lightbulb className="h-4 w-4" />
            AI
          </TabsTrigger>
          <TabsTrigger value="export">
            <FileCheck2 className="h-4 w-4" />
            {t('workbench.tabs.exportCheck')}
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

      <TabsContent value="match" className="min-h-0">
        <ScrollArea className="h-full">
          <TargetMatchPanel
            resume={resume}
            quality={quality}
            targets={targets ?? []}
            evidence={evidence ?? []}
            onTailor={(target) => tailorMutation.mutate(target)}
            tailoring={tailorMutation.isPending}
            onAddEvidence={() => setEvidenceDialogOpen(true)}
          />
        </ScrollArea>
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
            issues={aiIssues ?? []}
            applyingIssueId={
              applyAiIssueMutation.isPending ? applyAiIssueMutation.variables?.id : undefined
            }
            onApplyIssue={(issue) => applyAiIssueMutation.mutate(issue)}
            comments={comments ?? []}
            commentDraft={commentDraft}
            onCommentDraftChange={setCommentDraft}
            onAddComment={() => createCommentMutation.mutate()}
            addingComment={createCommentMutation.isPending}
            resolvingCommentId={resolveCommentMutation.variables}
            onResolveComment={(commentId) => resolveCommentMutation.mutate(commentId)}
          />
        </ScrollArea>
      </TabsContent>

      <TabsContent value="export" className="min-h-0">
        <ScrollArea className="h-full">
          <ExportReadinessPanel
            resume={resume}
            quality={quality}
            exports={exports ?? []}
            onRecord={() =>
              createExportMutation.mutate({
                format: 'PDF',
                templateId: resume.templateId,
                pageSize: resume.settings?.decorations?.pageSize ?? 'LETTER',
                textExtractable: true,
                metadata: { source: 'manual_export_check' },
              })
            }
            recording={createExportMutation.isPending}
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
              className="h-10 w-10 sm:h-9 sm:w-9"
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
                className="block min-h-10 max-w-[360px] truncate py-2 text-left text-base font-semibold hover:text-primary sm:min-h-8 sm:py-1"
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
          <input
            ref={uploadInputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) uploadImportPreviewMutation.mutate(file);
              event.currentTarget.value = '';
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setConfirmState({ type: 'import-profile' });
              importProfilePreviewMutation.mutate();
            }}
            disabled={importProfileMutation.isPending || importProfilePreviewMutation.isPending}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {t('workbench.actions.importProfile')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => uploadInputRef.current?.click()}
            disabled={uploadImportPreviewMutation.isPending}
          >
            {uploadImportPreviewMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t('workbench.actions.uploadResume')}
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
              <Lightbulb className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t('workbench.actions.aiReview')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 sm:h-9 sm:w-9"
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
              {(['REVIEWED', 'APPROVED', 'EXPORTED'] as ResumeStatus[]).map((status) => (
                <DropdownMenuItem key={status} onClick={() => updateResumeDraft({ status })}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {t('workbench.actions.setStatus', { status: t(STATUS_LABEL_KEYS[status]) })}
                </DropdownMenuItem>
              ))}
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

      <div className="hidden min-h-0 min-w-0 flex-1 lg:grid lg:grid-cols-[260px_minmax(0,1fr)_minmax(380px,42vw)]">
        <aside className="border-r bg-muted/20">
          <WorkbenchSidebar
            sections={resumeSections}
            completion={completion}
            quality={quality}
            targets={targets ?? []}
            evidence={evidence ?? []}
            onSelect={(id) =>
              document.getElementById(`section-${id}`)?.scrollIntoView({ block: 'start' })
            }
          />
        </aside>
        <main className="min-h-0 border-r">{editorColumn}</main>
        <aside className="min-h-0 bg-muted/20">{rightPanel}</aside>
      </div>

      <Tabs defaultValue="edit" className="min-h-0 flex-1 gap-0 lg:hidden">
        <TabsList className="mx-3 mt-3 grid w-[calc(100%-1.5rem)] grid-cols-5">
          <TabsTrigger value="edit">{t('workbench.tabs.edit')}</TabsTrigger>
          <TabsTrigger value="preview">{t('workbench.tabs.preview')}</TabsTrigger>
          <TabsTrigger value="match">{t('workbench.tabs.match')}</TabsTrigger>
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
        <TabsContent value="match" className="min-h-0">
          <ScrollArea className="h-full">
            <TargetMatchPanel
              resume={resume}
              quality={quality}
              targets={targets ?? []}
              evidence={evidence ?? []}
              onTailor={(target) => tailorMutation.mutate(target)}
              tailoring={tailorMutation.isPending}
              onAddEvidence={() => setEvidenceDialogOpen(true)}
            />
          </ScrollArea>
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
              issues={aiIssues ?? []}
              applyingIssueId={
                applyAiIssueMutation.isPending ? applyAiIssueMutation.variables?.id : undefined
              }
              onApplyIssue={(issue) => applyAiIssueMutation.mutate(issue)}
              comments={comments ?? []}
              commentDraft={commentDraft}
              onCommentDraftChange={setCommentDraft}
              onAddComment={() => createCommentMutation.mutate()}
              addingComment={createCommentMutation.isPending}
              resolvingCommentId={resolveCommentMutation.variables}
              onResolveComment={(commentId) => resolveCommentMutation.mutate(commentId)}
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

      <UploadImportDialog
        open={uploadImportOpen}
        onOpenChange={setUploadImportOpen}
        preview={uploadImportPreview}
        selectedSections={uploadSectionIndexes}
        selectedEvidence={uploadEvidenceIndexes}
        onToggleSection={(index) =>
          setUploadSectionIndexes((current) => toggleSetValue(current, index))
        }
        onToggleEvidence={(index) =>
          setUploadEvidenceIndexes((current) => toggleSetValue(current, index))
        }
        onApply={() => applyUploadImportMutation.mutate()}
        loading={applyUploadImportMutation.isPending}
      />

      <EvidenceDialog
        open={evidenceDialogOpen}
        onOpenChange={setEvidenceDialogOpen}
        draft={evidenceDraft}
        onChange={setEvidenceDraft}
        onSubmit={() => createEvidenceMutation.mutate()}
        loading={createEvidenceMutation.isPending}
      />

      <ConfirmActionDialog
        state={confirmState}
        loading={
          deleteSectionMutation.isPending ||
          importProfileMutation.isPending ||
          importProfilePreviewMutation.isPending ||
          restoreSnapshotMutation.isPending
        }
        importPreview={importProfilePreviewMutation.data}
        importPreviewLoading={importProfilePreviewMutation.isPending}
        selectedImportSectionIds={profileImportSectionIds}
        onToggleImportSection={(sectionId) =>
          setProfileImportSectionIds((current) => toggleSetValue(current, sectionId))
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
  quality,
  targets,
  evidence,
  onSelect,
}: {
  sections: ResumeSection[];
  completion: number;
  quality?: ResumeQualitySummary;
  targets: ResumeTarget[];
  evidence: ResumeEvidence[];
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('resume');
  const openGapCount = quality?.gaps?.length ?? 0;

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
      <div className="space-y-2 border-b p-3">
        <SidebarStat
          icon={Library}
          label={t('workbench.sidebar.evidence')}
          value={String(evidence.length)}
        />
        <SidebarStat
          icon={Target}
          label={t('workbench.sidebar.targets')}
          value={String(targets.length)}
        />
        <SidebarStat
          icon={ListChecks}
          label={t('workbench.sidebar.gaps')}
          value={openGapCount ? String(openGapCount) : t('workbench.sidebar.noGaps')}
          tone={openGapCount ? 'warning' : 'success'}
        />
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

function SidebarStat({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-background px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      </div>
      <span
        className={cn(
          'text-xs font-semibold',
          tone === 'success' && 'text-emerald-600',
          tone === 'warning' && 'text-amber-600'
        )}
      >
        {value}
      </span>
    </div>
  );
}

function TargetContextPanel({
  type,
  value,
  pending,
  onChange,
  onSave,
  onCreateTarget,
  creatingTarget,
}: {
  type: ResumeType;
  value: ResumeTargetContext;
  pending: boolean;
  onChange: (value: ResumeTargetContext) => void;
  onSave: () => void;
  onCreateTarget: () => void;
  creatingTarget: boolean;
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
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onSave} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t('workbench.actions.saveTarget')}
          </Button>
          <Button size="sm" variant="outline" onClick={onCreateTarget} disabled={creatingTarget}>
            {creatingTarget ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Target className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t('workbench.actions.createTarget')}
          </Button>
        </div>
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

      {(type === 'INTERNSHIP' || type === 'FULL_TIME_JOB') && (
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
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted sm:h-8 sm:w-8"
              aria-label={t(
                expanded ? 'workbench.section.collapseSection' : 'workbench.section.expandSection'
              )}
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
                  <button
                    type="button"
                    aria-label={t('workbench.section.editTitle', { title: section.title })}
                    className="min-h-10 max-w-full truncate py-2 text-left text-sm font-semibold hover:text-primary sm:min-h-8 sm:py-1"
                    onClick={() => setEditingTitle(true)}
                  >
                    {getSectionTypeLabel(t, section.type, section.title)}
                  </button>
                )}
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                {!section.isVisible && (
                  <Badge variant="outline">{t('workbench.section.hidden')}</Badge>
                )}
                {Boolean(section.evidenceRefs?.length) && (
                  <Badge variant="secondary">
                    {t('workbench.section.evidenceRefs', {
                      count: section.evidenceRefs?.length ?? 0,
                    })}
                  </Badge>
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
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 sm:h-8 sm:w-8"
              aria-label={t(
                section.isVisible
                  ? 'workbench.section.hideSection'
                  : 'workbench.section.showSection'
              )}
              onClick={onToggleVisibility}
            >
              {section.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-destructive sm:h-8 sm:w-8"
              aria-label={t('workbench.section.deleteSection')}
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
                <Lightbulb className="mr-1.5 h-3.5 w-3.5" />
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
  issues,
  applyingIssueId,
  onApplyIssue,
  comments,
  commentDraft,
  onCommentDraftChange,
  onAddComment,
  addingComment,
  resolvingCommentId,
  onResolveComment,
}: {
  review?: ReviewRecord | null;
  reviewPending: boolean;
  onRunReview: () => void;
  onOpenReview: () => void;
  sections: ResumeSection[];
  onSuggest: (sectionType: string) => void;
  suggesting: boolean;
  issues: ResumeAIIssue[];
  applyingIssueId?: string;
  onApplyIssue: (issue: ResumeAIIssue) => void;
  comments: ResumeComment[];
  commentDraft: string;
  onCommentDraftChange: (value: string) => void;
  onAddComment: () => void;
  addingComment: boolean;
  resolvingCommentId?: string;
  onResolveComment: (commentId: string) => void;
}) {
  const t = useTranslations('resume');
  const output = review?.output as ResumeReviewResult | undefined;
  const gaps = 'contentGaps' in (output ?? {}) ? (output?.contentGaps ?? []) : [];
  const openIssues = issues.filter((issue) => issue.status === 'OPEN');

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
              <Lightbulb className="mr-1.5 h-3.5 w-3.5" />
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t('workbench.ai.issuesTitle')}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('workbench.ai.issuesDescription')}
            </p>
          </div>
          <Badge variant="secondary">{openIssues.length}</Badge>
        </div>
        {openIssues.length > 0 ? (
          <div className="mt-3 space-y-2">
            {openIssues.slice(0, 6).map((issue) => (
              <div key={issue.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{issue.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {issue.reason || issue.suggestion || issue.type}
                    </p>
                  </div>
                  <Badge variant="outline">{issue.severity}</Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {issue.confidence
                      ? t('workbench.ai.confidence', {
                          value: Math.round(issue.confidence * 100),
                        })
                      : issue.source}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!issue.original || !issue.suggestion || applyingIssueId === issue.id}
                    onClick={() => onApplyIssue(issue)}
                  >
                    {applyingIssueId === issue.id && (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    )}
                    {t('workbench.actions.applyIssue')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            {t('workbench.ai.noIssues')}
          </p>
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
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-md border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">{t('workbench.comments.title')}</h3>
          </div>
          <Badge variant="secondary">
            {comments.filter((item) => item.status === 'OPEN').length}
          </Badge>
        </div>
        <div className="mt-3 space-y-2">
          <Textarea
            value={commentDraft}
            onChange={(event) => onCommentDraftChange(event.target.value)}
            placeholder={t('workbench.comments.placeholder')}
            className="min-h-20 text-sm"
          />
          <Button
            size="sm"
            className="w-full"
            disabled={!commentDraft.trim() || addingComment}
            onClick={onAddComment}
          >
            {addingComment ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t('workbench.comments.add')}
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {comments.slice(0, 6).map((comment) => (
            <div key={comment.id} className="rounded-md border px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm">{comment.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[comment.role, comment.author?.email].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {comment.status === 'OPEN' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onResolveComment(comment.id)}
                    disabled={resolvingCommentId === comment.id}
                  >
                    {resolvingCommentId === comment.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                ) : (
                  <Badge variant="outline">{t('workbench.comments.resolved')}</Badge>
                )}
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              {t('workbench.comments.empty')}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function TargetMatchPanel({
  resume,
  quality,
  targets,
  evidence,
  onTailor,
  tailoring,
  onAddEvidence,
}: {
  resume: Resume;
  quality?: ResumeQualitySummary;
  targets: ResumeTarget[];
  evidence: ResumeEvidence[];
  onTailor: (target?: ResumeTarget) => void;
  tailoring: boolean;
  onAddEvidence: () => void;
}) {
  const t = useTranslations('resume');
  const family: ResumeFamily =
    resume.family ??
    (resume.type === 'INTERNSHIP' || resume.type === 'FULL_TIME_JOB' ? 'CAREER' : 'STUDY_ABROAD');
  const activeTarget =
    targets.find((target) => target.id === resume.targetId) ??
    targets.find((target) => target.status === 'ACTIVE') ??
    targets[0];
  const targetDetails = activeTarget
    ? [
        activeTarget.school,
        activeTarget.program,
        activeTarget.major,
        activeTarget.company,
        activeTarget.role,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const keywords = activeTarget?.keywords?.length
    ? activeTarget.keywords
    : (resume.targetContext?.keywords ?? []);

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-md border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t('workbench.match.title')}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {family === 'CAREER'
                ? t('workbench.match.careerDescription')
                : t('workbench.match.studyDescription')}
            </p>
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-center">
            <p className="text-xs text-muted-foreground">{t('workbench.match.score')}</p>
            <p className="text-xl font-semibold">{quality?.score ?? '—'}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <Metric
            label={t('workbench.match.family')}
            value={
              family === 'CAREER'
                ? t('workbench.match.familyCareer')
                : t('workbench.match.familyStudyAbroad')
            }
          />
          <Metric
            label={t('workbench.match.variant')}
            value={
              resume.variantKind === 'TAILORED'
                ? t('workbench.match.tailored')
                : t('workbench.match.master')
            }
          />
          <Metric label={t('workbench.match.rubric')} value={quality?.rubricVersion ?? '—'} />
        </div>
      </section>

      <section className="rounded-md border bg-card p-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{t('workbench.match.activeTarget')}</h3>
        </div>
        {activeTarget ? (
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-sm font-medium">{activeTarget.title}</p>
              {targetDetails && (
                <p className="mt-1 text-xs text-muted-foreground">{targetDetails}</p>
              )}
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {keywords.slice(0, 10).map((keyword) => (
                  <Badge key={keyword} variant="secondary">
                    {keyword}
                  </Badge>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onTailor(activeTarget)}
              disabled={tailoring}
            >
              {tailoring ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Copy className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t('workbench.actions.createTailored')}
            </Button>
          </div>
        ) : (
          <p className="mt-3 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            {t('workbench.match.noTarget')}
          </p>
        )}
      </section>

      <section className="rounded-md border bg-card p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{t('workbench.match.dimensions')}</h3>
        </div>
        <div className="mt-3 space-y-2">
          {(quality?.dimensions ?? []).map((dimension) => (
            <div key={dimension.key} className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{dimension.label}</span>
                <Badge
                  variant={dimension.status === 'green' ? 'default' : 'outline'}
                  className={cn(
                    dimension.status === 'red' && 'border-destructive text-destructive'
                  )}
                >
                  {dimension.score}
                </Badge>
              </div>
              <Progress value={dimension.score} className="h-2" />
              {dimension.checks.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">{dimension.checks.join(' · ')}</p>
              )}
            </div>
          ))}
          {(!quality?.dimensions || quality.dimensions.length === 0) && (
            <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              {t('workbench.match.noQuality')}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-md border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Library className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">{t('workbench.match.evidence')}</h3>
          </div>
          <Button size="sm" variant="outline" onClick={onAddEvidence}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t('workbench.actions.addEvidence')}
          </Button>
        </div>
        {evidence.length > 0 ? (
          <div className="mt-3 space-y-2">
            {evidence.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-md border px-3 py-2">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[item.kind, item.organization, item.role].filter(Boolean).join(' · ')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            {t('workbench.match.evidenceEmpty')}
          </p>
        )}
      </section>

      {Boolean(quality?.gaps?.length) && (
        <section className="rounded-md border bg-card p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold">{t('workbench.match.gaps')}</h3>
          </div>
          <div className="mt-3 space-y-2">
            {quality?.gaps.map((gap) => (
              <div
                key={gap.key}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span className="text-sm">{gap.label}</span>
                <Badge variant="outline">{gap.severity}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ExportReadinessPanel({
  resume,
  quality,
  exports,
  onRecord,
  recording,
}: {
  resume: Resume;
  quality?: ResumeQualitySummary;
  exports: ResumeExport[];
  onRecord: () => void;
  recording: boolean;
}) {
  const t = useTranslations('resume');
  const visibleSections = resume.sections.filter((section) => section.isVisible);
  const header = visibleSections.find((section) => section.type === 'HEADER');
  const headerContent = (header?.content ?? {}) as Record<string, unknown>;
  const checks = [
    {
      key: 'sections',
      label: t('workbench.exportCheck.visibleSections'),
      passed: visibleSections.length > 0,
      value: String(visibleSections.length),
    },
    {
      key: 'contact',
      label: t('workbench.exportCheck.contact'),
      passed: Boolean(headerContent.name && (headerContent.email || headerContent.phone)),
      value: headerContent.name
        ? t('workbench.exportCheck.present')
        : t('workbench.exportCheck.missing'),
    },
    {
      key: 'text',
      label: t('workbench.exportCheck.textExtractable'),
      passed: true,
      value: t('workbench.exportCheck.compatible'),
    },
    {
      key: 'quality',
      label: t('workbench.exportCheck.qualityScore'),
      passed: (quality?.score ?? 0) >= 70,
      value: quality?.score ? String(quality.score) : '—',
    },
  ];

  return (
    <div className="space-y-4 p-4">
      <section className="rounded-md border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t('workbench.exportCheck.title')}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('workbench.exportCheck.description')}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onRecord} disabled={recording}>
            {recording ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileCheck2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t('workbench.exportCheck.record')}
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {checks.map((check) => (
            <div
              key={check.key}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    check.passed ? 'bg-emerald-500' : 'bg-amber-500'
                  )}
                />
                <span className="truncate text-sm">{check.label}</span>
              </div>
              <span className="text-xs text-muted-foreground">{check.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border bg-card p-4">
        <h3 className="text-sm font-semibold">{t('workbench.exportCheck.history')}</h3>
        {exports.length > 0 ? (
          <div className="mt-3 space-y-2">
            {exports.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{item.format}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant={item.status === 'COMPLETED' ? 'default' : 'outline'}>
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            {t('workbench.exportCheck.noHistory')}
          </p>
        )}
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
      <DialogContent className="max-h-[85vh] sm:max-w-2xl overflow-y-auto">
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
      <DialogContent className="max-h-[85vh] sm:max-w-2xl overflow-y-auto">
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

function UploadImportDialog({
  open,
  onOpenChange,
  preview,
  selectedSections,
  selectedEvidence,
  onToggleSection,
  onToggleEvidence,
  onApply,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: ResumeUploadImportPreview | null;
  selectedSections: Set<number>;
  selectedEvidence: Set<number>;
  onToggleSection: (index: number) => void;
  onToggleEvidence: (index: number) => void;
  onApply: () => void;
  loading: boolean;
}) {
  const t = useTranslations('resume');
  const selectedCount = selectedSections.size + selectedEvidence.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('workbench.dialogs.uploadImportTitle')}</DialogTitle>
        </DialogHeader>
        {preview ? (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm font-medium">{preview.sourceFileName}</p>
              <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                {preview.rawTextPreview}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('workbench.dialogs.uploadSections')}</p>
              {preview.sections.map((section, index) => (
                <label
                  key={`${section.sectionType}-${index}`}
                  className="flex items-center gap-3 rounded-md border px-3 py-2"
                >
                  <Checkbox
                    checked={selectedSections.has(index)}
                    onCheckedChange={() => onToggleSection(index)}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{section.title}</span>
                  <Badge variant="outline">
                    {section.changeType} · {section.itemCount}
                  </Badge>
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('workbench.dialogs.uploadEvidence')}</p>
              {preview.evidence.slice(0, 12).map((item, index) => (
                <label
                  key={`${item.kind}-${item.title}-${index}`}
                  className="flex items-center gap-3 rounded-md border px-3 py-2"
                >
                  <Checkbox
                    checked={selectedEvidence.has(index)}
                    onCheckedChange={() => onToggleEvidence(index)}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                  <Badge variant="secondary">{item.kind}</Badge>
                </label>
              ))}
              {preview.evidence.length === 0 && (
                <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                  {t('workbench.dialogs.uploadEvidenceEmpty')}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('workbench.dialogs.uploadImportEmpty')}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('workbench.actions.cancel')}
          </Button>
          <Button onClick={onApply} disabled={!preview || selectedCount === 0 || loading}>
            {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {t('workbench.actions.applyUploadImport')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EvidenceDialog({
  open,
  onOpenChange,
  draft,
  onChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: { kind: string; title: string; description: string };
  onChange: (draft: { kind: string; title: string; description: string }) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const t = useTranslations('resume');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('workbench.dialogs.evidenceTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label={t('workbench.dialogs.evidenceKind')}>
            <Input
              value={draft.kind}
              onChange={(event) => onChange({ ...draft, kind: event.target.value.toUpperCase() })}
              placeholder="PROJECT"
            />
          </Field>
          <Field label={t('workbench.dialogs.evidenceName')}>
            <Input
              value={draft.title}
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
            />
          </Field>
          <Field label={t('workbench.dialogs.evidenceDescription')}>
            <Textarea
              value={draft.description}
              onChange={(event) => onChange({ ...draft, description: event.target.value })}
              className="min-h-24"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('workbench.actions.cancel')}
          </Button>
          <Button onClick={onSubmit} disabled={!draft.title.trim() || loading}>
            {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {t('workbench.actions.addEvidence')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmActionDialog({
  state,
  loading,
  importPreview,
  importPreviewLoading,
  selectedImportSectionIds,
  onToggleImportSection,
  onCancel,
  onConfirm,
}: {
  state: ConfirmState;
  loading: boolean;
  importPreview?: ResumeImportPreview;
  importPreviewLoading?: boolean;
  selectedImportSectionIds: Set<string>;
  onToggleImportSection: (sectionId: string) => void;
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
        {state?.type === 'import-profile' && (
          <div className="rounded-md border bg-muted/30 p-3">
            {importPreviewLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('workbench.dialogs.importPreviewLoading')}
              </div>
            ) : importPreview?.sections.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t('workbench.dialogs.importPreviewItems', {
                    count: importPreview.sections.length,
                  })}
                </p>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {importPreview.sections.map((section) => (
                    <label
                      key={section.sectionId}
                      className="flex items-center gap-2 rounded border bg-background px-2 py-1.5"
                    >
                      <Checkbox
                        checked={selectedImportSectionIds.has(section.sectionId)}
                        onCheckedChange={() => onToggleImportSection(section.sectionId)}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs">{section.title}</span>
                      <Badge variant="outline">{section.itemCount}</Badge>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('workbench.dialogs.importPreviewEmpty')}
              </p>
            )}
          </div>
        )}
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
