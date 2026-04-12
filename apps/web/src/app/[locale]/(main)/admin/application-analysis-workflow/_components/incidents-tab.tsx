'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  adminRoutes,
  type PaginatedApplicationAnalysisExperimentIncidentResponse,
} from '@study-abroad/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api';

import { formatDateTime } from './utils';

export function IncidentsTab() {
  const t = useTranslations('admin.applicationAnalysisWorkflow');
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<PaginatedApplicationAnalysisExperimentIncidentResponse>({
    queryKey: ['applicationAnalysisExperimentIncidents'],
    queryFn: () =>
      apiClient.get(adminRoutes.applicationAnalysisWorkflowExperimentIncidents(), {
        params: { page: 1, pageSize: 20 },
      }),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(adminRoutes.applicationAnalysisWorkflowExperimentIncidentAcknowledge(id), {}),
    onSuccess: () => {
      toast.success(t('incidents.acknowledged'));
      queryClient.invalidateQueries({ queryKey: ['applicationAnalysisExperimentIncidents'] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('incidents.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-32 rounded-lg" />
        ) : (
          (data?.items ?? []).map((item) => (
            <div key={item.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-muted-foreground">{item.message}</div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{item.severity}</Badge>
                  <Badge variant="secondary">{item.status}</Badge>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {item.capability ?? '—'} · {formatDateTime(item.createdAt)}
              </div>
              {item.status === 'OPEN' ? (
                <div className="mt-4 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => acknowledgeMutation.mutate(item.id)}
                  >
                    {t('incidents.acknowledge')}
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
