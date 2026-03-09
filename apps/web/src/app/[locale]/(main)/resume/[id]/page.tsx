'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { PageContainer } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Save,
  Download,
  Copy,
  MoreVertical,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  Sparkles,
  Clock,
  FileText,
  GraduationCap,
  Briefcase,
  BookOpen,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Link } from '@/lib/i18n/navigation';
import { ResumePreview } from '@/components/features/resume/resume-preview';
import type { SectionConfig } from '@/components/features/resume/pdf/types';
import type { ResumeSettings } from '@study-abroad/shared';

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
    queryFn: () => apiClient.get<Resume>(`/resumes/${resumeId}`),
  });

  const updateResumeMutation = useMutation({
    mutationFn: (dto: Partial<Pick<Resume, 'title' | 'status' | 'templateId' | 'settings'>>) =>
      apiClient.put(`/resumes/${resumeId}`, dto),
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
    }) => apiClient.put(`/resumes/${resumeId}/sections/${sectionId}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
    },
  });

  const addSectionMutation = useMutation({
    mutationFn: (dto: { type: string; title?: string }) =>
      apiClient.post(`/resumes/${resumeId}/sections`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
      setAddSectionOpen(false);
      toast.success(tc('success'));
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: string) =>
      apiClient.delete(`/resumes/${resumeId}/sections/${sectionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
      toast.success(tc('success'));
    },
  });

  const importProfileMutation = useMutation({
    mutationFn: () => apiClient.post(`/resumes/${resumeId}/import-profile`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
      toast.success(tc('success'));
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: () => apiClient.post<Resume>(`/resumes/${resumeId}/duplicate`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      router.push(`/resume/${data.id}`);
      toast.success(tc('success'));
    },
  });

  const snapshotMutation = useMutation({
    mutationFn: (description?: string) =>
      apiClient.post(`/resumes/${resumeId}/snapshots`, { description }),
    onSuccess: () => {
      toast.success(tc('success'));
    },
  });

  const aiReviewMutation = useMutation({
    mutationFn: (dto?: { targetSchool?: string; targetMajor?: string }) =>
      apiClient.post<{ output: Record<string, unknown>; overallScore: number | null }>(
        `/resumes/${resumeId}/ai/review`,
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
            <Button variant="ghost" size="icon" className="h-9 w-9">
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
              <Button variant="outline" size="icon" className="h-8 w-8">
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

/* ─── Section Card ─── */

interface SectionCardProps {
  section: ResumeSection;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
  onToggleVisibility: () => void;
  onUpdateContent: (content: unknown) => void;
  onUpdateTitle: (title: string) => void;
  onDelete: () => void;
  isSaving: boolean;
}

function SectionCard({
  section,
  t,
  tc,
  onToggleVisibility,
  onUpdateContent,
  onUpdateTitle,
  onDelete,
  isSaving,
}: SectionCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingContent, setEditingContent] = useState(false);
  const [contentJson, setContentJson] = useState('');

  const sectionLabel = SECTION_TYPE_LABELS[section.type]
    ? t(`sections.${section.type}`)
    : section.title;

  const handleEditContent = () => {
    setContentJson(JSON.stringify(section.content, null, 2));
    setEditingContent(true);
  };

  const handleSaveContent = () => {
    try {
      const parsed = JSON.parse(contentJson);
      onUpdateContent(parsed);
      setEditingContent(false);
    } catch {
      toast.error('Invalid JSON');
    }
  };

  const contentItems = getContentSummary(section);

  return (
    <Card className={cn(!section.isVisible && 'opacity-60')}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', !expanded && '-rotate-90')}
              />
            </button>
            <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
            <CardTitle className="text-sm font-medium">{sectionLabel}</CardTitle>
            {!section.isVisible && (
              <Badge variant="outline" className="text-xs">
                <EyeOff className="mr-1 h-3 w-3" />
                {tc('hidden') ?? 'Hidden'}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onToggleVisibility}
              title={section.isVisible ? 'Hide' : 'Show'}
            >
              {section.isVisible ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-0">
          {editingContent ? (
            <div className="space-y-3">
              <Textarea
                value={contentJson}
                onChange={(e) => setContentJson(e.target.value)}
                className="font-mono text-xs min-h-[200px]"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditingContent(false)}>
                  {tc('cancel')}
                </Button>
                <Button size="sm" onClick={handleSaveContent} disabled={isSaving}>
                  {tc('save')}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {contentItems.length > 0 ? (
                <div className="space-y-2">
                  {contentItems.map((item, i) => (
                    <div key={i} className="rounded-md border border-border/50 px-3 py-2 text-sm">
                      {item.primary && (
                        <p className="font-medium text-foreground">{item.primary}</p>
                      )}
                      {item.secondary && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.secondary}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  {tc('noData') ?? 'No data yet'}
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-xs"
                onClick={handleEditContent}
              >
                {tc('edit')}
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/* ─── Helpers ─── */

interface ContentItem {
  primary?: string;
  secondary?: string;
}

function getContentSummary(section: ResumeSection): ContentItem[] {
  const content = section.content as Record<string, unknown>;
  if (!content) return [];

  if (section.type === 'HEADER') {
    const name = content.name as string;
    const email = content.email as string;
    if (!name && !email) return [];
    return [
      {
        primary: name || '—',
        secondary: [email, content.phone as string].filter(Boolean).join(' · '),
      },
    ];
  }

  if (section.type === 'SKILLS') {
    const categories = content.categories as Array<{ name: string; items: string[] }>;
    if (!categories || categories.length === 0) return [];
    return categories.map((c) => ({
      primary: c.name,
      secondary: c.items?.join(', ') || '',
    }));
  }

  const items = content.items as Array<Record<string, unknown>>;
  if (!items || !Array.isArray(items) || items.length === 0) return [];

  return items.map((item) => {
    const primary =
      (item.name as string) ||
      (item.schoolName as string) ||
      (item.title as string) ||
      (item.type as string) ||
      '';
    const parts: string[] = [];
    if (item.role) parts.push(item.role as string);
    if (item.organization) parts.push(item.organization as string);
    if (item.company) parts.push(item.company as string);
    if (item.institution) parts.push(item.institution as string);
    if (item.degree) parts.push(item.degree as string);
    if (item.major) parts.push(item.major as string);
    if (item.level) parts.push(item.level as string);
    if (item.score !== undefined) parts.push(`Score: ${item.score}`);
    if (item.startDate) {
      const dateRange = `${item.startDate}${item.endDate ? ` – ${item.endDate}` : ''}`;
      parts.push(dateRange);
    }
    return { primary, secondary: parts.join(' · ') };
  });
}
