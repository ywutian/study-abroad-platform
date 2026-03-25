'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/lib/api';
import { API_ROUTES } from '@study-abroad/shared';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Zap, Cpu, Pencil } from 'lucide-react';
import { getModelLabel } from './model-select';
import { AgentEditDialog } from './agent-edit-dialog';

export function AgentsSection() {
  const t = useTranslations('admin.aiAgent');
  const queryClient = useQueryClient();

  const { data: agents } = useQuery({
    queryKey: ['aiAgentAgents'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => apiClient.get<any>('/admin/ai-agent/agents'),
  });

  const { data: configData } = useQuery({
    queryKey: ['aiAgentConfig'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => apiClient.get<any>('/admin/ai-agent/config'),
  });

  const llmConfig = configData?.config?.system?.llm;

  const toggleAgentMutation = useMutation({
    mutationFn: ({ type, enabled }: { type: string; enabled: boolean }) =>
      apiClient.put(`${API_ROUTES.ADMIN}/ai-agent/agents/${type}/toggle`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiAgentAgents'] });
      toast.success(t('agentUpdated'));
    },
  });

  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [agentForm, setAgentForm] = useState({
    model: '',
    temperature: 0.7,
    maxTokens: 2000,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openAgentEdit = (type: string, config: any) => {
    setAgentForm({
      model: config.model || llmConfig?.defaultModel || 'gpt-4o-mini',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2000,
    });
    setEditingAgent(type);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5" />
            <div>
              <CardTitle className="text-base">{t('agentsTitle')}</CardTitle>
              <CardDescription className="mt-1">{t('agentsDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {agents ? (
            <div className="space-y-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {Object.entries(agents).map(([type, config]: [string, any]) => (
                <div key={type} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {config.name || type.replace(/_/g, ' ')}
                        </p>
                        <Badge
                          variant={config.enabled ? 'success' : 'secondary'}
                          className="text-xs"
                        >
                          {config.enabled ? t('enabled') : t('disabled')}
                        </Badge>
                      </div>
                      {config.description && (
                        <p className="text-xs text-muted-foreground">{config.description}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Cpu className="h-3 w-3" />
                          {getModelLabel(config.model || llmConfig?.defaultModel || '-')}
                        </span>
                        {config.temperature !== undefined && (
                          <span>
                            {t('agentTemp')}: {config.temperature}
                          </span>
                        )}
                        {config.maxTokens !== undefined && (
                          <span>
                            {t('agentMaxTokens')}: {config.maxTokens.toLocaleString()}
                          </span>
                        )}
                        {config.tools && (
                          <span>
                            {t('agentTools')}: {config.tools.length}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openAgentEdit(type, config)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Switch
                        checked={Boolean(config.enabled)}
                        onCheckedChange={(v) => toggleAgentMutation.mutate({ type, enabled: v })}
                        disabled={toggleAgentMutation.isPending}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          )}
        </CardContent>
      </Card>

      <AgentEditDialog
        editingAgent={editingAgent}
        agentName={
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          editingAgent && (agents as any)?.[editingAgent]?.name
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (agents as any)[editingAgent].name
            : editingAgent?.replace(/_/g, ' ') || ''
        }
        agentForm={agentForm}
        setAgentForm={setAgentForm}
        onClose={() => setEditingAgent(null)}
      />
    </>
  );
}
