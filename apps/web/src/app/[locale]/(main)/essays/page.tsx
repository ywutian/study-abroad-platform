'use client';

import { useState, useMemo, useRef } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  FileText,
  Pencil,
  Trash2,
  Sparkles,
  Calendar,
  Hash,
  Wand2,
  RefreshCw,
  PenTool,
  ArrowRight,
  ChevronDown,
  Lightbulb,
  HelpCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { AI_TIMEOUTS } from '@/lib/constants';
import { PageContainer, PageHeader } from '@/components/layout';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { AiAssistantPanel } from '@/components/features/agent-chat';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createEssaySchema, type EssayFormData } from '@/lib/validations/essay';
import type {
  Essay,
  EssayReview,
  PolishResult,
  RewriteResult,
  ContinueResult,
  OpeningResult,
} from '@/types/essay';

import { EssayAIDialogs } from './_components/essay-ai-dialogs';
import { EssayFormDialog, EssayDeleteDialog } from './_components/essay-form-dialog';

export default function EssaysPage() {
  const t = useTranslations();
  const fmt = useFormatter();
  const queryClient = useQueryClient();

  const [selectedEssay, setSelectedEssay] = useState<Essay | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [essayToDelete, setEssayToDelete] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewResult, setReviewResult] = useState<EssayReview | null>(null);

  // AI state
  const [isPolishOpen, setIsPolishOpen] = useState(false);
  const [polishResult, setPolishResult] = useState<PolishResult | null>(null);
  const [polishStyle] = useState<'formal' | 'vivid' | 'concise'>('formal');
  const [isRewriteOpen, setIsRewriteOpen] = useState(false);
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const [isContinueOpen, setIsContinueOpen] = useState(false);
  const [continueResult, setContinueResult] = useState<ContinueResult | null>(null);
  const [continueDirection] = useState('');
  const [isOpeningOpen, setIsOpeningOpen] = useState(false);
  const [openingResult, setOpeningResult] = useState<OpeningResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const essayForm = useForm<EssayFormData>({
    resolver: zodResolver(createEssaySchema(t)),
    defaultValues: { title: '', prompt: '', content: '' },
  });

  const randomOffsetsRef = useRef({
    originality: Math.random() * 2,
    impact: Math.random() * 1.5,
    relevance: Math.random() * 1,
  });

  const derivedScores = useMemo(() => {
    if (!reviewResult) return null;
    const offsets = randomOffsetsRef.current;
    return {
      originality: Math.min(10, Math.max(0, reviewResult.overallScore - 1 + offsets.originality)),
      impact: Math.min(10, Math.max(0, reviewResult.overallScore - 0.5 + offsets.impact)),
      relevance: Math.min(10, Math.max(0, reviewResult.overallScore + offsets.relevance)),
    };
  }, [reviewResult]);

  // Queries & Mutations
  const { data: essays, isLoading } = useQuery({
    queryKey: ['essays'],
    queryFn: () => apiClient.get<Essay[]>('/profiles/me/essays'),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; prompt?: string; content: string }) =>
      apiClient.post<Essay>('/profiles/me/essays', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['essays'] });
      setIsFormOpen(false);
      essayForm.reset();
      toast.success(t('essays.toast.saved'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { title: string; prompt?: string; content: string };
    }) => apiClient.put<Essay>(`/profiles/me/essays/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['essays'] });
      setIsFormOpen(false);
      setSelectedEssay(null);
      essayForm.reset();
      toast.success(t('essays.toast.updated'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/profiles/me/essays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['essays'] });
      setIsDeleteOpen(false);
      setEssayToDelete(null);
      if (selectedEssay?.id === essayToDelete) setSelectedEssay(null);
      toast.success(t('essays.toast.deleted'));
    },
  });

  const reviewMutation = useMutation({
    mutationFn: (data: { prompt: string; content: string }) =>
      apiClient.post<EssayReview>('/ai/review-essay', data, { timeout: AI_TIMEOUTS.AI_REQUEST }),
    onSuccess: (data) => {
      setReviewResult(data);
      setIsReviewOpen(true);
    },
  });

  const polishMutation = useMutation({
    mutationFn: (data: { content: string; style?: 'formal' | 'vivid' | 'concise' }) =>
      apiClient.post<PolishResult>('/ai/polish-essay', data, { timeout: AI_TIMEOUTS.AI_REQUEST }),
    onSuccess: (data) => {
      setPolishResult(data);
      setIsPolishOpen(true);
    },
  });

  const rewriteMutation = useMutation({
    mutationFn: (data: { paragraph: string; instruction?: string }) =>
      apiClient.post<RewriteResult>('/ai/rewrite-paragraph', data, {
        timeout: AI_TIMEOUTS.AI_REQUEST,
      }),
    onSuccess: (data) => {
      setRewriteResult(data);
      setIsRewriteOpen(true);
    },
  });

  const continueMutation = useMutation({
    mutationFn: (data: { content: string; prompt?: string; direction?: string }) =>
      apiClient.post<ContinueResult>('/ai/continue-writing', data, {
        timeout: AI_TIMEOUTS.AI_REQUEST,
      }),
    onSuccess: (data) => {
      setContinueResult(data);
      setIsContinueOpen(true);
    },
  });

  const openingMutation = useMutation({
    mutationFn: (data: { prompt: string; background?: string }) =>
      apiClient.post<OpeningResult>('/ai/generate-opening', data, {
        timeout: AI_TIMEOUTS.AI_REQUEST,
      }),
    onSuccess: (data) => {
      setOpeningResult(data);
      setIsOpeningOpen(true);
    },
  });

  // Handlers
  const getWordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

  const handleCreate = () => {
    essayForm.reset({ title: '', prompt: '', content: '' });
    setSelectedEssay(null);
    setIsFormOpen(true);
  };

  const handleEdit = (essay: Essay) => {
    essayForm.reset({ title: essay.title, prompt: essay.prompt || '', content: essay.content });
    setSelectedEssay(essay);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    setEssayToDelete(id);
    setIsDeleteOpen(true);
  };

  const handleSubmit = essayForm.handleSubmit((values) => {
    const data = {
      title: values.title,
      prompt: values.prompt || undefined,
      content: values.content,
    };
    if (selectedEssay) {
      updateMutation.mutate({ id: selectedEssay.id, data });
    } else {
      createMutation.mutate(data);
    }
  });

  const handleReview = (essay: Essay) => {
    if (!essay.content) {
      toast.error(t('essays.toast.contentRequired'));
      return;
    }
    reviewMutation.mutate({ prompt: essay.prompt || essay.title, content: essay.content });
  };

  const handlePolish = (essay: Essay) => {
    if (!essay.content) {
      toast.error(t('essays.toast.contentRequired'));
      return;
    }
    polishMutation.mutate({ content: essay.content, style: polishStyle });
  };

  const handleRewrite = () => {
    if (!selectedText) {
      toast.error(t('essays.toast.selectParagraph'));
      return;
    }
    rewriteMutation.mutate({
      paragraph: selectedText,
      instruction: rewriteInstruction || undefined,
    });
  };

  const handleContinue = (essay: Essay) => {
    if (!essay.content) {
      toast.error(t('essays.toast.contentRequired'));
      return;
    }
    continueMutation.mutate({
      content: essay.content,
      prompt: essay.prompt,
      direction: continueDirection || undefined,
    });
  };

  const handleGenerateOpening = (essay: Essay) => {
    if (!essay.prompt && !essay.title) {
      toast.error(t('essays.toast.promptRequired'));
      return;
    }
    openingMutation.mutate({ prompt: essay.prompt || essay.title });
  };

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success(t('essays.toast.copied'));
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const applyPolishedContent = () => {
    if (polishResult && selectedEssay) {
      essayForm.reset({
        title: selectedEssay.title,
        prompt: selectedEssay.prompt || '',
        content: polishResult.polished,
      });
      setSelectedEssay({ ...selectedEssay, content: polishResult.polished });
      updateMutation.mutate({
        id: selectedEssay.id,
        data: {
          title: selectedEssay.title,
          prompt: selectedEssay.prompt,
          content: polishResult.polished,
        },
      });
      setIsPolishOpen(false);
      toast.success(t('essays.toast.polishApplied'));
    }
  };

  const appendContinuation = () => {
    if (continueResult && selectedEssay) {
      const newContent = selectedEssay.content + '\n\n' + continueResult.continuation;
      updateMutation.mutate({
        id: selectedEssay.id,
        data: { title: selectedEssay.title, prompt: selectedEssay.prompt, content: newContent },
      });
      setIsContinueOpen(false);
      toast.success(t('essays.toast.continuationAdded'));
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={t('essays.title')}
        description={t('essays.description')}
        icon={PenTool}
        color="rose"
        actions={
          <Button
            onClick={handleCreate}
            className="gap-2 bg-destructive hover:opacity-90 text-white shadow-md"
          >
            <Plus className="h-4 w-4" />
            {t('essays.new')}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Essay List */}
        <div className="lg:col-span-1">
          <Card className="overflow-hidden">
            <div className="h-1 bg-destructive" />
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10">
                  <FileText className="h-4 w-4 text-rose-500" />
                </div>
                <CardTitle className="text-lg">{t('essays.list')}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <LoadingState variant="card" count={3} />
              ) : essays && essays.length > 0 ? (
                <ScrollArea className="h-[500px] pr-2">
                  <div className="space-y-2">
                    {essays.map((essay, index) => (
                      <motion.div
                        key={essay.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          'cursor-pointer rounded-xl border p-4 transition-all duration-200',
                          'hover:border-rose-500/40 hover:bg-rose-500/5 hover:shadow-sm',
                          selectedEssay?.id === essay.id &&
                            'border-rose-500 bg-rose-500/5 shadow-sm'
                        )}
                        onClick={() => setSelectedEssay(essay)}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h4 className="font-semibold line-clamp-1">{essay.title}</h4>
                          <Badge variant="info" className="shrink-0">
                            {essay.wordCount || getWordCount(essay.content)} {t('common.words')}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {essay.prompt || essay.content.slice(0, 100)}
                        </p>
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {fmt.dateTime(new Date(essay.updatedAt), 'medium')}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <EmptyState
                  icon={<FileText className="h-12 w-12" />}
                  title={t('essays.empty.title')}
                  description={t('essays.empty.description')}
                  className="py-8"
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Essay Detail */}
        <div className="lg:col-span-2">
          <Card className="h-full overflow-hidden">
            <div className="h-1 bg-primary dark:bg-primary" />
            {selectedEssay ? (
              <>
                <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-xl">{selectedEssay.title}</CardTitle>
                      {selectedEssay.prompt && (
                        <CardDescription className="line-clamp-2">
                          {selectedEssay.prompt}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Sparkles className="mr-1 h-4 w-4" />
                          {t('essays.aiTools')}
                          <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => handleReview(selectedEssay)}
                          disabled={reviewMutation.isPending}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          {t('essays.aiActions.review')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handlePolish(selectedEssay)}
                          disabled={polishMutation.isPending}
                        >
                          <Wand2 className="mr-2 h-4 w-4" />
                          {t('essays.aiActions.polish')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleContinue(selectedEssay)}
                          disabled={continueMutation.isPending}
                        >
                          <ArrowRight className="mr-2 h-4 w-4" />
                          {t('essays.aiActions.continue')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleGenerateOpening(selectedEssay)}
                          disabled={openingMutation.isPending}
                        >
                          <PenTool className="mr-2 h-4 w-4" />
                          {t('essays.aiActions.generateOpening')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            const selection = window.getSelection()?.toString();
                            if (selection) {
                              setSelectedText(selection);
                              setRewriteInstruction('');
                              handleRewrite();
                            } else {
                              toast.error(t('essays.toast.selectParagraph'));
                            }
                          }}
                          disabled={rewriteMutation.isPending}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          {t('essays.aiActions.rewriteSelected')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(selectedEssay)}>
                      <Pencil className="mr-1 h-4 w-4" />
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(selectedEssay.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Hash className="h-4 w-4" />
                      {t('essays.wordCount', {
                        count: selectedEssay.wordCount || getWordCount(selectedEssay.content),
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {t('essays.updatedAt')}{' '}
                      {fmt.dateTime(new Date(selectedEssay.updatedAt), 'medium')}
                    </span>
                  </div>
                  <ScrollArea className="h-[400px] rounded-md border bg-muted/30 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {selectedEssay.content}
                    </p>
                  </ScrollArea>
                </CardContent>
              </>
            ) : (
              <div className="flex h-[500px] flex-col items-center justify-center px-8 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-primary/10 mb-6">
                  <PenTool className="h-10 w-10 text-primary/60" />
                </div>
                <p className="text-lg font-semibold">{t('essays.selectToView')}</p>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                  {t('essays.clickNewToCreate')}
                </p>
                <Button
                  className="mt-6 gap-2 bg-primary dark:bg-primary hover:opacity-90 text-white"
                  onClick={handleCreate}
                >
                  <Plus className="h-4 w-4" />
                  {t('essays.new')}
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      <EssayFormDialog
        isFormOpen={isFormOpen}
        setIsFormOpen={setIsFormOpen}
        selectedEssay={selectedEssay}
        essayForm={essayForm}
        onSubmit={handleSubmit}
        isSaving={createMutation.isPending || updateMutation.isPending}
        getWordCount={getWordCount}
      />

      <EssayDeleteDialog
        isDeleteOpen={isDeleteOpen}
        setIsDeleteOpen={setIsDeleteOpen}
        onConfirmDelete={() => essayToDelete && deleteMutation.mutate(essayToDelete)}
        isDeleting={deleteMutation.isPending}
      />

      <EssayAIDialogs
        selectedEssay={selectedEssay}
        isReviewOpen={isReviewOpen}
        setIsReviewOpen={setIsReviewOpen}
        reviewResult={reviewResult}
        derivedScores={derivedScores}
        onReReview={() => selectedEssay && handleReview(selectedEssay)}
        isPolishOpen={isPolishOpen}
        setIsPolishOpen={setIsPolishOpen}
        polishResult={polishResult}
        onApplyPolish={applyPolishedContent}
        isContinueOpen={isContinueOpen}
        setIsContinueOpen={setIsContinueOpen}
        continueResult={continueResult}
        onAppendContinuation={appendContinuation}
        isOpeningOpen={isOpeningOpen}
        setIsOpeningOpen={setIsOpeningOpen}
        openingResult={openingResult}
        isRewriteOpen={isRewriteOpen}
        setIsRewriteOpen={setIsRewriteOpen}
        rewriteResult={rewriteResult}
        copiedIndex={copiedIndex}
        onCopyToClipboard={copyToClipboard}
      />

      <AiAssistantPanel
        contextTitle={
          selectedEssay
            ? t('essays.aiAssistant.currentEssay', { title: selectedEssay.title })
            : t('essays.aiAssistant.title')
        }
        contextDescription={
          selectedEssay
            ? t('essays.aiAssistant.selectedDesc', { title: selectedEssay.title })
            : t('essays.aiAssistant.defaultDesc')
        }
        contextActions={
          selectedEssay
            ? [
                {
                  id: 'review',
                  icon: <Sparkles className="h-3.5 w-3.5" />,
                  label: t('essays.aiActions.review'),
                  message: t('essays.aiMessages.review', {
                    title: selectedEssay.title,
                    content: selectedEssay.content.slice(0, 500),
                  }),
                },
                {
                  id: 'polish',
                  icon: <Wand2 className="h-3.5 w-3.5" />,
                  label: t('essays.aiActions.polish'),
                  message: t('essays.aiMessages.polish', { title: selectedEssay.title }),
                },
                {
                  id: 'brainstorm',
                  icon: <Lightbulb className="h-3.5 w-3.5" />,
                  label: t('essays.aiActions.brainstorm'),
                  message: selectedEssay.prompt
                    ? t('essays.aiMessages.brainstormWithPrompt', { prompt: selectedEssay.prompt })
                    : t('essays.aiMessages.brainstormWithTitle', { title: selectedEssay.title }),
                },
              ]
            : [
                {
                  id: 'help',
                  icon: <HelpCircle className="h-3.5 w-3.5" />,
                  label: t('essays.aiActions.askQuestion'),
                  message: t('essays.aiActions.askQuestionMessage'),
                },
              ]
        }
        triggerPosition="fixed"
        panelWidth="md"
      />
    </PageContainer>
  );
}
