'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { adminRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import { Globe, Database, ClipboardCheck, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';

const EssayPipelineDashboard = dynamic(
  () =>
    import('@/components/features/admin/essay-pipeline-dashboard').then(
      (m) => m.EssayPipelineDashboard
    ),
  { ssr: false }
);

interface Props {
  onSwitchTab: (tab: string) => void;
}

const FLOW_STEPS = [
  { key: 'scrape', icon: Globe, color: 'text-blue-600 dark:text-blue-400' },
  { key: 'staging', icon: Database, color: 'text-amber-600 dark:text-amber-400' },
  { key: 'review', icon: ClipboardCheck, color: 'text-violet-600 dark:text-violet-400' },
  { key: 'approved', icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400' },
] as const;

export function DataCollectionTab({ onSwitchTab }: Props) {
  const t = useTranslations('admin.dataReview.pipeline');

  const scrapeMutation = useMutation({
    mutationFn: () => apiClient.post(adminRoutes.essayScraperPipelineStart(), {}),
    onSuccess: () => toast.success(t('scrapeStarted')),
  });

  const syncMutation = useMutation({
    mutationFn: () => apiClient.post(adminRoutes.dataSyncTrigger(), {}),
    onSuccess: () => toast.success(t('syncStarted')),
  });

  return (
    <div className="space-y-6">
      {/* Data flow diagram */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">{t('dataFlow')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 sm:gap-4 py-2">
            {FLOW_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-center gap-2 sm:gap-4">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                      <Icon className={`h-5 w-5 ${step.color}`} />
                    </div>
                    <span className="text-xs text-muted-foreground">{t(step.key)}</span>
                  </div>
                  {idx < FLOW_STEPS.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 -mt-4" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => scrapeMutation.mutate()} disabled={scrapeMutation.isPending}>
          {scrapeMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Globe className="mr-2 h-4 w-4" />
          )}
          {t('startScrape')}
        </Button>
        <Button
          variant="outline"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          {syncMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Database className="mr-2 h-4 w-4" />
          )}
          {t('syncSchools')}
        </Button>
        <Button variant="outline" onClick={() => onSwitchTab('queue')}>
          <ClipboardCheck className="mr-2 h-4 w-4" />
          {t('goToQueue')}
        </Button>
      </div>

      {/* Embedded pipeline dashboard */}
      <EssayPipelineDashboard />
    </div>
  );
}
