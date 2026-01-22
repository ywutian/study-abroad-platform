'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { PageHeader } from '@/components/layout';
import { CardSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, Clock, Loader2 } from 'lucide-react';

interface Report {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  detail?: string;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED';
  context?: any;
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
  reporter: {
    id: string;
    email: string;
    role: string;
  };
}

export default function AdminReportsPage() {
  const t = useTranslations('admin');
  const fmt = useFormatter();
  const queryClient = useQueryClient();

  const [reportFilter, setReportFilter] = useState('PENDING');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [reportToResolve, setReportToResolve] = useState<Report | null>(null);
  const [resolutionText, setResolutionText] = useState('');

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['adminReports', reportFilter, page],
    queryFn: () =>
      apiClient.get<{ data: Report[]; total: number; totalPages: number }>('/admin/reports', {
        params: { status: reportFilter, page, pageSize },
      }),
  });

  const updateReportMutation = useMutation({
    mutationFn: ({ id, status, resolution }: { id: string; status: string; resolution?: string }) =>
      apiClient.put(`/admin/reports/${id}`, { status, resolution }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReports'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setReportToResolve(null);
      setResolutionText('');
      toast.success(t('toast.reportResolved'));
    },
    onError: (error: Error) => {
      toast.error(error.message);
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
      case 'REVIEWED':
        return (
          <Badge variant="info" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            {t('status.reviewed')}
          </Badge>
        );
      case 'RESOLVED':
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            {t('status.resolved')}
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTargetTypeName = (type: string) => {
    const key = `targetTypes.${type.toLowerCase()}` as any;
    return t.has(key) ? t(key) : type;
  };

  return (
    <>
      <PageHeader
        title={t('sidebar.reports')}
        description={t('reports.pageDesc')}
        icon={AlertTriangle}
        color="amber"
      />

      <div className="mt-6">
        <div className="mb-4 flex items-center gap-4">
          <Select
            value={reportFilter}
            onValueChange={(v) => {
              setReportFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('status.pending')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">{t('status.pending')}</SelectItem>
              <SelectItem value="REVIEWED">{t('status.reviewed')}</SelectItem>
              <SelectItem value="RESOLVED">{t('status.resolved')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : reportsData?.data && reportsData.data.length > 0 ? (
          <>
            <div className="space-y-4">
              {reportsData.data.map((report) => (
                <Card key={report.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(report.status)}
                          <Badge variant="outline">{getTargetTypeName(report.targetType)}</Badge>
                        </div>
                        <p className="font-medium">{report.reason}</p>
                        {report.detail && (
                          <p className="text-sm text-muted-foreground">{report.detail}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {t('reports.reporter')}: {report.reporter.email} ·{' '}
                          {fmt.dateTime(new Date(report.createdAt), 'medium')}
                        </p>
                        {report.resolution && (
                          <p className="text-xs text-muted-foreground">
                            {t('dialogs.resolutionLabel')}: {report.resolution}
                          </p>
                        )}
                      </div>
                      {report.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateReportMutation.mutate({ id: report.id, status: 'REVIEWED' })
                            }
                          >
                            {t('reports.markReviewed')}
                          </Button>
                          <Button size="sm" onClick={() => setReportToResolve(report)}>
                            {t('reports.resolve')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <PaginationControls
              page={page}
              totalPages={reportsData.totalPages ?? 1}
              total={reportsData.total ?? 0}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            icon={<AlertTriangle className="h-12 w-12" />}
            title={t('reports.empty')}
            description={t('reports.emptyDesc')}
          />
        )}
      </div>

      {/* Resolve Report Dialog */}
      <AlertDialog
        open={!!reportToResolve}
        onOpenChange={() => {
          setReportToResolve(null);
          setResolutionText('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dialogs.resolveReport')}</AlertDialogTitle>
            <AlertDialogDescription>{t('dialogs.resolveReportDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder={t('dialogs.resolutionPlaceholder')}
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialogs.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                reportToResolve &&
                updateReportMutation.mutate({
                  id: reportToResolve.id,
                  status: 'RESOLVED',
                  resolution: resolutionText || t('dialogs.defaultResolution'),
                })
              }
            >
              {updateReportMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('dialogs.resolveConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
