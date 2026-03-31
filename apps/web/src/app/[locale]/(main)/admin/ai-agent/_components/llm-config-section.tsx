/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';
import { adminAiAgentRoutes } from '@study-abroad/shared';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Cpu, Loader2 } from 'lucide-react';
import { ModelSelect, getModelLabel } from './model-select';

export function LlmConfigSection() {
  const t = useTranslations('admin.aiAgent');
  const queryClient = useQueryClient();

  const { data: configData } = useQuery({
    queryKey: ['aiAgentConfig'],
    queryFn: () => apiClient.get<any>(adminAiAgentRoutes.config()),
  });

  const llmConfig = configData?.config?.system?.llm;

  const [llmForm, setLlmForm] = useState({
    defaultModel: '',
    fallbackModel: '',
    maxRetries: '',
    timeoutMs: '',
  });

  const updateLlmMutation = useMutation({
    mutationFn: (data: any) => apiClient.put(adminAiAgentRoutes.configLlm(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiAgentConfig'] });
      toast.success(t('llmUpdated'));
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Cpu className="h-5 w-5" />
          <div>
            <CardTitle className="text-base">{t('llmTitle')}</CardTitle>
            <CardDescription className="mt-1">{t('llmDesc')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {llmConfig ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('llmDefaultModel')}</p>
                <p className="text-sm font-bold mt-1">{getModelLabel(llmConfig.defaultModel)}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {llmConfig.defaultModel}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('llmFallbackModel')}</p>
                <p className="text-sm font-bold mt-1">{getModelLabel(llmConfig.fallbackModel)}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {llmConfig.fallbackModel}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('llmMaxRetries')}</p>
                <p className="text-lg font-bold mt-1">{llmConfig.maxRetries}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('llmTimeout')}</p>
                <p className="text-lg font-bold mt-1">{(llmConfig.timeoutMs / 1000).toFixed(0)}s</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">{t('llmDefaultModel')}</Label>
                <ModelSelect
                  value={llmForm.defaultModel || llmConfig.defaultModel}
                  onValueChange={(v) => setLlmForm({ ...llmForm, defaultModel: v })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('llmFallbackModel')}</Label>
                <ModelSelect
                  value={llmForm.fallbackModel || llmConfig.fallbackModel}
                  onValueChange={(v) => setLlmForm({ ...llmForm, fallbackModel: v })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('llmMaxRetries')}</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  placeholder={String(llmConfig.maxRetries)}
                  value={llmForm.maxRetries}
                  onChange={(e) => setLlmForm({ ...llmForm, maxRetries: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('llmTimeout')}</Label>
                <Input
                  type="number"
                  min={5000}
                  max={120000}
                  step={1000}
                  placeholder={String(llmConfig.timeoutMs)}
                  value={llmForm.timeoutMs}
                  onChange={(e) => setLlmForm({ ...llmForm, timeoutMs: e.target.value })}
                />
              </div>
            </div>
            <Button
              onClick={() => {
                const data: any = {};
                if (llmForm.defaultModel && llmForm.defaultModel !== llmConfig.defaultModel)
                  data.defaultModel = llmForm.defaultModel;
                if (llmForm.fallbackModel && llmForm.fallbackModel !== llmConfig.fallbackModel)
                  data.fallbackModel = llmForm.fallbackModel;
                if (llmForm.maxRetries) data.maxRetries = Number(llmForm.maxRetries);
                if (llmForm.timeoutMs) data.timeoutMs = Number(llmForm.timeoutMs);
                if (Object.keys(data).length > 0) updateLlmMutation.mutate(data);
              }}
              disabled={updateLlmMutation.isPending}
              size="sm"
            >
              {updateLlmMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {t('llmUpdate')}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        )}
      </CardContent>
    </Card>
  );
}
