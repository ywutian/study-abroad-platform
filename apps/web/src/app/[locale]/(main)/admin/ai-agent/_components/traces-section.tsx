/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Activity } from 'lucide-react';

export function TracesSection() {
  const t = useTranslations('admin.aiAgent');
  const [traceTab, setTraceTab] = useState('recent');

  const { data: traces } = useQuery({
    queryKey: ['aiAgentTraces', traceTab],
    queryFn: () =>
      apiClient.get<any[]>(adminAiAgentRoutes.traces(traceTab), { params: { limit: '30' } }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5" />
          <CardTitle className="text-base">{t('tracesTitle')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={traceTab} onValueChange={setTraceTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="recent">{t('tracesRecent')}</TabsTrigger>
            <TabsTrigger value="slow">{t('tracesSlow')}</TabsTrigger>
            <TabsTrigger value="errors">{t('tracesErrors')}</TabsTrigger>
          </TabsList>
          <TabsContent value={traceTab}>
            {traces && Array.isArray(traces) && traces.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('traceId')}</TableHead>
                    <TableHead>{t('duration')}</TableHead>
                    <TableHead>{t('traceStatus')}</TableHead>
                    <TableHead>{t('timestamp')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {traces.slice(0, 20).map((trace: any, i: number) => (
                    <TableRow key={trace.traceId || trace.spanId || i}>
                      <TableCell className="font-mono text-xs truncate max-w-[150px]">
                        {trace.traceId || trace.spanId || '-'}
                      </TableCell>
                      <TableCell>{trace.duration ? `${trace.duration}ms` : '-'}</TableCell>
                      <TableCell>
                        <Badge variant={trace.error ? 'destructive' : 'success'}>
                          {trace.error ? 'error' : 'ok'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {trace.startTime ? new Date(trace.startTime).toLocaleString() : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">{t('noTraces')}</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
