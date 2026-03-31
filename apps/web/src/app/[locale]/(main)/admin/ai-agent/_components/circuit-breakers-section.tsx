/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { adminAiAgentRoutes } from '@study-abroad/shared';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';

export function CircuitBreakersSection() {
  const t = useTranslations('admin.aiAgent');
  const queryClient = useQueryClient();

  const { data: circuitBreakers } = useQuery({
    queryKey: ['aiAgentCircuitBreakers'],
    queryFn: () => apiClient.get<any>(adminAiAgentRoutes.circuitBreakers()),
  });

  const resetCircuitMutation = useMutation({
    mutationFn: (service: string) =>
      apiClient.delete(adminAiAgentRoutes.circuitBreakerReset(service)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiAgentCircuitBreakers'] });
      queryClient.invalidateQueries({ queryKey: ['aiAgentHealth'] });
      toast.success(t('circuitReset'));
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5" />
          <CardTitle className="text-base">{t('circuitTitle')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {circuitBreakers ? (
          <div className="space-y-3">
            {Object.entries(circuitBreakers).map(([service, status]: [string, any]) => (
              <div
                key={service}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="text-sm font-medium capitalize">{service}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    <span>
                      {t('state')}: {status?.state || '-'}
                    </span>
                    <span>
                      {t('failures')}: {status?.failures || 0}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resetCircuitMutation.mutate(service)}
                  disabled={resetCircuitMutation.isPending}
                >
                  {t('reset')}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        )}
      </CardContent>
    </Card>
  );
}
