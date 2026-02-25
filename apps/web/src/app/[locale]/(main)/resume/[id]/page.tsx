'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import type {
  ResumeSettings,
  ResumeReviewResult,
  ResumeReviewResultV1,
} from '@study-abroad/shared';
import { ReviewDialog } from '@/components/features/resume/review-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingState } from '@/components/ui/loading-state';
import {
  ArrowLeft,
  Download,
  Sparkles,
  Eye,
  GripVertical,
  Plus,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Trash2,
  Import,
  Save,
  SlidersHorizontal,
  List,
  Loader2,
} from 'lucide-react';
import { AI_TIMEOUTS, STALE_TIME } from '@/lib/constants';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { Resume, ResumeSection as ResumeSectionType } from '@study-abroad/shared';
import { SectionEditor } from '@/components/features/resume/resume-editor/section-editor';
import { ResumePreview } from '@/components/features/resume/resume-preview';
import { TemplatePicker } from '@/components/features/resume/template-picker';
import { CustomizePanel } from '@/components/features/resume/customize-panel';
import { registerFonts } from '@/components/features/resume/pdf/fonts/register';
import type { SectionConfig } from '@/components/features/resume/pdf/types';

export default function ResumeEditorPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const resumeId = params.id as string;

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingTitle, setEditingTitle] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Local section state for immediate preview updates (optimistic)
  const [localSections, setLocalSections] = useState<SectionConfig[] | null>(null);

  // Local settings state for immediate preview + debounced server save
  const [localSettings, setLocalSettings] = useState<ResumeSettings>({});
  const settingsDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { data: resume, isLoading } = useQuery({
    queryKey: ['resume', resumeId],
    queryFn: () => apiClient.get<Resume>(`/resumes/${resumeId}`),
  });

  // Sync server data → local state when server responds
  useEffect(() => {
    if (resume?.sections) {
      setLocalSections(
        resume.sections.map((s) => ({
          id: s.id,
          type: s.type,
          title: s.title,
          content: s.content as Record<string, unknown>,
          isVisible: s.isVisible,
        }))
      );
    }
  }, [resume?.sections]);

  // Initialize settings from server data
  useEffect(() => {
    if (resume?.settings && Object.keys(resume.settings).length > 0) {
      setLocalSettings(resume.settings as ResumeSettings);
    }
  }, [resume?.settings]);

  // The sections used for preview — local state takes priority for instant feedback
  const previewSections = localSections ?? [];

  const updateResumeMutation = useMutation({
    mutationFn: (data: Partial<Resume>) => apiClient.put(`/resumes/${resumeId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
    },
    onError: () => {
      toast.error(t('resume.toast.saveFailed'));
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: ({
      sectionId,
      data,
    }: {
      sectionId: string;
      data: { title?: string; content?: Record<string, unknown>; isVisible?: boolean };
    }) => apiClient.put(`/resumes/${resumeId}/sections/${sectionId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
    },
    onError: () => {
      toast.error(t('resume.toast.saveFailed'));
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: string) =>
      apiClient.delete(`/resumes/${resumeId}/sections/${sectionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
      toast.success('Section deleted');
    },
    onError: () => {
      toast.error(t('resume.toast.saveFailed'));
    },
  });

  const addSectionMutation = useMutation({
    mutationFn: (data: { type: string; title?: string }) =>
      apiClient.post(`/resumes/${resumeId}/sections`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
    },
    onError: () => {
      toast.error(t('resume.toast.saveFailed'));
    },
  });

  const importProfileMutation = useMutation({
    mutationFn: () => apiClient.post(`/resumes/${resumeId}/import-profile`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume', resumeId] });
      toast.success(t('resume.toast.imported'));
    },
    onError: () => {
      toast.error(t('resume.toast.saveFailed'));
    },
  });

  const snapshotMutation = useMutation({
    mutationFn: () => apiClient.post(`/resumes/${resumeId}/snapshots`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resume-snapshots', resumeId] });
      toast.success(t('resume.toast.snapshotCreated'));
    },
    onError: () => {
      toast.error(t('resume.toast.saveFailed'));
    },
  });

  // ─── Persisted AI Review ───
  const { data: latestReview } = useQuery({
    queryKey: ['resume-review', resumeId],
    queryFn: () =>
      apiClient.get<{
        id: string;
        output: ResumeReviewResult | ResumeReviewResultV1;
        overallScore: number | null;
        createdAt: string;
      } | null>(`/resumes/${resumeId}/ai/reviews/latest`),
    staleTime: STALE_TIME.MODERATE,
  });

  const reviewResult = latestReview?.output ?? null;
  const reviewTimestamp = latestReview?.createdAt ?? null;
  const [showReviewDialog, setShowReviewDialog] = useState(false);

  const aiReviewMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/resumes/${resumeId}/ai/review`, {}, { timeout: AI_TIMEOUTS.AI_REQUEST }),
    onSuccess: () => {
      toast.success(t('resume.toast.aiReviewComplete'));
      queryClient.invalidateQueries({ queryKey: ['resume-review', resumeId] });
      setShowReviewDialog(true);
    },
    onError: () => {
      toast.error(t('resume.toast.aiReviewFailed'));
    },
  });

  // ─── Settings Handlers ───
  const handleSettingsChange = useCallback(
    (newSettings: ResumeSettings) => {
      setLocalSettings(newSettings);
      // Debounce server save
      if (settingsDebounceRef.current) clearTimeout(settingsDebounceRef.current);
      settingsDebounceRef.current = setTimeout(() => {
        updateResumeMutation.mutate({ settings: newSettings } as any);
      }, 800);
    },
    [updateResumeMutation]
  );

  const handleSettingsReset = useCallback(() => {
    setLocalSettings({});
    updateResumeMutation.mutate({ settings: {} } as any);
  }, [updateResumeMutation]);

  // Stable settings reference for preview (avoid re-renders on same values)
  const stableSettings = useMemo(
    () => (Object.keys(localSettings).length > 0 ? localSettings : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(localSettings)]
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleSectionContentChange = useCallback(
    (sectionId: string, content: Record<string, unknown>) => {
      // Immediately update local state for instant preview
      setLocalSections((prev) =>
        prev ? prev.map((s) => (s.id === sectionId ? { ...s, content } : s)) : prev
      );
      // Debounce the server save
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateSectionMutation.mutate({ sectionId, data: { content } });
      }, 800);
    },
    [updateSectionMutation]
  );

  const handleVisibilityToggle = useCallback(
    (sectionId: string, isVisible: boolean) => {
      // Immediately update local state
      setLocalSections((prev) =>
        prev ? prev.map((s) => (s.id === sectionId ? { ...s, isVisible } : s)) : prev
      );
      updateSectionMutation.mutate({
        sectionId,
        data: { isVisible },
      });
    },
    [updateSectionMutation]
  );

  const handleTitleSave = () => {
    if (titleRef.current && resume) {
      const newTitle = titleRef.current.value.trim();
      if (newTitle && newTitle !== resume.title) {
        updateResumeMutation.mutate({ title: newTitle } as any);
        toast.success(t('resume.toast.updated'));
      }
    }
    setEditingTitle(false);
  };

  const handleExportPdf = useCallback(async () => {
    try {
      registerFonts();
      const { pdf } = await import('@react-pdf/renderer');
      const { PreviewDocument } =
        await import('@/components/features/resume/resume-preview/preview-renderer');
      const visibleSections = previewSections.filter((s) => s.isVisible);
      const blob = await pdf(
        <PreviewDocument
          sections={visibleSections}
          templateId={resume!.templateId}
          settings={stableSettings}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${resume!.title.replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(t('resume.toast.exported'));
    } catch (err) {
      console.error('PDF export failed:', err);
      toast.error('Export failed');
    }
  }, [previewSections, resume, t]);

  const SECTION_TYPES = [
    'HEADER',
    'EDUCATION',
    'TEST_SCORES',
    'RESEARCH',
    'WORK_EXPERIENCE',
    'PROJECTS',
    'ACTIVITIES',
    'COMMUNITY_SERVICE',
    'AWARDS',
    'SKILLS',
    'PUBLICATIONS',
    'TEACHING',
    'CERTIFICATIONS',
    'CUSTOM',
  ] as const;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingState />
      </div>
    );
  }

  if (!resume) {
    return null;
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Top Bar */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => router.push('/resume')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('resume.back')}
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <Badge variant="outline">{t(`resume.types.${resume.type}`)}</Badge>

        {editingTitle ? (
          <Input
            ref={titleRef}
            defaultValue={resume.title}
            className="h-8 w-64"
            autoFocus
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSave();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
          />
        ) : (
          <button
            className="text-sm font-medium hover:underline"
            onClick={() => setEditingTitle(true)}
          >
            {resume.title}
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => importProfileMutation.mutate()}
            disabled={importProfileMutation.isPending}
          >
            <Import className="mr-1 h-4 w-4" />
            {t('resume.editor.importProfile')}
          </Button>

          <Button variant="outline" size="sm" onClick={() => snapshotMutation.mutate()}>
            <Save className="mr-1 h-4 w-4" />
            {t('resume.editor.snapshot')}
          </Button>

          {/* View last review (when result exists and not running) */}
          {reviewResult && !aiReviewMutation.isPending && (
            <Button variant="outline" size="sm" onClick={() => setShowReviewDialog(true)}>
              <Sparkles className="mr-1 h-4 w-4" />
              {t('resume.editor.viewReview')}
              <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                {latestReview?.overallScore ?? '—'}
              </Badge>
            </Button>
          )}

          {/* Run / re-run AI review */}
          <Button
            variant={reviewResult ? 'ghost' : 'outline'}
            size="sm"
            onClick={() => aiReviewMutation.mutate()}
            disabled={aiReviewMutation.isPending}
          >
            {aiReviewMutation.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-4 w-4" />
            )}
            {aiReviewMutation.isPending
              ? t('resume.editor.aiReviewing')
              : reviewResult
                ? t('resume.editor.reReview')
                : t('resume.editor.aiReview')}
          </Button>

          <Button size="sm" onClick={handleExportPdf}>
            <Download className="mr-1 h-4 w-4" />
            {t('resume.editor.export')}
          </Button>
        </div>
      </div>

      {/* Main Editor: Left panel (sections) + Right panel (preview) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Section editors + Customize panel (40%) */}
        <div className="flex w-2/5 flex-col border-r">
          {/* Template selector */}
          <div className="flex items-center gap-2 border-b px-4 py-2">
            <span className="text-sm text-muted-foreground">{t('resume.editor.template')}:</span>
            <TemplatePicker
              currentTemplateId={resume.templateId}
              resumeType={resume.type}
              onSelect={(templateId) => updateResumeMutation.mutate({ templateId } as any)}
            />
          </div>

          <Tabs defaultValue="sections" className="flex flex-1 flex-col overflow-hidden">
            <TabsList className="mx-4 mt-2 w-auto">
              <TabsTrigger value="sections" className="flex-1">
                <List className="mr-1.5 h-3.5 w-3.5" />
                {t('resume.editor.sections')}
              </TabsTrigger>
              <TabsTrigger value="customize" className="flex-1">
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                {t('resume.customize.title')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sections" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-1 p-4">
                  {/* Sections */}
                  {resume.sections.map((section) => {
                    const isExpanded = expandedSections.has(section.id);
                    return (
                      <div key={section.id} className="rounded-lg border bg-card">
                        <div
                          className="flex cursor-pointer items-center gap-2 p-3"
                          onClick={() => toggleSection(section.id)}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="flex-1 text-sm font-medium">{section.title}</span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVisibilityToggle(section.id, !section.isVisible);
                              }}
                            >
                              {section.isVisible ? (
                                <Eye className="h-3.5 w-3.5" />
                              ) : (
                                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSectionMutation.mutate(section.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t px-3 pb-3 pt-2">
                            <SectionEditor
                              section={section}
                              onChange={(content) =>
                                handleSectionContentChange(section.id, content)
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add Section */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full" size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        {t('resume.editor.addSection')}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      {SECTION_TYPES.map((type) => (
                        <DropdownMenuItem
                          key={type}
                          onClick={() => addSectionMutation.mutate({ type })}
                        >
                          {t(`resume.sections.${type}`)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="customize" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <CustomizePanel
                  settings={localSettings}
                  onChange={handleSettingsChange}
                  onReset={handleSettingsReset}
                  templateId={resume.templateId}
                />
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Preview (60%) */}
        <div className="flex-1">
          <ResumePreview
            sections={previewSections}
            templateId={resume.templateId}
            settings={stableSettings}
            maxPages={resume.type === 'GRADUATE_CV' ? 2 : 1}
          />
        </div>
      </div>

      {/* AI Review Results Dialog */}
      <ReviewDialog
        open={showReviewDialog}
        onOpenChange={setShowReviewDialog}
        result={reviewResult}
        reviewedAt={reviewTimestamp}
        sections={localSections}
        onSectionContentChange={handleSectionContentChange}
        onRerun={() => aiReviewMutation.mutate()}
        isRerunning={aiReviewMutation.isPending}
      />
    </div>
  );
}
