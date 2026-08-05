'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { adminRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { PaginationControls } from '@/app/[locale]/(main)/admin/_components/pagination-controls';
import {
  CheckCircle,
  Clock,
  Loader2,
  FileText,
  Eye,
  Check,
  X,
  Shield,
  Search,
  HeartHandshake,
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
  /** Share consents collected and never honoured — see the card below. */
  unhonouredShareConsents: number;
}

export function EssayCaseReviewManager() {
  const queryClient = useQueryClient();
  const locale = useLocale();
  const t = useTranslations('essayAdmin');

  const PAGE_SIZE = 20;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailCase, setDetailCase] = useState<CaseEssay | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // 获取统计数据
  const { data: stats } = useQuery({
    queryKey: ['adminCaseStats'],
    queryFn: () => apiClient.get<CaseAdminStats>(adminRoutes.casesStats()),
  });

  // 获取待审核列表
  const { data: pendingData, isLoading } = useQuery({
    // Keeps the rows on screen while the next page/filter loads.
    placeholderData: keepPreviousData,
    queryKey: ['pendingEssays', search, page],
    queryFn: () =>
      apiClient.get<{ data: CaseEssay[]; total: number; totalPages?: number }>(
        adminRoutes.casesPendingEssays(),
        {
          params: { pageSize: PAGE_SIZE, page, ...(search && { search }) },
        }
      ),
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
    }) => apiClient.post(adminRoutes.caseReviewEssay(id), { action, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingEssays'] });
      queryClient.invalidateQueries({ queryKey: ['adminCaseStats'] });
      toast.success(t('reviewSuccess'));
      setDetailCase(null);
      setRejectReason('');
    },
  });

  // 批量审核
  const batchReviewMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: 'APPROVE' | 'REJECT' }) =>
      apiClient.post<{ success: number; failed: Array<{ id: string; error: string }> }>(
        adminRoutes.casesBatchVerify(),
        {
          ids,
          action,
        }
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pendingEssays'] });
      queryClient.invalidateQueries({ queryKey: ['adminCaseStats'] });
      toast.success(t('batchVerifySuccess', { count: data.success }));
      setSelectedIds([]);
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        {/* Students who ticked "share with future applicants" and whose case was
            filed invisible anyway. Only counts rows written before the fix, so
            it can only go down — a climb means a new creation path forgets to
            set visibility. Rose when it is non-zero, muted at zero, because at
            zero it is a healthy gauge rather than a to-do. */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HeartHandshake
                className={`h-4 w-4 ${
                  stats?.unhonouredShareConsents ? 'text-rose-500' : 'text-muted-foreground'
                }`}
              />
              {t('caseStats.unhonouredShareConsents')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                stats?.unhonouredShareConsents ? 'text-rose-600' : 'text-muted-foreground'
              }`}
            >
              {stats?.unhonouredShareConsents || 0}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('caseStats.unhonouredShareConsentsHint')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索栏 */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t('searchPlaceholder')}
          className="pl-9"
        />
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
                    <TableCell className="max-w-[400px]">
                      <p
                        className="text-sm line-clamp-3"
                        title={caseItem.essayContent?.substring(0, 300)}
                      >
                        {caseItem.essayContent?.substring(0, 150)}
                        {caseItem.essayContent && caseItem.essayContent.length > 150 ? '...' : ''}
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
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('viewDetail')}
                          onClick={() => setDetailCase(caseItem)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('approve')}
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
                          aria-label={t('reject')}
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

      {/* 分页 */}
      {pendingData && pendingData.total > PAGE_SIZE && (
        <PaginationControls
          page={page}
          totalPages={pendingData.totalPages || Math.ceil(pendingData.total / PAGE_SIZE)}
          total={pendingData.total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      {/* 详情弹窗 */}
      <Dialog open={!!detailCase} onOpenChange={() => setDetailCase(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh]">
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
