'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';
import { adminAiAgentRoutes } from '@study-abroad/shared';
import { useTranslations } from 'next-intl';
import { Cpu } from 'lucide-react';

interface DailyMetrics {
  daily: Array<any>;
  byModel: Record<string, number>;
  byAgent: Record<string, { tokens: number; requests: number; cost: number }>;
}

export function AgentPerformanceTab() {
  const t = useTranslations('admin.analytics');
  const [days, setDays] = useState(30);

  const { data } = useQuery({
    queryKey: ['analyticsTokenUsage', days],
    queryFn: () =>
      apiClient.get<DailyMetrics>(adminAiAgentRoutes.metricsDaily(), {
        params: { days: String(days) },
      }),
  });

  const agentData = data?.byAgent
    ? Object.entries(data.byAgent)
        .map(([type, stats]) => ({
          type: type.replace(/_/g, ' '),
          ...stats,
          avgTokens: stats.requests > 0 ? Math.round(stats.tokens / stats.requests) : 0,
        }))
        .sort((a, b) => b.requests - a.requests)
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-5 w-5" />
            {t('agentPerformance.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agentData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('agentPerformance.agentType')}</TableHead>
                  <TableHead className="text-right">{t('agentPerformance.requests')}</TableHead>
                  <TableHead className="text-right">{t('agentPerformance.tokens')}</TableHead>
                  <TableHead className="text-right">{t('agentPerformance.cost')}</TableHead>
                  <TableHead className="text-right">{t('agentPerformance.avgTokens')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentData.map((agent) => (
                  <TableRow key={agent.type}>
                    <TableCell className="font-medium capitalize">{agent.type}</TableCell>
                    <TableCell className="text-right">{agent.requests.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{agent.tokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right">${agent.cost.toFixed(4)}</TableCell>
                    <TableCell className="text-right">{agent.avgTokens.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('agentPerformance.noData')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
