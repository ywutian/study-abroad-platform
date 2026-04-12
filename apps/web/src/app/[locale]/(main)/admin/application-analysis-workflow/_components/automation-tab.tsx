'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  adminRoutes,
  type PaginatedApplicationAnalysisExperimentResponse,
  type PaginatedApplicationAnalysisExperimentSweepResponse,
} from '@study-abroad/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';

import { formatDateTime, getRolloutSnapshot, humanizeEnum } from './utils';

export function AutomationTab() {
  const t = useTranslations('admin.applicationAnalysisWorkflow');
  const queryClient = useQueryClient();
  const [selectedExperimentId, setSelectedExperimentId] = useState('');
  const [rolloutPercentages, setRolloutPercentages] = useState('5, 25, 100');
  const [minStageHours, setMinStageHours] = useState('24');
  const [autoPromote, setAutoPromote] = useState('true');
  const [autoRetire, setAutoRetire] = useState('true');
  const [automationPaused, setAutomationPaused] = useState('false');

  const { data: experimentsData } = useQuery<PaginatedApplicationAnalysisExperimentResponse>({
    queryKey: ['applicationAnalysisExperiments'],
    queryFn: () =>
      apiClient.get(adminRoutes.applicationAnalysisWorkflowExperiments(), {
        params: { page: 1, pageSize: 50 },
      }),
  });
  const { data: sweepsData, isLoading } =
    useQuery<PaginatedApplicationAnalysisExperimentSweepResponse>({
      queryKey: ['applicationAnalysisExperimentSweeps'],
      queryFn: () =>
        apiClient.get(adminRoutes.applicationAnalysisWorkflowExperimentSweeps(), {
          params: { page: 1, pageSize: 20 },
        }),
    });

  const experiments = experimentsData?.items ?? [];
  const selectedExperiment = experiments.find((item) => item.id === selectedExperimentId);

  useEffect(() => {
    if (!selectedExperimentId && experiments[0]) {
      setSelectedExperimentId(experiments[0].id);
      return;
    }
    if (!selectedExperiment) return;
    const snapshot = getRolloutSnapshot(selectedExperiment);
    setRolloutPercentages(snapshot.percentages);
    setMinStageHours(String(snapshot.minStageHours));
    setAutoPromote(String(snapshot.autoPromote));
    setAutoRetire(String(snapshot.autoRetire));
    setAutomationPaused(String(snapshot.automationPaused));
  }, [selectedExperiment, selectedExperimentId, experiments]);

  const patchMutation = useMutation({
    mutationFn: () =>
      apiClient.patch(
        adminRoutes.applicationAnalysisWorkflowExperimentConfig(selectedExperimentId),
        {
          rolloutPercentages: rolloutPercentages
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isFinite(value)),
          minStageHours: Number(minStageHours),
          autoPromote: autoPromote === 'true',
          autoRetire: autoRetire === 'true',
          automationPaused: automationPaused === 'true',
        }
      ),
    onSuccess: () => {
      toast.success(t('automation.configSaved'));
      queryClient.invalidateQueries({ queryKey: ['applicationAnalysisExperiments'] });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('automation.title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>{t('automation.experiment')}</Label>
            <Select value={selectedExperimentId} onValueChange={setSelectedExperimentId}>
              <SelectTrigger>
                <SelectValue placeholder={t('experiments.selectExperiment')} />
              </SelectTrigger>
              <SelectContent>
                {experiments.map((experiment) => (
                  <SelectItem key={experiment.id} value={experiment.id}>
                    {experiment.capability} · {experiment.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('automation.rolloutPercentages')}</Label>
            <Input
              value={rolloutPercentages}
              onChange={(e) => setRolloutPercentages(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('automation.minStageHours')}</Label>
            <Input value={minStageHours} onChange={(e) => setMinStageHours(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('automation.autoPromote')}</Label>
            <Select value={autoPromote} onValueChange={setAutoPromote}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{t('automation.enabled')}</SelectItem>
                <SelectItem value="false">{t('automation.disabled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('automation.autoRetire')}</Label>
            <Select value={autoRetire} onValueChange={setAutoRetire}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">{t('automation.enabled')}</SelectItem>
                <SelectItem value="false">{t('automation.disabled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('automation.paused')}</Label>
            <Select value={automationPaused} onValueChange={setAutomationPaused}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">{t('automation.enabled')}</SelectItem>
                <SelectItem value="true">{t('automation.disabled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {selectedExperiment ? (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground md:col-span-2">
              {t('automation.currentPercentage')}:{' '}
              {getRolloutSnapshot(selectedExperiment).currentPercentage ?? '—'} ·{' '}
              {t('automation.lastSweep')}:{' '}
              {formatDateTime(getRolloutSnapshot(selectedExperiment).lastSweepAt)} ·{' '}
              {t('automation.nextEligiblePromotion')}:{' '}
              {formatDateTime(getRolloutSnapshot(selectedExperiment).nextEligiblePromotionAt)}
            </div>
          ) : null}
          <div className="md:col-span-2 flex justify-end">
            <Button
              onClick={() => patchMutation.mutate()}
              disabled={!selectedExperimentId || patchMutation.isPending}
            >
              {t('automation.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('automation.sweepHistory')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : (
            (sweepsData?.items ?? []).map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {humanizeEnum(item.mode)} · {humanizeEnum(item.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('automation.lastSweep')}:{' '}
                      {formatDateTime(item.finishedAt ?? item.startedAt)}
                    </div>
                  </div>
                  <Badge variant="outline">{item.actorId ?? 'system'}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
