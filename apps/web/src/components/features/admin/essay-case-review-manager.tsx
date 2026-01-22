'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
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
import { toast } from 'sonner';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  FileText,
  Eye,
  Check,
  X,
  Shield,
} from 'lucide-react';

interface CaseEssay {
  id: string;
  schoolId: string;
  year: number;
  round?: string;
  result: string;
  major?: string;
  essayType?: string;
  essayPrompt?: string;
  essayContent?: string;
  isVerified: boolean;
  visibility: string;
  createdAt: string;
  school: {
    id: string;
    name: string;
    nameZh?: string;
  };
}

interface CaseAdminStats {
  total: number;
  withEssay: number;
  verified: number;
  pendingEssays: number;
}

export function EssayCaseReviewManager() {
  const queryClient = useQueryClient();
  const locale = useLocale();
  const t = useTranslations('essayAdmin');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailCase, setDetailCase] = useState<CaseEssay | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // 获取统计数据
  const { data: stats } = useQuery({
    queryKey: ['adminCaseStats'],
    queryFn: () => apiClient.get<CaseAdminStats>('/admin/cases/stats'),
  });

  // 获取待审核列表
  const { data: pendingData, isLoading } = useQuery({
    queryKey: ['pendingEssays'],
    queryFn: () =>
      apiClient.get<{ data: CaseEssay[]; total: number }>('/admin/cases/pending-essays', {
        params: { pageSize: 50 },
      }),
  });

  // 审核单个
  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: 'APPROVE' | 'REJECT';
      reason?: string;
    }) => apiClient.post(`/admin/cases/${id}/review-essay`, { action, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingEssays'] });
      queryClient.invalidateQueries({ queryKey: ['adminCaseStats'] });
      toast.success(t('reviewSuccess'));
      setDetailCase(null);
      setRejectReason('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // 批量审核
  const batchReviewMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: 'APPROVE' | 'REJECT' }) =>
      apiClient.post<{ success: number; failed: any[] }>('/admin/cases/batch-verify', {
        ids,
        action,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pendingEssays'] });
      queryClient.invalidateQueries({ queryKey: ['adminCaseStats'] });
      toast.success(t('batchVerifySuccess', { count: data.success }));
      setSelectedIds([]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'ADMITTED':
        return <Badge variant="success">{t('admitted')}</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">{t('rejected')}</Badge>;
      case 'WAITLISTED':
        return <Badge variant="warning">{t('waitlisted')}</Badge>;
      default:
        return <Badge>{result}</Badge>;
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === pendingData?.data?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingData?.data?.map((c) => c.id) || []);
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
              {t('caseStats.pending')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{stats?.pendingEssays || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              {t('caseStats.verified')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{stats?.verified || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              {t('caseStats.withEssay')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats?.withEssay || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-500" />
              {t('caseStats.total')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-violet-600">{stats?.total || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* 批量操作 */}
      {selectedIds.length > 0 && (
        <div className="flex gap-2">
          <Button
            variant="default"
            onClick={() =>
              batchReviewMutation.mutate({
                ids: selectedIds,
                action: 'APPROVE',
              })
            }
            disabled={batchReviewMutation.isPending}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            <Check className="mr-2 h-4 w-4" />
            {t('batchApprove', { count: selectedIds.length })}
          </Button>
          <Button
            variant="destructive"
            onClick={() =>
              batchReviewMutation.mutate({
                ids: selectedIds,
                action: 'REJECT',
              })
            }
            disabled={batchReviewMutation.isPending}
          >
            <X className="mr-2 h-4 w-4" />
            {t('batchReject')}
          </Button>
        </div>
      )}

      {/* 待审核列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : pendingData?.data && pendingData.data.length > 0 ? (
        <Card>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={
                        selectedIds.length === pendingData.data.length &&
                        pendingData.data.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>{t('school')}</TableHead>
                  <TableHead>{t('caseResult')}</TableHead>
                  <TableHead>{t('essayType')}</TableHead>
                  <TableHead>{t('essayPreview')}</TableHead>
                  <TableHead>{t('wordCount')}</TableHead>
                  <TableHead>{t('submittedAt')}</TableHead>
                  <TableHead className="w-[100px]">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingData.data.map((caseItem) => (
                  <TableRow key={caseItem.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(caseItem.id)}
                        onCheckedChange={() => toggleSelect(caseItem.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">
                          {getLocalizedName(caseItem.school.nameZh, caseItem.school.name, locale)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {caseItem.year}
                          {caseItem.round ? ` · ${caseItem.round}` : ''}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getResultBadge(caseItem.result)}</TableCell>
                    <TableCell>
                      {caseItem.essayType ? (
                        <Badge variant="outline">{caseItem.essayType}</Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      <p className="text-sm line-clamp-2">
                        {caseItem.essayContent?.substring(0, 100)}...
                      </p>
                    </TableCell>
                    <TableCell>
                      {caseItem.essayContent ? caseItem.essayContent.split(/\s+/).length : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(caseItem.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDetailCase(caseItem)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            reviewMutation.mutate({
                              id: caseItem.id,
                              action: 'APPROVE',
                            })
                          }
                          className="text-emerald-500 hover:text-emerald-600"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDetailCase(caseItem)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      ) : (
        <Card className="py-12">
          <div className="text-center text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
            <p className="font-medium">{t('noPendingEssays')}</p>
            <p className="text-sm mt-1">{t('noPendingEssaysDesc')}</p>
          </div>
        </Card>
      )}

      {/* 详情弹窗 */}
      <Dialog open={!!detailCase} onOpenChange={() => setDetailCase(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('essayCaseDetail')}
            </DialogTitle>
            <DialogDescription>
              {detailCase &&
                getLocalizedName(detailCase.school.nameZh, detailCase.school.name, locale)}{' '}
              · {detailCase?.year} {detailCase?.round}
            </DialogDescription>
          </DialogHeader>

          {detailCase && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div className="flex gap-2 flex-wrap">
                  {getResultBadge(detailCase.result)}
                  {detailCase.essayType && <Badge variant="outline">{detailCase.essayType}</Badge>}
                  {detailCase.major && <Badge variant="secondary">{detailCase.major}</Badge>}
                </div>

                {detailCase.essayPrompt && (
                  <div className="space-y-2">
                    <h4 className="font-medium">{t('essayPromptLabel')}</h4>
                    <p className="text-sm bg-muted p-3 rounded-lg">{detailCase.essayPrompt}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="font-medium">
                    {t('essayContentLabel')} ({detailCase.essayContent?.split(/\s+/).length || 0}{' '}
                    words)
                  </h4>
                  <div className="text-sm bg-muted p-4 rounded-lg whitespace-pre-wrap leading-relaxed">
                    {detailCase.essayContent}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">{t('rejectReasonLabel')}</h4>
                  <Textarea
                    placeholder={t('rejectReasonPlaceholder')}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailCase(null)}>
              {t('close')}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                detailCase &&
                reviewMutation.mutate({
                  id: detailCase.id,
                  action: 'REJECT',
                  reason: rejectReason,
                })
              }
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('reject')}
            </Button>
            <Button
              onClick={() =>
                detailCase &&
                reviewMutation.mutate({
                  id: detailCase.id,
                  action: 'APPROVE',
                })
              }
              disabled={reviewMutation.isPending}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {reviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
