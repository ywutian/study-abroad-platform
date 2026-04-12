'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CardSkeleton } from '@/components/ui/loading-state';
import { apiClient } from '@/lib/api';
import { healthRoutes } from '@study-abroad/shared';
import { Database, Server, Cpu, HardDrive, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComponentCheck {
  status: 'ok' | 'error';
  latencyMs?: number;
  lastCheck?: string;
  error?: string;
}

interface DetailedHealthStatus {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  timestamp: string;
  uptime: number;
  memory: { used: number; total: number; percentage: number };
  checks: { database: ComponentCheck; redis?: ComponentCheck };
  env: string;
  nodeVersion: string;
  build: { commitSha: string; buildTime: string; nodeVersion: string };
}

const STATUS_CONFIG = {
  ok: {
    label: 'operational',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    dot: 'bg-emerald-500',
  },
  degraded: {
    label: 'degraded',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    dot: 'bg-amber-500',
  },
  error: {
    label: 'down',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
    dot: 'bg-red-500',
  },
};

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return { days, hours, minutes };
}

export function SystemHealthPanel() {
  const t = useTranslations('admin');

  const { data: health, isLoading } = useQuery<DetailedHealthStatus>({
    queryKey: ['adminHealthDetailed'],
    queryFn: () =>
      apiClient.get<DetailedHealthStatus>(healthRoutes.detailed(), {
        directApi: true,
        skipApiVersion: true,
      }),
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!health) return null;

  const statusConfig = STATUS_CONFIG[health.status];
  const uptime = formatUptime(health.uptime);
  const memUsedMB = Math.round(health.memory.used / 1024 / 1024);
  const memTotalMB = Math.round(health.memory.total / 1024 / 1024);

  return (
    <>
      {/* Auto-refresh indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '3s' }} />
        {t('health.autoRefresh')}
      </div>

      {/* System Status + Uptime */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('health.status')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn('inline-flex items-center gap-2 rounded-lg px-4 py-2', statusConfig.bg)}
            >
              <div className={cn('h-3 w-3 rounded-full', statusConfig.dot)} />
              <span className={cn('text-lg font-semibold', statusConfig.color)}>
                {t(`health.${statusConfig.label}`)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('health.uptime')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{t('health.uptimeDays', uptime)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Component Health */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t('health.components')}
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(health.checks).map(([name, check]) => {
            if (!check) return null;
            const isOk = check.status === 'ok';
            return (
              <Card key={name}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {t(`health.${name as 'database' | 'redis'}`)}
                      </span>
                    </div>
                    <Badge variant={isOk ? 'default' : 'destructive'}>
                      {isOk ? t('health.operational') : t('health.down')}
                    </Badge>
                  </div>
                  {check.latencyMs != null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('health.latency')}</span>
                      <span className="font-mono">
                        {t('health.latencyMs', { ms: check.latencyMs })}
                      </span>
                    </div>
                  )}
                  {check.error && <p className="mt-2 text-sm text-destructive">{check.error}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Memory Usage */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t('health.memoryUsage')}
        </h3>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{t('health.memoryUsage')}</span>
              </div>
              <span className="text-sm font-mono text-muted-foreground">
                {t('health.memoryDetail', { used: memUsedMB, total: memTotalMB })}
              </span>
            </div>
            <Progress value={health.memory.percentage} className="h-2" />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {Math.round(health.memory.percentage)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Info */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t('health.systemInfo')}
        </h3>
        <Card>
          <CardContent className="pt-6">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow
                icon={<Server className="h-4 w-4" />}
                label={t('health.environment')}
                value={health.env}
              />
              <InfoRow
                icon={<Cpu className="h-4 w-4" />}
                label={t('health.nodeVersion')}
                value={health.nodeVersion}
              />
              <InfoRow label={t('health.appVersion')} value={health.version} />
              <InfoRow
                label={t('health.commitSha')}
                value={health.build.commitSha?.slice(0, 7) || '—'}
                mono
              />
              <InfoRow
                label={t('health.buildTime')}
                value={
                  health.build.buildTime ? new Date(health.build.buildTime).toLocaleString() : '—'
                }
              />
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className={cn('text-sm font-medium', mono && 'font-mono')}>{value}</dd>
      </div>
    </div>
  );
}
