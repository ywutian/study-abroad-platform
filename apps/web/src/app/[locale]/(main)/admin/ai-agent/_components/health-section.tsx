'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';

export function HealthSection() {
  const t = useTranslations('admin.aiAgent');

  const { data: health } = useQuery({
    queryKey: ['aiAgentHealth'],
    queryFn: () => apiClient.get<any>('/admin/ai-agent/health'),
    refetchInterval: 30000,
  });

  const healthStatus = health?.status || 'unknown';
  const statusColor =
    healthStatus === 'healthy'
      ? 'text-emerald-500'
      : healthStatus === 'degraded'
        ? 'text-amber-500'
        : 'text-red-500';
  const statusDot =
    healthStatus === 'healthy'
      ? 'bg-emerald-500'
      : healthStatus === 'degraded'
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5" />
            <CardTitle className="text-base">{t('healthTitle')}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('h-2.5 w-2.5 rounded-full animate-pulse', statusDot)} />
            <span className={cn('text-sm font-medium', statusColor)}>
              {t(`status.${healthStatus}`)}
            </span>
          </div>
        </div>
      </CardHeader>
      {health?.components && (
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(health.components).map(([name, comp]: [string, any]) => (
              <div key={name} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium capitalize">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('circuitState')}: {comp.circuitState || '-'}
                  </p>
                </div>
                <Badge variant={comp.status === 'up' ? 'success' : 'destructive'}>
                  {comp.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
