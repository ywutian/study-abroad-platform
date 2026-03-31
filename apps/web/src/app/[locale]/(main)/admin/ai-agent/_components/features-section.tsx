'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/lib/api';
import { adminAiAgentRoutes } from '@study-abroad/shared';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ToggleLeft } from 'lucide-react';

export function FeaturesSection() {
  const t = useTranslations('admin.aiAgent');
  const queryClient = useQueryClient();

  const { data: features } = useQuery({
    queryKey: ['aiAgentFeatures'],
    queryFn: () => apiClient.get<Record<string, boolean>>('/admin/ai-agent/features'),
  });

  const toggleFeatureMutation = useMutation({
    mutationFn: ({ feature, enabled }: { feature: string; enabled: boolean }) =>
      apiClient.put(adminAiAgentRoutes.featureToggle(feature), { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiAgentFeatures'] });
      toast.success(t('featureUpdated'));
    },
  });

  const featureMeta: Record<string, { label: string; desc: string }> = {
    fastRouting: { label: t('features.fastRouting'), desc: t('features.fastRoutingDesc') },
    memoryEnhancement: {
      label: t('features.memoryEnhancement'),
      desc: t('features.memoryEnhancementDesc'),
    },
    streamingEnabled: { label: t('features.streaming'), desc: t('features.streamingDesc') },
    abTestEnabled: { label: t('features.abTest'), desc: t('features.abTestDesc') },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <ToggleLeft className="h-5 w-5" />
          <CardTitle className="text-base">{t('featuresTitle')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {features ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(features).map(([feature, enabled]) => {
              const meta = featureMeta[feature];
              return (
                <div
                  key={feature}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex-1 mr-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{meta?.label || feature}</p>
                      <Badge
                        variant={enabled ? 'success' : 'secondary'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {enabled ? t('enabled') : t('disabled')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{meta?.desc || ''}</p>
                  </div>
                  <Switch
                    checked={Boolean(enabled)}
                    onCheckedChange={(v) => toggleFeatureMutation.mutate({ feature, enabled: v })}
                    disabled={toggleFeatureMutation.isPending}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        )}
      </CardContent>
    </Card>
  );
}
