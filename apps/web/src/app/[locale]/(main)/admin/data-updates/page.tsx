'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/layout';
import { ListSkeleton } from '@/components/ui/loading-state';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import {
  Database,
  Globe,
  Bell,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

interface DataSyncJob {
  id: string;
  name: string;
  description: string;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'failure' | null;
  lastRunMessage: string | null;
  nextScheduledRun?: string | null;
}

export default function AdminDataUpdatesPage() {
  const t = useTranslations('admin.dataUpdates');
  const queryClient = useQueryClient();
  const [triggerLimit, setTriggerLimit] = useState('500');

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['adminDataSyncJobs'],
    queryFn: () => apiClient.get<DataSyncJob[]>('/admin/data-sync/jobs'),
  });

  const triggerMutation = useMutation({
    mutationFn: (payload: { job: string; params?: Record<string, number | string> }) =>
      apiClient.post<{ synced?: number; errors?: number; message?: string }>(
        '/admin/data-sync/trigger',
        payload
      ),
    onSuccess: (_, variables) => {
      toast.success(t('triggerSuccess'));
      queryClient.invalidateQueries({ queryKey: ['adminDataSyncJobs'] });
    },
    onError: () => {
      toast.error(t('triggerError'));
      queryClient.invalidateQueries({ queryKey: ['adminDataSyncJobs'] });
    },
  });

  const JOBS_WITH_LIMIT = ['COLLEGE_SCORECARD', 'URBAN_INSTITUTE', 'BIGFUTURE', 'APPILY'];

  const getJobIcon = (jobId: string) => {
    if (['BIGFUTURE', 'APPILY'].includes(jobId)) return Globe;
    if (['IPEDS_CHECK', 'RANKINGS_REMINDER'].includes(jobId)) return Bell;
    return Database;
  };

  const handleRunNow = (jobId: string) => {
    const params = JOBS_WITH_LIMIT.includes(jobId)
      ? { limit: parseInt(triggerLimit, 10) || 500 }
      : undefined;
    triggerMutation.mutate({ job: jobId, params });
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('title')} description={t('description')} />
        <ListSkeleton count={3} className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(jobs ?? []).map((job) => (
          <Card key={job.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {(() => {
                  const Icon = getJobIcon(job.id);
                  return <Icon className="h-4 w-4" />;
                })()}
                {job.name}
              </CardTitle>
              <CardDescription>{job.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{t('lastRun')}:</span>
                  <span>{formatDate(job.lastRunAt) ?? t('neverRun')}</span>
                </div>
                {job.lastRunStatus != null && (
                  <div className="flex items-center gap-2">
                    {job.lastRunStatus === 'success' ? (
                      <Badge variant="default" className="bg-emerald-600 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {t('success')}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        <XCircle className="h-3 w-3 mr-1" />
                        {t('failure')}
                      </Badge>
                    )}
                  </div>
                )}
                {job.lastRunMessage && (
                  <p className="truncate" title={job.lastRunMessage}>
                    {job.lastRunMessage}
                  </p>
                )}
                {job.nextScheduledRun && (
                  <div className="text-muted-foreground">
                    {t('nextScheduled')}: {job.nextScheduledRun}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 pt-2">
                {JOBS_WITH_LIMIT.includes(job.id) && (
                  <Select value={triggerLimit} onValueChange={setTriggerLimit}>
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder={t('limitPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                      <SelectItem value="1000">1000</SelectItem>
                      <SelectItem value="2000">2000</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <Button
                  size="sm"
                  onClick={() => handleRunNow(job.id)}
                  disabled={triggerMutation.isPending}
                >
                  {triggerMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  {t('runNow')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
