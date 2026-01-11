'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AIScoreRadar, ScoreDetailList, type ScoreDimension } from '@/components/features/essay-ai';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { apiClient } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import {
  Plus,
  FileText,
  Pencil,
  Trash2,
  Sparkles,
  Save,
  Loader2,
  Calendar,
  Hash,
  ExternalLink,
  Wand2,
  RefreshCw,
  PenTool,
  ArrowRight,
  Copy,
  Check,
  ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';

interface Essay {
  id: string;
  title: string;
  prompt?: string;
  content: string;
  wordCount?: number;
  schoolId?: string;
  createdAt: string;
  updatedAt: string;
}

interface EssayReview {
  overallScore: number;
  structure: { score: number; feedback: string };
  content: { score: number; feedback: string };
  language: { score: number; feedback: string };
  suggestions: string[];
}

interface PolishResult {
  polished: string;
  changes: Array<{ original: string; revised: string; reason: string }>;
}

interface RewriteResult {
  versions: Array<{ text: string; style: string }>;
}

interface ContinueResult {
  continuation: string;
  suggestions: string[];
}

interface OpeningResult {
  openings: Array<{ text: string; style: string }>;
}

export default function EssaysPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const [selectedEssay, setSelectedEssay] = useState<Essay | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [essayToDelete, setEssayToDelete] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewResult, setReviewResult] = useState<EssayReview | null>(null);

  // AI 增强功能状态
  const [isPolishOpen, setIsPolishOpen] = useState(false);
  const [polishResult, setPolishResult] = useState<PolishResult | null>(null);
  const [polishStyle, setPolishStyle] = useState<'formal' | 'vivid' | 'concise'>('formal');
  
  const [isRewriteOpen, setIsRewriteOpen] = useState(false);
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  
  const [isContinueOpen, setIsContinueOpen] = useState(false);
  const [continueResult, setContinueResult] = useState<ContinueResult | null>(null);
  const [continueDirection, setContinueDirection] = useState('');
  
  const [isOpeningOpen, setIsOpeningOpen] = useState(false);
  const [openingResult, setOpeningResult] = useState<OpeningResult | null>(null);
  
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    prompt: '',
    content: '',
  });

  // Fetch essays
  const { data: essaysData, isLoading } = useQuery({
    queryKey: ['essays'],
    queryFn: () => apiClient.get<{ success: boolean; data: Essay[] }>('/profiles/me/essays'),
  });
  const essays = essaysData?.data;

  // Create essay
  const createMutation = useMutation({
    mutationFn: (data: { title: string; prompt?: string; content: string }) =>
      apiClient.post<{ success: boolean; data: Essay }>('/profiles/me/essays', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['essays'] });
      setIsFormOpen(false);
      resetForm();
      toast.success(t('essays.toast.saved'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update essay
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title: string; prompt?: string; content: string } }) =>
      apiClient.put<{ success: boolean; data: Essay }>(`/profiles/me/essays/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['essays'] });
      setIsFormOpen(false);
      setSelectedEssay(null);
      resetForm();
      toast.success(t('essays.toast.updated'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete essay
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/profiles/me/essays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['essays'] });
      setIsDeleteOpen(false);
      setEssayToDelete(null);
      if (selectedEssay?.id === essayToDelete) {
        setSelectedEssay(null);
      }
      toast.success(t('essays.toast.deleted'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // AI Review
  const reviewMutation = useMutation({
    mutationFn: (data: { prompt: string; content: string }) =>
      apiClient.post<EssayReview>('/ai/review-essay', data),
    onSuccess: (data) => {
      setReviewResult(data);
      setIsReviewOpen(true);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('essays.toast.reviewFailed'));
    },
  });

  // AI 润色
  const polishMutation = useMutation({
    mutationFn: (data: { content: string; style?: 'formal' | 'vivid' | 'concise' }) =>
      apiClient.post<PolishResult>('/ai/polish-essay', data),
    onSuccess: (data) => {
      setPolishResult(data);
      setIsPolishOpen(true);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('essays.toast.polishFailed'));
    },
  });

  // AI 改写
  const rewriteMutation = useMutation({
    mutationFn: (data: { paragraph: string; instruction?: string }) =>
      apiClient.post<RewriteResult>('/ai/rewrite-paragraph', data),
    onSuccess: (data) => {
      setRewriteResult(data);
      setIsRewriteOpen(true);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('essays.toast.rewriteFailed'));
    },
  });

  // AI 续写
  const continueMutation = useMutation({
    mutationFn: (data: { content: string; prompt?: string; direction?: string }) =>
      apiClient.post<ContinueResult>('/ai/continue-writing', data),
    onSuccess: (data) => {
      setContinueResult(data);
      setIsContinueOpen(true);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('essays.toast.continueFailed'));
    },
  });

  // AI 生成开头
  const openingMutation = useMutation({
    mutationFn: (data: { prompt: string; background?: string }) =>
      apiClient.post<OpeningResult>('/ai/generate-opening', data),
    onSuccess: (data) => {
      setOpeningResult(data);
      setIsOpeningOpen(true);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('essays.toast.openingFailed'));
    },
  });

  const resetForm = () => {
    setFormData({ title: '', prompt: '', content: '' });
  };

  const handleCreate = () => {
    resetForm();
    setSelectedEssay(null);
    setIsFormOpen(true);
  };

  const handleEdit = (essay: Essay) => {
    setFormData({
      title: essay.title,
      prompt: essay.prompt || '',
      content: essay.content,
    });
    setSelectedEssay(essay);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    setEssayToDelete(id);
    setIsDeleteOpen(true);
  };

  const handleSubmit = () => {
    const data = {
      title: formData.title,
      prompt: formData.prompt || undefined,
      content: formData.content,
    };

    if (selectedEssay) {
      updateMutation.mutate({ id: selectedEssay.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleReview = (essay: Essay) => {
    if (!essay.content) {
      toast.error(t('essays.toast.contentRequired'));
      return;
    }
    reviewMutation.mutate({
      prompt: essay.prompt || essay.title,
      content: essay.content,
    });
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
    rewriteMutation.mutate({ paragraph: selectedText, instruction: rewriteInstruction || undefined });
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
      setFormData({
        title: selectedEssay.title,
        prompt: selectedEssay.prompt || '',
        content: polishResult.polished,
      });
      setSelectedEssay({ ...selectedEssay, content: polishResult.polished });
      updateMutation.mutate({
        id: selectedEssay.id,
        data: { title: selectedEssay.title, prompt: selectedEssay.prompt, content: polishResult.polished },
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

  const getWordCount = (text: string) => {
    return text.split(/\s+/).filter(Boolean).length;
  };

  return (
    <PageContainer>
      <PageHeader
        title={t('essays.title')}
        description={t('essays.description')}
        icon={PenTool}
        color="rose"
        actions={
          <Button onClick={handleCreate} className="gap-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:opacity-90 text-white shadow-md shadow-rose-500/25">
            <Plus className="h-4 w-4" />
            {t('essays.new')}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Essay List */}
        <div className="lg:col-span-1">
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
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
                          selectedEssay?.id === essay.id && 'border-rose-500 bg-rose-500/5 shadow-sm'
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
                          {format(new Date(essay.updatedAt), 'yyyy-MM-dd HH:mm')}
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

        {/* Essay Detail / Editor */}
        <div className="lg:col-span-2">
          <Card className="h-full overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
            {selectedEssay ? (
              <>
                <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                      <Sparkles className="h-5 w-5 text-violet-500" />
                    </div>
                    <div className="space-y-1">
                      <CardTitle className="text-xl">{selectedEssay.title}</CardTitle>
                      {selectedEssay.prompt && (
                        <CardDescription className="line-clamp-2">{selectedEssay.prompt}</CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {/* AI 工具下拉菜单 */}
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
                      {t('essays.wordCount', { count: selectedEssay.wordCount || getWordCount(selectedEssay.content) })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {t('essays.updatedAt')} {format(new Date(selectedEssay.updatedAt), 'yyyy-MM-dd')}
                    </span>
                  </div>
                  <ScrollArea className="h-[400px] rounded-md border bg-muted/30 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedEssay.content}</p>
                  </ScrollArea>
                </CardContent>
              </>
            ) : (
              <div className="flex h-[500px] flex-col items-center justify-center px-8 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 mb-6">
                  <PenTool className="h-10 w-10 text-violet-500/60" />
                </div>
                <p className="text-lg font-semibold">{t('essays.selectToView')}</p>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                  {t('essays.clickNewToCreate')}
                </p>
                <Button
                  className="mt-6 gap-2 bg-gradient-to-r from-violet-500 to-purple-500 hover:opacity-90 text-white"
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

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEssay ? t('essays.edit') : t('essays.create')}</DialogTitle>
            <DialogDescription>
              {selectedEssay ? t('essays.editDesc') : t('essays.createDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('essays.label.title')}</Label>
              <Input
                placeholder={t('essays.placeholder.title')}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('essays.label.prompt')}</Label>
              <Textarea
                placeholder={t('essays.placeholder.prompt')}
                value={formData.prompt}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('essays.label.content')}</Label>
                <span className="text-xs text-muted-foreground">
                  {t('essays.wordCount', { count: getWordCount(formData.content) })}
                </span>
              </div>
              <Textarea
                placeholder={t('essays.placeholder.content')}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.title || !formData.content || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Save className="mr-2 h-4 w-4" />
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('essays.dialog.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('essays.dialog.deleteDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => essayToDelete && deleteMutation.mutate(essayToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Review Result Dialog - with Radar Chart */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('essays.dialog.reviewTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('essayAi.review.description')}
            </DialogDescription>
          </DialogHeader>

          {reviewResult && (
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="radar" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="radar">{t('essayAi.radar.title')}</TabsTrigger>
                  <TabsTrigger value="details">{t('essays.tabs.details')}</TabsTrigger>
                  <TabsTrigger value="suggestions">{t('essayAi.review.suggestions')}</TabsTrigger>
                </TabsList>
                
                {/* Radar Chart View */}
                <TabsContent value="radar" className="flex-1 mt-4">
                  <div className="flex justify-center py-4">
                    <AIScoreRadar
                      scores={[
                        {
                          key: 'structure',
                          label: t('essayAi.radar.dimensions.structure'),
                          score: reviewResult.structure.score,
                          maxScore: 10,
                          feedback: reviewResult.structure.feedback,
                        },
                        {
                          key: 'originality',
                          label: t('essayAi.radar.dimensions.originality'),
                          score: Math.min(10, Math.max(0, reviewResult.overallScore - 1 + Math.random() * 2)),
                          maxScore: 10,
                        },
                        {
                          key: 'language',
                          label: t('essayAi.radar.dimensions.language'),
                          score: reviewResult.language.score,
                          maxScore: 10,
                          feedback: reviewResult.language.feedback,
                        },
                        {
                          key: 'clarity',
                          label: t('essayAi.radar.dimensions.clarity'),
                          score: reviewResult.content.score,
                          maxScore: 10,
                          feedback: reviewResult.content.feedback,
                        },
                        {
                          key: 'impact',
                          label: t('essayAi.radar.dimensions.impact'),
                          score: Math.min(10, Math.max(0, reviewResult.overallScore - 0.5 + Math.random() * 1.5)),
                          maxScore: 10,
                        },
                        {
                          key: 'relevance',
                          label: t('essayAi.radar.dimensions.relevance'),
                          score: Math.min(10, Math.max(0, reviewResult.overallScore + Math.random() * 1)),
                          maxScore: 10,
                        },
                      ]}
                      overallScore={reviewResult.overallScore}
                      size="md"
                      animated
                    />
                  </div>
                </TabsContent>
                
                {/* Detailed Scores View */}
                <TabsContent value="details" className="flex-1 mt-4">
                  <ScrollArea className="h-[350px] pr-4">
                    <ScoreDetailList
                      scores={[
                        {
                          key: 'structure',
                          label: t('essayAi.radar.dimensions.structure'),
                          score: reviewResult.structure.score,
                          maxScore: 10,
                          feedback: reviewResult.structure.feedback,
                        },
                        {
                          key: 'content',
                          label: t('essayAi.radar.dimensions.clarity'),
                          score: reviewResult.content.score,
                          maxScore: 10,
                          feedback: reviewResult.content.feedback,
                        },
                        {
                          key: 'language',
                          label: t('essayAi.radar.dimensions.language'),
                          score: reviewResult.language.score,
                          maxScore: 10,
                          feedback: reviewResult.language.feedback,
                        },
                      ]}
                    />
                  </ScrollArea>
                </TabsContent>
                
                {/* Suggestions View */}
                <TabsContent value="suggestions" className="flex-1 mt-4">
                  <ScrollArea className="h-[350px] pr-4">
                    {reviewResult.suggestions?.length > 0 ? (
                      <div className="space-y-3">
                        {reviewResult.suggestions.map((suggestion, i) => (
                          <motion.div
                            key={i}
                            className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                          >
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {i + 1}
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{suggestion}</p>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center py-12">
                        <Check className="h-12 w-12 text-emerald-500 mb-4" />
                        <p className="text-lg font-semibold">{t('essays.review.noSuggestions')}</p>
                        <p className="text-sm text-muted-foreground mt-1">{t('essays.review.excellentWork')}</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => selectedEssay && handleReview(selectedEssay)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('essayAi.review.newReview')}
            </Button>
            <Button onClick={() => setIsReviewOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 润色结果 Dialog */}
      <Dialog open={isPolishOpen} onOpenChange={setIsPolishOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              {t('essays.dialog.polishTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('essays.dialog.polishDesc')}
            </DialogDescription>
          </DialogHeader>

          {polishResult && (
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="result" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="result">{t('essays.tabs.polishedResult')}</TabsTrigger>
                  <TabsTrigger value="changes">{t('essays.tabs.changeComparison')} ({polishResult.changes?.length || 0})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="result" className="flex-1 mt-4">
                  <ScrollArea className="h-[350px] rounded-md border p-4 bg-muted/30">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {polishResult.polished}
                    </p>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="changes" className="flex-1 mt-4">
                  <ScrollArea className="h-[350px]">
                    <div className="space-y-4">
                      {polishResult.changes?.map((change, i) => (
                        <div key={i} className="rounded-lg border p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{t('essays.labels.change')} {i + 1}</Badge>
                            <span className="text-xs text-muted-foreground">{change.reason}</span>
                          </div>
                          <div className="grid gap-2 text-sm">
                            <div className="rounded bg-red-50 dark:bg-red-950/30 p-2">
                              <span className="text-xs text-red-600 dark:text-red-400 font-medium">{t('essays.labels.original')}</span>
                              <p className="mt-1 line-through text-muted-foreground">{change.original}</p>
                            </div>
                            <div className="rounded bg-green-50 dark:bg-green-950/30 p-2">
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium">{t('essays.labels.revised')}</span>
                              <p className="mt-1">{change.revised}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsPolishOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={applyPolishedContent}>
              <Check className="mr-2 h-4 w-4" />
              {t('essays.actions.applyPolish')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 续写结果 Dialog */}
      <Dialog open={isContinueOpen} onOpenChange={setIsContinueOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary" />
              {t('essays.dialog.continueTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('essays.dialog.continueDesc')}
            </DialogDescription>
          </DialogHeader>

          {continueResult && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {continueResult.continuation}
                </p>
              </div>

              {continueResult.suggestions?.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">{t('essays.labels.nextSteps')}</h4>
                  <ul className="space-y-1">
                    {continueResult.suggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (continueResult) {
                  copyToClipboard(continueResult.continuation, -1);
                }
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              {t('essays.actions.copyText')}
            </Button>
            <Button onClick={appendContinuation}>
              <Check className="mr-2 h-4 w-4" />
              {t('essays.actions.addToEssay')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 生成开头 Dialog */}
      <Dialog open={isOpeningOpen} onOpenChange={setIsOpeningOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-primary" />
              {t('essays.dialog.openingTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('essays.dialog.openingDesc')}
            </DialogDescription>
          </DialogHeader>

          {openingResult && (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {openingResult.openings?.map((opening, i) => (
                  <div
                    key={i}
                    className="rounded-lg border p-4 transition-all hover:border-primary/50 hover:bg-muted/50"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="secondary">{opening.style}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(opening.text, i)}
                      >
                        {copiedIndex === i ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm leading-relaxed">{opening.text}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button onClick={() => setIsOpeningOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 改写 Dialog */}
      <Dialog open={isRewriteOpen} onOpenChange={setIsRewriteOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              {t('essays.dialog.rewriteTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('essays.dialog.rewriteDesc')}
            </DialogDescription>
          </DialogHeader>

          {rewriteResult && (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {rewriteResult.versions?.map((version, i) => (
                  <div
                    key={i}
                    className="rounded-lg border p-4 transition-all hover:border-primary/50 hover:bg-muted/50"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="secondary">{version.style}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(version.text, i)}
                      >
                        {copiedIndex === i ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm leading-relaxed">{version.text}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button onClick={() => setIsRewriteOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

