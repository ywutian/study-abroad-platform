'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { adminAiAgentRoutes } from '@study-abroad/shared';
import { useTranslations } from 'next-intl';
import { Coins, Zap, Hash, TrendingUp } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface DailyMetrics {
  daily: Array<{
    date: string;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    cost: number;
    requests: number;
    uniqueUsers: number;
  }>;
  byModel: Record<string, number>;
  byAgent: Record<string, { tokens: number; requests: number; cost: number }>;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 142 71% 45%))',
  'hsl(var(--chart-3, 47 96% 53%))',
  'hsl(var(--chart-4, 280 67% 58%))',
  'hsl(var(--chart-5, 12 76% 61%))',
];

export function TokenUsageTab() {
  const t = useTranslations('admin.analytics');
  const [days, setDays] = useState(30);

  const { data } = useQuery({
    queryKey: ['analyticsTokenUsage', days],
    queryFn: () =>
      apiClient.get<DailyMetrics>(adminAiAgentRoutes.metricsDaily(), {
        params: { days: String(days) },
      }),
  });

  const daily = data?.daily || [];
  const totals = daily.reduce(
    (acc, d) => ({
      tokens: acc.tokens + d.totalTokens,
      cost: acc.cost + d.cost,
      requests: acc.requests + d.requests,
    }),
    { tokens: 0, cost: 0, requests: 0 }
  );

  const modelData = data?.byModel
    ? Object.entries(data.byModel)
        .map(([model, tokens]) => ({
          model: model.length > 15 ? model.slice(0, 15) + '...' : model,
          tokens,
        }))
        .sort((a, b) => b.tokens - a.tokens)
    : [];

  return (
    <div className="space-y-4">
      {/* Time range selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('timeRange')}:</span>
        {[7, 30, 90].map((d) => (
          <Button
            key={d}
            variant={days === d ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(d)}
          >
            {t(`days${d}` as any)}
          </Button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Hash className="h-4 w-4" />
              {t('tokenUsage.totalTokens')}
            </div>
            <p className="text-2xl font-bold mt-1">{totals.tokens.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Coins className="h-4 w-4" />
              {t('tokenUsage.totalCost')}
            </div>
            <p className="text-2xl font-bold mt-1">${totals.cost.toFixed(4)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" />
              {t('tokenUsage.totalRequests')}
            </div>
            <p className="text-2xl font-bold mt-1">{totals.requests.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              {t('tokenUsage.avgTokensPerDay')}
            </div>
            <p className="text-2xl font-bold mt-1">
              {daily.length > 0 ? Math.round(totals.tokens / daily.length).toLocaleString() : '0'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily trend chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('tokenUsage.dailyTrend')}</CardTitle>
        </CardHeader>
        <CardContent>
          {daily.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillPrompt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillCompletion" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--chart-2, 142 71% 45%))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--chart-2, 142 71% 45%))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v) => v.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: 12,
                      color: 'hsl(var(--popover-foreground))',
                    }}
                    formatter={(value) =>
                      typeof value === 'number' ? value.toLocaleString() : String(value)
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="promptTokens"
                    name={t('tokenUsage.promptTokens')}
                    stroke="hsl(var(--primary))"
                    fill="url(#fillPrompt)"
                    stackId="1"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="completionTokens"
                    name={t('tokenUsage.completionTokens')}
                    stroke="hsl(var(--chart-2, 142 71% 45%))"
                    fill="url(#fillCompletion)"
                    stackId="1"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('tokenUsage.noData')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* By model bar chart */}
      {modelData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('tokenUsage.byModel')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="model"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: 12,
                      color: 'hsl(var(--popover-foreground))',
                    }}
                    formatter={(value) =>
                      typeof value === 'number' ? value.toLocaleString() : String(value)
                    }
                  />
                  <Bar dataKey="tokens" name={t('tokenUsage.totalTokens')} radius={[4, 4, 0, 0]}>
                    {modelData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
