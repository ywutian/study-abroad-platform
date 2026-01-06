'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const { data: essays, isLoading } = useQuery({
    queryKey: ['essays'],
    queryFn: () => apiClient.get<Essay[]>('/profiles/me/essays'),
  });

  // Create essay
  const createMutation = useMutation({
    mutationFn: (data: { title: string; prompt?: string; content: string }) =>
      apiClient.post<Essay>('/profiles/me/essays', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['essays'] });
      setIsFormOpen(false);
      resetForm();
      toast.success('文书已保存');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update essay
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title: string; prompt?: string; content: string } }) =>
      apiClient.put<Essay>(`/profiles/me/essays/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['essays'] });
      setIsFormOpen(false);
      setSelectedEssay(null);
      resetForm();
      toast.success('文书已更新');
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
      toast.success('文书已删除');
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
      toast.error(error.message || 'AI 评估失败');
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
      toast.error(error.message || '润色失败');
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
      toast.error(error.message || '改写失败');
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
      toast.error(error.message || '续写失败');
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
      toast.error(error.message || '生成开头失败');
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
      toast.error('文书内容不能为空');
      return;
    }
    reviewMutation.mutate({
      prompt: essay.prompt || essay.title,
      content: essay.content,
    });
  };

  const handlePolish = (essay: Essay) => {
    if (!essay.content) {
      toast.error('文书内容不能为空');
      return;
    }
    polishMutation.mutate({ content: essay.content, style: polishStyle });
  };

  const handleRewrite = () => {
    if (!selectedText) {
      toast.error('请先选择要改写的段落');
      return;
    }
    rewriteMutation.mutate({ paragraph: selectedText, instruction: rewriteInstruction || undefined });
  };

  const handleContinue = (essay: Essay) => {
    if (!essay.content) {
      toast.error('文书内容不能为空');
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
      toast.error('请先填写文书题目');
      return;
    }
    openingMutation.mutate({ prompt: essay.prompt || essay.title });
  };

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success('已复制到剪贴板');
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
      toast.success('已应用润色内容');
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
      toast.success('续写内容已添加');
    }
  };

  const getWordCount = (text: string) => {
    return text.split(/\s+/).filter(Boolean).length;
  };

  return (
    <PageContainer>
      <PageHeader
        title="我的文书"
        description="管理您的申请文书，使用 AI 获取专业评估"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Essay List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">文书列表</CardTitle>
              <Button size="sm" onClick={handleCreate}>
                <Plus className="mr-1 h-4 w-4" />
                新建
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <LoadingState variant="card" count={3} />
              ) : essays && essays.length > 0 ? (
                <ScrollArea className="h-[500px] pr-2">
                  <div className="space-y-2">
                    {essays.map((essay) => (
                      <div
                        key={essay.id}
                        className={`cursor-pointer rounded-lg border p-3 transition-all hover:border-primary/50 hover:bg-muted/50 ${
                          selectedEssay?.id === essay.id ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => setSelectedEssay(essay)}
                      >
                        <div className="mb-1 flex items-start justify-between">
                          <h4 className="font-medium line-clamp-1">{essay.title}</h4>
                          <Badge variant="secondary" className="ml-2 shrink-0">
                            {essay.wordCount || getWordCount(essay.content)} 词
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {essay.prompt || essay.content.slice(0, 100)}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {format(new Date(essay.updatedAt), 'yyyy-MM-dd HH:mm')}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <EmptyState
                  icon={<FileText className="h-12 w-12" />}
                  title="暂无文书"
                  description="点击右上角「新建」开始写作"
                  className="py-8"
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Essay Detail / Editor */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            {selectedEssay ? (
              <>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle>{selectedEssay.title}</CardTitle>
                    {selectedEssay.prompt && (
                      <CardDescription className="line-clamp-2">{selectedEssay.prompt}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {/* AI 工具下拉菜单 */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Sparkles className="mr-1 h-4 w-4" />
                          AI 工具
                          <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => handleReview(selectedEssay)}
                          disabled={reviewMutation.isPending}
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          文书评估
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handlePolish(selectedEssay)}
                          disabled={polishMutation.isPending}
                        >
                          <Wand2 className="mr-2 h-4 w-4" />
                          AI 润色
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleContinue(selectedEssay)}
                          disabled={continueMutation.isPending}
                        >
                          <ArrowRight className="mr-2 h-4 w-4" />
                          AI 续写
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleGenerateOpening(selectedEssay)}
                          disabled={openingMutation.isPending}
                        >
                          <PenTool className="mr-2 h-4 w-4" />
                          生成开头
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
                              toast.error('请先选中要改写的段落');
                            }
                          }}
                          disabled={rewriteMutation.isPending}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          改写选中段落
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="outline" size="sm" onClick={() => handleEdit(selectedEssay)}>
                      <Pencil className="mr-1 h-4 w-4" />
                      编辑
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
                      {selectedEssay.wordCount || getWordCount(selectedEssay.content)} 词
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      更新于 {format(new Date(selectedEssay.updatedAt), 'yyyy-MM-dd')}
                    </span>
                  </div>
                  <ScrollArea className="h-[400px] rounded-md border bg-muted/30 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedEssay.content}</p>
                  </ScrollArea>
                </CardContent>
              </>
            ) : (
              <div className="flex h-[500px] flex-col items-center justify-center text-muted-foreground">
                <FileText className="mb-4 h-16 w-16 opacity-30" />
                <p className="text-lg font-medium">选择一篇文书查看</p>
                <p className="mt-1 text-sm">或点击"新建"开始创作</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEssay ? '编辑文书' : '新建文书'}</DialogTitle>
            <DialogDescription>
              {selectedEssay ? '修改您的文书内容' : '创建一篇新的申请文书'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>标题</Label>
              <Input
                placeholder="例如：Common App 主文书"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>题目 (Prompt)</Label>
              <Textarea
                placeholder="例如：Describe a challenge you faced and how you overcame it..."
                value={formData.prompt}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>正文</Label>
                <span className="text-xs text-muted-foreground">
                  {getWordCount(formData.content)} 词
                </span>
              </div>
              <Textarea
                placeholder="开始写作..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.title || !formData.content || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Save className="mr-2 h-4 w-4" />
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>此操作不可撤销，文书将被永久删除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => essayToDelete && deleteMutation.mutate(essayToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Review Result Dialog */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI 文书评估
            </DialogTitle>
          </DialogHeader>

          {reviewResult && (
            <div className="space-y-6">
              {/* Overall Score */}
              <div className="text-center">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-3xl font-bold text-primary">{reviewResult.overallScore}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">总体评分 (满分10分)</p>
              </div>

              {/* Detailed Scores */}
              <div className="space-y-4">
                {[
                  { key: 'structure', label: '文章结构' },
                  { key: 'content', label: '内容深度' },
                  { key: 'language', label: '语言表达' },
                ].map((item) => {
                  const score = reviewResult[item.key as keyof EssayReview] as {
                    score: number;
                    feedback: string;
                  };
                  return (
                    <div key={item.key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.label}</span>
                        <Badge variant="secondary">{score.score}/10</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{score.feedback}</p>
                    </div>
                  );
                })}
              </div>

              {/* Suggestions */}
              {reviewResult.suggestions?.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">改进建议</h4>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {reviewResult.suggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-2">
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
            <Button onClick={() => setIsReviewOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 润色结果 Dialog */}
      <Dialog open={isPolishOpen} onOpenChange={setIsPolishOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              AI 润色结果
            </DialogTitle>
            <DialogDescription>
              保持原意的同时提升语言表达质量
            </DialogDescription>
          </DialogHeader>

          {polishResult && (
            <div className="flex-1 overflow-hidden">
              <Tabs defaultValue="result" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="result">润色后文书</TabsTrigger>
                  <TabsTrigger value="changes">修改对比 ({polishResult.changes?.length || 0})</TabsTrigger>
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
                            <Badge variant="outline" className="text-xs">修改 {i + 1}</Badge>
                            <span className="text-xs text-muted-foreground">{change.reason}</span>
                          </div>
                          <div className="grid gap-2 text-sm">
                            <div className="rounded bg-red-50 dark:bg-red-950/30 p-2">
                              <span className="text-xs text-red-600 dark:text-red-400 font-medium">原文:</span>
                              <p className="mt-1 line-through text-muted-foreground">{change.original}</p>
                            </div>
                            <div className="rounded bg-green-50 dark:bg-green-950/30 p-2">
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium">修改后:</span>
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
            <Button variant="outline" onClick={() => setIsPolishOpen(false)}>取消</Button>
            <Button onClick={applyPolishedContent}>
              <Check className="mr-2 h-4 w-4" />
              应用润色结果
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
              AI 续写
            </DialogTitle>
            <DialogDescription>
              根据已有内容智能续写
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
                  <h4 className="mb-2 text-sm font-semibold">后续发展建议</h4>
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
              复制
            </Button>
            <Button onClick={appendContinuation}>
              <Check className="mr-2 h-4 w-4" />
              添加到文书
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
              AI 生成开头
            </DialogTitle>
            <DialogDescription>
              选择一个吸引人的开头
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
            <Button onClick={() => setIsOpeningOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 改写 Dialog */}
      <Dialog open={isRewriteOpen} onOpenChange={setIsRewriteOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              段落改写
            </DialogTitle>
            <DialogDescription>
              选择一个改写版本
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
            <Button onClick={() => setIsRewriteOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

