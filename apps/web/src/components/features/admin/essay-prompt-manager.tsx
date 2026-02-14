'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api';
import { ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import {
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  FileText,
  Eye,
  Check,
  X,
  Sparkles,
  Globe,
} from 'lucide-react';

interface EssayPrompt {
  id: string;
  schoolId: string;
  year: number;
  type: string;
  prompt: string;
  promptZh?: string;
  wordLimit?: number;
  isRequired: boolean;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'OUTDATED';
  aiTips?: string;
  aiCategory?: string;
  school: {
    id: string;
    name: string;
    nameZh?: string;
    usNewsRank?: number;
  };
  sources?: Array<{
    sourceType: string;
    sourceUrl?: string;
    scrapedAt: string;
  }>;
}

interface EssayStats {
  pending: number;
  verified: number;
  rejected: number;
  total: number;
  byType: Record<string, number>;
}

export function EssayPromptManager() {
  const queryClient = useQueryClient();
  const locale = useLocale();
  const t = useTranslations('essayAdmin');

  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailPrompt, setDetailPrompt] = useState<EssayPrompt | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // 获取统计数据
  const { data: stats } = useQuery({
    queryKey: ['essayPromptStats'],
    queryFn: () => apiClient.get<EssayStats>('/admin/essay-prompts/stats'),
  });

  // 获取文书列表
  const { data: essaysData, isLoading } = useQuery({
    queryKey: ['essayPrompts', statusFilter, typeFilter, searchQuery],
    queryFn: () =>
      apiClient.get<{ data: EssayPrompt[]; total: number }>('/admin/essay-prompts', {
        params: {
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          type: typeFilter !== 'ALL' ? typeFilter : undefined,
          search: searchQuery || undefined,
          pageSize: 50,
        },
      }),
  });

  // 审核单个
  const verifyMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      apiClient.post(`/admin/essay-prompts/${id}/verify`, { status, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['essayPrompts'] });
      queryClient.invalidateQueries({ queryKey: ['essayPromptStats'] });
      toast.success(t('verifySuccess'));
      setDetailPrompt(null);
      setRejectReason('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 批量审核
  const batchVerifyMutation = useMutation({
    mutationFn: ({ ids, status, reason }: { ids: string[]; status: string; reason?: string }) =>
      apiClient.post<{ success: number; failed: any[] }>('/admin/essay-prompts/batch-verify', {
        ids,
        status,
        reason,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['essayPrompts'] });
      queryClient.invalidateQueries({ queryKey: ['essayPromptStats'] });
      toast.success(t('batchVerifySuccess', { count: data.success }));
      setSelectedIds([]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 触发爬取
  const scrapeMutation = useMutation({
    mutationFn: () => apiClient.post<any[]>('/admin/essay-scraper/scrape-all'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['essayPrompts'] });
      queryClient.invalidateQueries({ queryKey: ['essayPromptStats'] });
      const successCount = data.filter((r: any) => r.success).length;
      toast.success(t('scrapeSuccess', { success: successCount, total: data.length }));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('scrapeFailed'));
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="warning" className="gap-1">
            <Clock className="h-3 w-3" />
            {t('status.pending')}
          </Badge>
        );
      case 'VERIFIED':
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            {t('status.verified')}
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            {t('status.rejected')}
          </Badge>
        );
      case 'OUTDATED':
        return (
          <Badge variant="secondary" className="gap-1">
            {t('status.outdated')}
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      COMMON_APP: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      SUPPLEMENTAL: 'bg-primary/10 text-primary border-violet-500/20',
      WHY_SCHOOL: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      ACTIVITY: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      SHORT_ANSWER: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
      OPTIONAL: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
    };
    return (
      <Badge variant="outline" className={colors[type] || ''}>
        {type}
      </Badge>
    );
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === essaysData?.data?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(essaysData?.data?.map((e) => e.id) || []);
    }
  };

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              {t('status.pending')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{stats?.pending || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              {t('status.verified')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{stats?.verified || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              {t('status.rejected')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats?.rejected || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              {t('total')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats?.total || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* 操作栏 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder={t('status.label')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('status.all')}</SelectItem>
              <SelectItem value="PENDING">{t('status.pending')}</SelectItem>
              <SelectItem value="VERIFIED">{t('status.verified')}</SelectItem>
              <SelectItem value="REJECTED">{t('status.rejected')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder={t('type.label')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('type.all')}</SelectItem>
              <SelectItem value="SUPPLEMENTAL">SUPPLEMENTAL</SelectItem>
              <SelectItem value="WHY_SCHOOL">WHY_SCHOOL</SelectItem>
              <SelectItem value="SHORT_ANSWER">SHORT_ANSWER</SelectItem>
              <SelectItem value="ACTIVITY">ACTIVITY</SelectItem>
              <SelectItem value="OPTIONAL">OPTIONAL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => scrapeMutation.mutate()}
            disabled={scrapeMutation.isPending}
          >
            {scrapeMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Globe className="mr-2 h-4 w-4" />
            )}
            {t('scrapeData')}
          </Button>
          {selectedIds.length > 0 && (
            <>
              <Button
                variant="default"
                onClick={() => batchVerifyMutation.mutate({ ids: selectedIds, status: 'VERIFIED' })}
                disabled={batchVerifyMutation.isPending}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                <Check className="mr-2 h-4 w-4" />
                {t('batchApprove', { count: selectedIds.length })}
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  batchVerifyMutation.mutate({
                    ids: selectedIds,
                    status: 'REJECTED',
                    reason: t('batchRejectReason'),
                  })
                }
                disabled={batchVerifyMutation.isPending}
              >
                <X className="mr-2 h-4 w-4" />
                {t('batchReject')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 文书列表 */}
      {isLoading ? (
        <ListSkeleton count={5} />
      ) : essaysData?.data && essaysData.data.length > 0 ? (
        <Card>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={
                        selectedIds.length === essaysData.data.length && essaysData.data.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-[60px]">{t('rank')}</TableHead>
                  <TableHead>{t('school')}</TableHead>
                  <TableHead>{t('type.label')}</TableHead>
                  <TableHead className="max-w-[300px]">{t('prompt')}</TableHead>
                  <TableHead>{t('wordCount')}</TableHead>
                  <TableHead>{t('status.label')}</TableHead>
                  <TableHead className="w-[100px]">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {essaysData.data.map((essay) => (
                  <TableRow key={essay.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(essay.id)}
                        onCheckedChange={() => toggleSelect(essay.id)}
                      />
                    </TableCell>
                    <TableCell>
                      {essay.school.usNewsRank ? (
                        <Badge variant="outline">#{essay.school.usNewsRank}</Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">
                          {getLocalizedName(essay.school.nameZh, essay.school.name, locale)}
                        </div>
                        {locale === 'zh' &&
                          essay.school.nameZh &&
                          essay.school.name &&
                          essay.school.nameZh !== essay.school.name && (
                            <div className="text-xs text-muted-foreground">{essay.school.name}</div>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(essay.type)}</TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="text-sm line-clamp-2">{essay.prompt}</p>
                      {essay.promptZh && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                          {essay.promptZh}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{essay.wordLimit ? `${essay.wordLimit}` : '-'}</TableCell>
                    <TableCell>{getStatusBadge(essay.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDetailPrompt(essay)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {essay.status === 'PENDING' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                verifyMutation.mutate({ id: essay.id, status: 'VERIFIED' })
                              }
                              className="text-emerald-500 hover:text-emerald-600"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDetailPrompt(essay)}
                              className="text-red-500 hover:text-red-600"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      ) : (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      )}

      {/* 详情弹窗 */}
      <Dialog open={!!detailPrompt} onOpenChange={() => setDetailPrompt(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('essayDetail')}
            </DialogTitle>
            <DialogDescription>
              {getLocalizedName(detailPrompt?.school.nameZh, detailPrompt?.school.name, locale)} ·{' '}
              {detailPrompt?.year}
            </DialogDescription>
          </DialogHeader>

          {detailPrompt && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {getTypeBadge(detailPrompt.type)}
                {getStatusBadge(detailPrompt.status)}
                {detailPrompt.isRequired ? (
                  <Badge variant="outline">{t('required')}</Badge>
                ) : (
                  <Badge variant="secondary">{t('optional')}</Badge>
                )}
                {detailPrompt.wordLimit && (
                  <Badge variant="outline">
                    {t('wordCountBadge', { count: detailPrompt.wordLimit })}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">{t('englishOriginal')}</h4>
                <p className="text-sm bg-muted p-3 rounded-lg">{detailPrompt.prompt}</p>
              </div>

              {detailPrompt.promptZh && (
                <div className="space-y-2">
                  <h4 className="font-medium">{t('chineseTranslation')}</h4>
                  <p className="text-sm bg-muted p-3 rounded-lg">{detailPrompt.promptZh}</p>
                </div>
              )}

              {detailPrompt.aiTips && (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    {t('aiWritingTips')}
                  </h4>
                  <p className="text-sm bg-amber-500/10 p-3 rounded-lg">{detailPrompt.aiTips}</p>
                </div>
              )}

              {detailPrompt.sources && detailPrompt.sources.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">{t('dataSources')}</h4>
                  <div className="flex flex-wrap gap-2">
                    {detailPrompt.sources.map((source, i) => (
                      <Badge key={i} variant="outline">
                        {source.sourceType}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {detailPrompt.status === 'PENDING' && (
                <div className="space-y-2">
                  <h4 className="font-medium">{t('rejectReasonLabel')}</h4>
                  <Textarea
                    placeholder={t('rejectReasonPlaceholder')}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailPrompt(null)}>
              {t('close')}
            </Button>
            {detailPrompt?.status === 'PENDING' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() =>
                    verifyMutation.mutate({
                      id: detailPrompt.id,
                      status: 'REJECTED',
                      reason: rejectReason || t('defaultRejectReason'),
                    })
                  }
                  disabled={verifyMutation.isPending}
                >
                  {verifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('reject')}
                </Button>
                <Button
                  onClick={() => verifyMutation.mutate({ id: detailPrompt.id, status: 'VERIFIED' })}
                  disabled={verifyMutation.isPending}
                  className="bg-emerald-500 hover:bg-emerald-600"
                >
                  {verifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('approve')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
