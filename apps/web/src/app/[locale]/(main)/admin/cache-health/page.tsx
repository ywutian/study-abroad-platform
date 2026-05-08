'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Clock,
  Database,
  Loader2,
  RefreshCw,
  Server,
  Trash2,
  Zap,
} from 'lucide-react';
import { adminRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api';
import { PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CardSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';

import { type CacheHealthSnapshot, formatPercent, formatRelativeTime } from './_components/types';

export default function AdminCacheHealthPage() {
  const t = useTranslations('admin.cacheHealth');
  const tc = useTranslations('common');
  const format = useFormatter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery<CacheHealthSnapshot>({
    queryKey: ['adminCacheHealth'],
    queryFn: () => apiClient.get(adminRoutes.cacheHealth()),
    // Refresh every 10s while page is open — surfaces quota issues live
    refetchInterval: 10_000,
  });

  const resetMutation = useMutation({
    mutationFn: () => apiClient.delete<{ reset: true }>(adminRoutes.cacheHealth()),
    onSuccess: () => {
      toast.success(t('resetSuccess'));
      queryClient.invalidateQueries({ queryKey: ['adminCacheHealth'] });
    },
    onError: () => toast.error(tc('error')),
  });

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={Activity}
        color="emerald"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t('refresh')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {t('reset')}
            </Button>
          </div>
        }
      />

      <div className="mt-6 space-y-6">
        {isLoading ? (
          <CardSkeleton />
        ) : isError || !data ? (
          <EmptyState
            type="error"
            title={t('loadError')}
            description={t('loadErrorDesc')}
            action={{ label: tc('retry'), onClick: () => refetch() }}
          />
        ) : (
          <>
            {/* Connection + summary */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                icon={Server}
                label={t('summary.connection')}
                value={
                  data.connection.connected ? t('summary.connected') : t('summary.disconnected')
                }
                tone={data.connection.connected ? 'success' : 'destructive'}
                hint={
                  data.connection.latencyMs != null
                    ? t('summary.latencyHint', {
                        ms: data.connection.latencyMs,
                      })
                    : (data.connection.message ?? '')
                }
              />
              <SummaryCard
                icon={Database}
                label={t('summary.totalOps')}
                value={format.number(data.totals.totalOps, 'standard')}
                tone="default"
                hint={t('summary.uptimeHint', {
                  uptime: formatRelativeTime(data.uptimeMs),
                })}
              />
              <SummaryCard
                icon={Zap}
                label={t('summary.hitRatio')}
                value={
                  data.totals.overallHitRatio != null
                    ? formatPercent(data.totals.overallHitRatio)
                    : '—'
                }
                tone={
                  data.totals.overallHitRatio == null
                    ? 'default'
                    : data.totals.overallHitRatio >= 0.7
                      ? 'success'
                      : data.totals.overallHitRatio >= 0.4
                        ? 'warning'
                        : 'destructive'
                }
                hint={t('summary.hitRatioHint', {
                  hits: data.totals.totalHits,
                  misses: data.totals.totalMisses,
                })}
              />
              <SummaryCard
                icon={AlertTriangle}
                label={t('summary.errorRate')}
                value={formatPercent(data.totals.errorRate)}
                tone={
                  data.totals.errorRate >= 0.05
                    ? 'destructive'
                    : data.totals.errorRate >= 0.01
                      ? 'warning'
                      : 'success'
                }
                hint={t('summary.errorsHint', {
                  count: data.totals.totalErrors,
                })}
              />
            </div>

            {/* Quota warning banner */}
            {(data.errorsByKind.quota_exceeded ?? 0) > 0 && (
              <Card className="border-destructive/40 bg-destructive/10">
                <CardContent className="flex items-start gap-3 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive shrink-0" />
                  <div>
                    <p className="font-medium text-destructive">
                      {t('alerts.quotaExceeded.title')}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('alerts.quotaExceeded.body', {
                        count: data.errorsByKind.quota_exceeded ?? 0,
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Operations breakdown */}
            <Card>
              <CardContent className="p-0">
                <div className="border-b p-4">
                  <h2 className="text-base font-semibold">{t('ops.title')}</h2>
                  <p className="text-sm text-muted-foreground">{t('ops.description')}</p>
                </div>
                {data.ops.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground">{t('ops.empty')}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('ops.cols.kind')}</TableHead>
                        <TableHead className="text-right">{t('ops.cols.count')}</TableHead>
                        <TableHead className="text-right">{t('ops.cols.errors')}</TableHead>
                        <TableHead className="text-right">{t('ops.cols.hitRatio')}</TableHead>
                        <TableHead className="text-right">{t('ops.cols.avgMs')}</TableHead>
                        <TableHead className="text-right">{t('ops.cols.p95Ms')}</TableHead>
                        <TableHead className="text-right">{t('ops.cols.p99Ms')}</TableHead>
                        <TableHead className="text-right">{t('ops.cols.maxMs')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.ops.map((op) => (
                        <TableRow key={op.kind}>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {op.kind}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {format.number(op.count, 'standard')}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {op.errorCount > 0 ? (
                              <span className="text-destructive font-medium">{op.errorCount}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {op.hitRatio != null ? formatPercent(op.hitRatio) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {op.avgLatencyMs.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {op.p95LatencyMs}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {op.p99LatencyMs}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {op.maxLatencyMs}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Hot key prefixes */}
            <Card>
              <CardContent className="p-0">
                <div className="border-b p-4">
                  <h2 className="text-base font-semibold">{t('hotKeys.title')}</h2>
                  <p className="text-sm text-muted-foreground">{t('hotKeys.description')}</p>
                </div>
                {data.hotKeys.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground">{t('hotKeys.empty')}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('hotKeys.cols.prefix')}</TableHead>
                        <TableHead className="text-right">{t('hotKeys.cols.count')}</TableHead>
                        <TableHead className="text-right">{t('hotKeys.cols.lastSeen')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.hotKeys.map((k) => (
                        <TableRow key={k.prefix}>
                          <TableCell className="font-mono text-sm">{k.prefix}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {format.number(k.count, 'standard')}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            <Clock className="inline mr-1 h-3 w-3" />
                            {format.relativeTime(new Date(k.lastSeen))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Recent errors */}
            {data.recentErrors.length > 0 && (
              <Card>
                <CardContent className="p-0">
                  <div className="border-b p-4">
                    <h2 className="text-base font-semibold">{t('errors.title')}</h2>
                    <p className="text-sm text-muted-foreground">{t('errors.description')}</p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('errors.cols.time')}</TableHead>
                        <TableHead>{t('errors.cols.kind')}</TableHead>
                        <TableHead>{t('errors.cols.op')}</TableHead>
                        <TableHead>{t('errors.cols.key')}</TableHead>
                        <TableHead>{t('errors.cols.message')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentErrors.map((err, idx) => (
                        <TableRow key={`${err.timestamp}-${idx}`}>
                          <TableCell className="text-sm text-muted-foreground tabular-nums">
                            {format.relativeTime(new Date(err.timestamp))}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={err.kind === 'quota_exceeded' ? 'destructive' : 'warning'}
                              className="text-2xs font-mono"
                            >
                              {err.kind}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{err.op}</TableCell>
                          <TableCell className="font-mono text-xs max-w-[200px] truncate">
                            {err.key}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[400px] truncate">
                            {err.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone: 'default' | 'success' | 'warning' | 'destructive';
  hint?: string;
}) {
  const toneClasses = {
    default: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
  } as const;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClasses[tone]}`}>{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
