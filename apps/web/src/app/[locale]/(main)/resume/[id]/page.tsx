'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { resumeRoutes } from '@study-abroad/shared';
import { PageContainer } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Save,
  Download,
  Copy,
  MoreVertical,
  Plus,
  Sparkles,
  FileText,
  GraduationCap,
  Briefcase,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/lib/i18n/navigation';
import { ResumePreview } from '@/components/features/resume/resume-preview';
import type { SectionConfig } from '@/components/features/resume/pdf/types';
import type { ResumeSettings } from '@study-abroad/shared';
import { SectionCard } from './_components/section-card';

interface ResumeSection {
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
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  type: 'COLLEGE_APPLICATION' | 'INTERNSHIP' | 'GRADUATE_CV';
  templateId: string;
  language: string;
  settings: Record<string, unknown>;
  sections: ResumeSection[];
  version: number;
  lastImportedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const SECTION_TYPE_LABELS: Record<string, string> = {
  HEADER: 'HEADER',
  EDUCATION: 'EDUCATION',
  TEST_SCORES: 'TEST_SCORES',
  RESEARCH: 'RESEARCH',
  WORK_EXPERIENCE: 'WORK_EXPERIENCE',
  PROJECTS: 'PROJECTS',
  ACTIVITIES: 'ACTIVITIES',
  COMMUNITY_SERVICE: 'COMMUNITY_SERVICE',
  AWARDS: 'AWARDS',
  SKILLS: 'SKILLS',
  PUBLICATIONS: 'PUBLICATIONS',
  TEACHING: 'TEACHING',
  CERTIFICATIONS: 'CERTIFICATIONS',
  CUSTOM: 'CUSTOM',
};

const ALL_SECTION_TYPES = Object.keys(SECTION_TYPE_LABELS);

const TYPE_ICONS: Record<string, React.ElementType> = {
  COLLEGE_APPLICATION: GraduationCap,
  INTERNSHIP: Briefcase,
  GRADUATE_CV: BookOpen,
};

export default function ResumeEditPage() {
  const params = useParams();
  const resumeId = params.id as string;
  const t = useTranslations('resume');
  const tc = useTranslations('common');
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [aiReviewResult, setAiReviewResult] = useState<Record<string, unknown> | null>(null);

  const {
    data: resume,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['resume', resumeId],
    queryFn: () => apiClient.get<Resume>(resumeRoutes.byId(resumeId)),
  });

  const updateResumeMutation = useMutation({
    mutationFn: (dto: Partial<Pick<Resume, 'title' | 'status' | 'templateId' | 'settings'>>) =>
      apiClient.put(resumeRoutes.byId(resumeId), dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
      setEditingTitle(false);
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({
      sectionId,
      dto,
    }: {
      sectionId: string;
      dto: { title?: string; content?: unknown; isVisible?: boolean };
    }) => apiClient.put(resumeRoutes.section(resumeId, sectionId), dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
    },
  });

  const addSectionMutation = useMutation({
    mutationFn: (dto: { type: string; title?: string }) =>
      apiClient.post(resumeRoutes.sections(resumeId), dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
      setAddSectionOpen(false);
      toast.success(tc('success'));
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: string) => apiClient.delete(resumeRoutes.section(resumeId, sectionId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
      toast.success(tc('success'));
    },
  });

  const importProfileMutation = useMutation({
    mutationFn: () => apiClient.post(resumeRoutes.importProfile(resumeId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
      toast.success(tc('success'));
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: () => apiClient.post<Resume>(resumeRoutes.duplicate(resumeId)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      router.push(`/resume/${data.id}`);
      toast.success(tc('success'));
    },
  });

  const snapshotMutation = useMutation({
    mutationFn: (description?: string) =>
      apiClient.post(resumeRoutes.snapshots(resumeId), { description }),
    onSuccess: () => {
      toast.success(tc('success'));
    },
  });

  const aiReviewMutation = useMutation({
    mutationFn: (dto?: { targetSchool?: string; targetMajor?: string }) =>
      apiClient.post<{ output: Record<string, unknown>; overallScore: number | null }>(
        resumeRoutes.aiReview(resumeId),
        dto ?? {}
      ),
    onSuccess: (data) => {
      setAiReviewResult(data);
      setAiReviewOpen(true);
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
    },
  });

  const handleTitleSave = useCallback(() => {
    if (titleValue.trim() && titleValue !== resume?.title) {
      updateResumeMutation.mutate({ title: titleValue.trim() });
    } else {
      setEditingTitle(false);
    }
  }, [titleValue, resume?.title, updateResumeMutation]);

  const startEditTitle = () => {
    if (resume) {
      setTitleValue(resume.title);
      setEditingTitle(true);
    }
  };

  if (isLoading) {
    return (
      <PageContainer maxWidth="default" className="space-y-6 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-72" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </PageContainer>
    );
  }

  if (error || !resume) {
    return (
      <PageContainer maxWidth="default" className="py-12 text-center">
        <p className="text-muted-foreground">{tc('error')}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/resume')}>
          {t('back')}
        </Button>
      </PageContainer>
    );
  }

  const TypeIcon = TYPE_ICONS[resume.type] ?? FileText;
  const existingSectionTypes = new Set(resume.sections.map((s) => s.type));
  const availableSectionTypes = ALL_SECTION_TYPES.filter((st) => !existingSectionTypes.has(st));

  const previewSections: SectionConfig[] = resume.sections.map((s) => ({
    id: s.id,
    type: s.type,
    title: s.title,
    content: s.content,
    isVisible: s.isVisible,
  }));

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Top Bar */}
      <div className="flex flex-col gap-2 border-b bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/resume">
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Go back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>

          <div className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            {editingTitle ? (
              <Input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                className="h-8 w-60 text-lg font-semibold"
                autoFocus
              />
            ) : (
              <h1
                className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
                onClick={startEditTitle}
                onKeyDown={(e) => e.key === 'Enter' && startEditTitle()}
                role="button"
                tabIndex={0}
              >
                {resume.title || t('untitled')}
              </h1>
            )}
          </div>

          <Badge variant="secondary" className="text-xs">
            {t(`types.${resume.type}`)}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {t(`status.${resume.status}`)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => importProfileMutation.mutate()}
            disabled={importProfileMutation.isPending}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {t('editor.importProfile')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => aiReviewMutation.mutate(undefined)}
            disabled={aiReviewMutation.isPending}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {aiReviewMutation.isPending ? t('editor.aiReviewing') : t('editor.aiReview')}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label="More options">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => snapshotMutation.mutate(undefined)}>
                <Save className="mr-2 h-4 w-4" />
                {t('editor.snapshot')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicateMutation.mutate()}>
                <Copy className="mr-2 h-4 w-4" />
                {t('editor.duplicate')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  const next = resume.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE';
                  updateResumeMutation.mutate({ status: next });
                }}
              >
                {resume.status === 'ACTIVE' ? t('status.DRAFT') : t('status.ACTIVE')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Split pane: Editor (left) + Preview (right) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor panel */}
        <div className="w-full overflow-y-auto p-4 lg:w-1/2 lg:border-r">
          <div className="mx-auto max-w-2xl space-y-4">
            {resume.sections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                sectionLabel={
                  SECTION_TYPE_LABELS[section.type] ? t(`sections.${section.type}`) : section.title
                }
                t={t}
                tc={tc}
                onToggleVisibility={() =>
                  updateSectionMutation.mutate({
                    sectionId: section.id,
                    dto: { isVisible: !section.isVisible },
                  })
                }
                onUpdateContent={(content) =>
                  updateSectionMutation.mutate({
                    sectionId: section.id,
                    dto: { content },
                  })
                }
                onUpdateTitle={(title) =>
                  updateSectionMutation.mutate({
                    sectionId: section.id,
                    dto: { title },
                  })
                }
                onDelete={() => deleteSectionMutation.mutate(section.id)}
                isSaving={updateSectionMutation.isPending}
              />
            ))}

            {/* Add Section */}
            <Button
              variant="outline"
              className="w-full border-dashed gap-2"
              onClick={() => setAddSectionOpen(true)}
              disabled={availableSectionTypes.length === 0}
            >
              <Plus className="h-4 w-4" />
              {t('editor.addSection')}
            </Button>
          </div>
        </div>

        {/* Preview panel — hidden on mobile, visible on lg+ */}
        <div className="hidden lg:block lg:w-1/2 bg-muted/30">
          <ResumePreview
            sections={previewSections}
            templateId={resume.templateId}
            settings={resume.settings as ResumeSettings | undefined}
          />
        </div>
      </div>

      {/* Add Section Dialog */}
      <Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('editor.addSection')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2 max-h-80 overflow-y-auto">
            {availableSectionTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addSectionMutation.mutate({ type })}
                disabled={addSectionMutation.isPending}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50"
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{t(`sections.${type}`)}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Review Dialog */}
      <Dialog open={aiReviewOpen} onOpenChange={setAiReviewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('aiReview.title')}</DialogTitle>
          </DialogHeader>
          {aiReviewResult && (
            <div className="space-y-4 py-2">
              {'overallScore' in aiReviewResult && (
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary">
                    {String(aiReviewResult.overallScore ?? '—')}
                  </div>
                  <p className="text-sm text-muted-foreground">{t('ai.score')}</p>
                </div>
              )}
              {'output' in aiReviewResult && typeof aiReviewResult.output === 'object' && (
                <pre className="rounded-lg bg-muted p-4 text-xs whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(aiReviewResult.output, null, 2)}
                </pre>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiReviewOpen(false)}>
              {tc('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
