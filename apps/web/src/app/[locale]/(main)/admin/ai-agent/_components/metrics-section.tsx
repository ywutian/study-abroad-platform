/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { API_ROUTES } from '@study-abroad/shared';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Gauge, Loader2, RefreshCw } from 'lucide-react';

export function MetricsSection() {
  const t = useTranslations('admin.aiAgent');
  const queryClient = useQueryClient();

  const { data: metrics } = useQuery({
    queryKey: ['aiAgentMetrics'],
    queryFn: () => apiClient.get<any>('/admin/ai-agent/metrics'),
    refetchInterval: 60000,
  });

  const resetMetricsMutation = useMutation({
    mutationFn: () => apiClient.delete(`${API_ROUTES.ADMIN}/ai-agent/metrics`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiAgentMetrics'] });
      toast.success(t('metricsReset'));
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Gauge className="h-5 w-5" />
            <CardTitle className="text-base">{t('metricsTitle')}</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetMetricsMutation.mutate()}
            disabled={resetMetricsMutation.isPending}
          >
            {resetMetricsMutation.isPending ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3 w-3" />
            )}
            {t('resetMetrics')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {metrics ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t('metricRequests')}</p>
              <p className="text-lg font-bold mt-1">
                {(metrics.requests?.total ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t('metricAvgLatency')}</p>
              <p className="text-lg font-bold mt-1">
                {metrics.latency?.total?.count
                  ? `${Math.round(metrics.latency.total.sum / metrics.latency.total.count)}ms`
                  : '0ms'}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t('metricTokens')}</p>
              <p className="text-lg font-bold mt-1">
                {(metrics.tokens?.total ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t('metricErrors')}</p>
              <p className="text-lg font-bold mt-1">
                {(metrics.errors?.total ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t('metricErrorRate')}</p>
              <p className="text-lg font-bold mt-1">
                {metrics.requests?.total
                  ? `${((metrics.errors?.total / metrics.requests.total) * 100).toFixed(1)}%`
                  : '0%'}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t('metricActiveReqs')}</p>
              <p className="text-lg font-bold mt-1">{metrics.system?.activeRequests ?? 0}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t('metricRateLimits')}</p>
              <p className="text-lg font-bold mt-1">
                {(metrics.system?.rateLimitHits ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t('metricPromptTokens')}</p>
              <p className="text-lg font-bold mt-1">
                {(metrics.tokens?.prompt ?? 0).toLocaleString()}
              </p>
            </div>

            {/* Routing Fallback Rate (P2-10) */}
            {(metrics.routing?.fast || metrics.routing?.embedding || metrics.routing?.llm) && (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('metricRoutingFallback')}</p>
                <p className="text-lg font-bold mt-1">
                  {(() => {
                    const total =
                      (metrics.routing?.fast ?? 0) +
                      (metrics.routing?.embedding ?? 0) +
                      (metrics.routing?.llm ?? 0);
                    const fallback = metrics.routing?.llm ?? 0;
                    return total > 0 ? `${((fallback / total) * 100).toFixed(1)}%` : '0%';
                  })()}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  fast: {metrics.routing?.fast ?? 0} · embed: {metrics.routing?.embedding ?? 0} ·
                  llm: {metrics.routing?.llm ?? 0}
                </p>
              </div>
            )}

            {/* Critique Pass Rate (P2-11) */}
            {metrics.critiques?.total > 0 && (
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('metricCritiqueRate')}</p>
                <p className="text-lg font-bold mt-1">
                  {((metrics.critiques.passed / metrics.critiques.total) * 100).toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {metrics.critiques.passed}/{metrics.critiques.total} passed ·{' '}
                  {metrics.critiques.failed} failed
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noMetrics')}</p>
        )}
      </CardContent>
    </Card>
  );
}
