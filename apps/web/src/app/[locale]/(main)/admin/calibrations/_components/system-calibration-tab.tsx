'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Brain, CheckCircle2, Clock, Loader2, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';
import { adminRoutes } from '@study-abroad/shared';

interface PlattStatus {
  enabled: boolean;
  params: { a: number; b: number } | null;
  trainingDataCount: number;
  minRequired: number;
}

export function SystemCalibrationTab() {
  const t = useTranslations('admin.calibrations.system');
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery<PlattStatus>({
    queryKey: ['adminPlattStatus'],
    queryFn: () => apiClient.get(adminRoutes.calibrationsPlattStatus()),
  });

  const retrainMutation = useMutation({
    mutationFn: () => apiClient.post(adminRoutes.calibrationsRetrain()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPlattStatus'] });
      toast.success(t('retrainSuccess'));
    },
  });

  // Generate sigmoid curve data points
  const curveData = useMemo(() => {
    if (!status?.params) return [];

    const { a, b } = status.params;
    const points = [];
    for (let p = 5; p <= 95; p += 5) {
      const input = p / 100;
      const z = a * input + b;
      const calibrated = 1 / (1 + Math.exp(-z));
      const clampedOutput = Math.max(0.05, Math.min(0.95, calibrated));
      points.push({
        input: p,
        output: Math.round(clampedOutput * 100),
        noChange: p,
      });
    }
    return points;
  }, [status?.params]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  if (!status) return null;

  const progress = Math.min(100, Math.round((status.trainingDataCount / status.minRequired) * 100));

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-5 w-5" />
              {t('title')}
            </CardTitle>
            <Badge
              variant={status.enabled ? 'default' : 'secondary'}
              className={
                status.enabled
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30'
                  : ''
              }
            >
              {status.enabled ? (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              ) : (
                <AlertCircle className="h-3 w-3 mr-1" />
              )}
              {status.enabled ? t('enabled') : t('insufficientData')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('description')}</p>

          {/* Training Data Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{t('trainingData')}</span>
              <span className="text-muted-foreground">
                {t('progress', {
                  current: status.trainingDataCount,
                  min: status.minRequired,
                })}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  status.enabled ? 'bg-green-500' : 'bg-amber-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            {!status.enabled && (
              <p className="text-xs text-muted-foreground">
                {t('insufficientDataDesc', {
                  min: status.minRequired,
                  current: status.trainingDataCount,
                })}
              </p>
            )}
          </div>

          {/* Actions */}
          {status.enabled && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {t('autoUpdateNote')}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => retrainMutation.mutate()}
                disabled={retrainMutation.isPending}
              >
                {retrainMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                )}
                {t('retrain')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calibration Curve */}
      {status.enabled && curveData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('curveTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('curveDesc')}</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={curveData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="input"
                  tickFormatter={(v: number) => `${v}%`}
                  className="text-xs"
                  label={{
                    value: t('axisOriginal'),
                    position: 'insideBottom',
                    offset: -5,
                    className: 'text-xs fill-muted-foreground',
                  }}
                />
                <YAxis
                  tickFormatter={(v: number) => `${v}%`}
                  className="text-xs"
                  domain={[0, 100]}
                />
                <Tooltip
                  formatter={(value) => [`${typeof value === 'number' ? value : String(value)}%`]}
                  labelFormatter={(label) => `${t('tooltipOriginal')}: ${label}%`}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                {/* Diagonal reference line (no change) */}
                <ReferenceLine
                  segment={[
                    { x: 5, y: 5 },
                    { x: 95, y: 95 },
                  ]}
                  strokeDasharray="6 4"
                  stroke="hsl(var(--muted-foreground))"
                  strokeOpacity={0.4}
                />
                {/* Actual calibration curve */}
                <Line
                  type="monotone"
                  dataKey="output"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                  name={t('lineCalibrated')}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
