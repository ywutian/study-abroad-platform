'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Slider } from '@/components/ui/slider';
import { PageHeader } from '@/components/layout';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Bot,
  Activity,
  Settings,
  ToggleLeft,
  Shield,
  Gauge,
  Loader2,
  RefreshCw,
  Zap,
  Cpu,
  Pencil,
} from 'lucide-react';

// Well-known models available via OpenAI-compatible APIs
const KNOWN_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'gemini-2.0-pro', label: 'Gemini 2.0 Pro' },
];

function ModelSelect({
  value,
  onValueChange,
  placeholder,
}: {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder || 'Select model'} />
      </SelectTrigger>
      <SelectContent>
        {KNOWN_MODELS.map((m) => (
          <SelectItem key={m.value} value={m.value}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function AdminAiAgentPage() {
  const t = useTranslations('admin.aiAgent');
  const queryClient = useQueryClient();

  // Health
  const { data: health } = useQuery({
    queryKey: ['aiAgentHealth'],
    queryFn: () => apiClient.get<any>('/admin/ai-agent/health'),
    refetchInterval: 30000,
  });

  // Metrics
  const { data: metrics } = useQuery({
    queryKey: ['aiAgentMetrics'],
    queryFn: () => apiClient.get<any>('/admin/ai-agent/metrics'),
    refetchInterval: 60000,
  });

  // Features
  const { data: features } = useQuery({
    queryKey: ['aiAgentFeatures'],
    queryFn: () => apiClient.get<Record<string, boolean>>('/admin/ai-agent/features'),
  });

  // Config (includes system.llm, system.quota etc.)
  const { data: configData } = useQuery({
    queryKey: ['aiAgentConfig'],
    queryFn: () => apiClient.get<any>('/admin/ai-agent/config'),
  });

  // Agents
  const { data: agents } = useQuery({
    queryKey: ['aiAgentAgents'],
    queryFn: () => apiClient.get<any>('/admin/ai-agent/agents'),
  });

  // Circuit breakers
  const { data: circuitBreakers } = useQuery({
    queryKey: ['aiAgentCircuitBreakers'],
    queryFn: () => apiClient.get<any>('/admin/ai-agent/circuit-breakers'),
  });

  // Traces
  const [traceTab, setTraceTab] = useState('recent');
  const { data: traces } = useQuery({
    queryKey: ['aiAgentTraces', traceTab],
    queryFn: () =>
      apiClient.get<any[]>(`/admin/ai-agent/traces/${traceTab}`, { params: { limit: '30' } }),
  });

  // ---- Mutations ----

  const toggleFeatureMutation = useMutation({
    mutationFn: ({ feature, enabled }: { feature: string; enabled: boolean }) =>
      apiClient.put(`/admin/ai-agent/features/${feature}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiAgentFeatures'] });
      toast.success(t('featureUpdated'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetMetricsMutation = useMutation({
    mutationFn: () => apiClient.delete('/admin/ai-agent/metrics'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiAgentMetrics'] });
      toast.success(t('metricsReset'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetCircuitMutation = useMutation({
    mutationFn: (service: string) =>
      apiClient.delete(`/admin/ai-agent/circuit-breakers/${service}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiAgentCircuitBreakers'] });
      queryClient.invalidateQueries({ queryKey: ['aiAgentHealth'] });
      toast.success(t('circuitReset'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Quota form
  const [quotaForm, setQuotaForm] = useState({
    dailyTokens: '',
    monthlyTokens: '',
    dailyCost: '',
    monthlyCost: '',
  });

  const updateQuotaMutation = useMutation({
    mutationFn: (data: any) => apiClient.put('/admin/ai-agent/config/quota', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiAgentConfig'] });
      toast.success(t('quotaUpdated'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // LLM config form
  const llmConfig = configData?.config?.system?.llm;
  const [llmForm, setLlmForm] = useState({
    defaultModel: '',
    fallbackModel: '',
    maxRetries: '',
    timeoutMs: '',
  });

  const updateLlmMutation = useMutation({
    mutationFn: (data: any) => apiClient.put('/admin/ai-agent/config/llm', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiAgentConfig'] });
      toast.success(t('llmUpdated'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Agent toggle & update
  const toggleAgentMutation = useMutation({
    mutationFn: ({ type, enabled }: { type: string; enabled: boolean }) =>
      apiClient.put(`/admin/ai-agent/agents/${type}/toggle`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiAgentAgents'] });
      toast.success(t('agentUpdated'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateAgentMutation = useMutation({
    mutationFn: ({ type, ...data }: { type: string; [key: string]: any }) =>
      apiClient.put(`/admin/ai-agent/agents/${type}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiAgentAgents'] });
      toast.success(t('agentUpdated'));
      setEditingAgent(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Agent edit dialog state
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [agentForm, setAgentForm] = useState({
    model: '',
    temperature: 0.7,
    maxTokens: 2000,
  });

  const openAgentEdit = (type: string, config: any) => {
    setAgentForm({
      model: config.model || llmConfig?.defaultModel || 'gpt-4o-mini',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2000,
    });
    setEditingAgent(type);
  };

  // ---- Derived state ----

  const healthStatus = health?.status || 'unknown';
  const statusColor =
    healthStatus === 'healthy'
      ? 'text-emerald-500'
      : healthStatus === 'degraded'
        ? 'text-amber-500'
        : 'text-red-500';
  const statusDot =
    healthStatus === 'healthy'
      ? 'bg-emerald-500'
      : healthStatus === 'degraded'
        ? 'bg-amber-500'
        : 'bg-red-500';

  const featureMeta: Record<string, { label: string; desc: string }> = {
    fastRouting: { label: t('features.fastRouting'), desc: t('features.fastRoutingDesc') },
    memoryEnhancement: {
      label: t('features.memoryEnhancement'),
      desc: t('features.memoryEnhancementDesc'),
    },
    streamingEnabled: { label: t('features.streaming'), desc: t('features.streamingDesc') },
    abTestEnabled: { label: t('features.abTest'), desc: t('features.abTestDesc') },
  };

  const getModelLabel = (modelId: string) => {
    return KNOWN_MODELS.find((m) => m.value === modelId)?.label || modelId;
  };

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} icon={Bot} color="blue" />

      <div className="mt-6 space-y-6">
        {/* Section 1: Health & Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5" />
                <CardTitle className="text-base">{t('healthTitle')}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <div className={cn('h-2.5 w-2.5 rounded-full animate-pulse', statusDot)} />
                <span className={cn('text-sm font-medium', statusColor)}>
                  {t(`status.${healthStatus}`)}
                </span>
              </div>
            </div>
          </CardHeader>
          {health?.components && (
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(health.components).map(([name, comp]: [string, any]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium capitalize">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('circuitState')}: {comp.circuitState || '-'}
                      </p>
                    </div>
                    <Badge variant={comp.status === 'up' ? 'success' : 'destructive'}>
                      {comp.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Section 2: Metrics */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Gauge className="h-5 w-5" />
                <CardTitle className="text-base">{t('metricsTitle')}</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetMetricsMutation.mutate()}
                disabled={resetMetricsMutation.isPending}
              >
                {resetMetricsMutation.isPending ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-3 w-3" />
                )}
                {t('resetMetrics')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {metrics ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('metricRequests')}</p>
                  <p className="text-lg font-bold mt-1">
                    {(metrics.requests?.total ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('metricAvgLatency')}</p>
                  <p className="text-lg font-bold mt-1">
                    {metrics.latency?.total?.count
                      ? `${Math.round(metrics.latency.total.sum / metrics.latency.total.count)}ms`
                      : '0ms'}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('metricTokens')}</p>
                  <p className="text-lg font-bold mt-1">
                    {(metrics.tokens?.total ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('metricErrors')}</p>
                  <p className="text-lg font-bold mt-1">
                    {(metrics.errors?.total ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('metricErrorRate')}</p>
                  <p className="text-lg font-bold mt-1">
                    {metrics.requests?.total
                      ? `${((metrics.errors?.total / metrics.requests.total) * 100).toFixed(1)}%`
                      : '0%'}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('metricActiveReqs')}</p>
                  <p className="text-lg font-bold mt-1">{metrics.system?.activeRequests ?? 0}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('metricRateLimits')}</p>
                  <p className="text-lg font-bold mt-1">
                    {(metrics.system?.rateLimitHits ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('metricPromptTokens')}</p>
                  <p className="text-lg font-bold mt-1">
                    {(metrics.tokens?.prompt ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noMetrics')}</p>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Feature Toggles */}
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
                        onCheckedChange={(v) =>
                          toggleFeatureMutation.mutate({ feature, enabled: v })
                        }
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

        {/* Section 4: LLM Configuration */}
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
                {/* Current values */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('llmDefaultModel')}</p>
                    <p className="text-sm font-bold mt-1">
                      {getModelLabel(llmConfig.defaultModel)}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {llmConfig.defaultModel}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('llmFallbackModel')}</p>
                    <p className="text-sm font-bold mt-1">
                      {getModelLabel(llmConfig.fallbackModel)}
                    </p>
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
                    <p className="text-lg font-bold mt-1">
                      {(llmConfig.timeoutMs / 1000).toFixed(0)}s
                    </p>
                  </div>
                </div>

                {/* Edit form */}
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

        {/* Section 5: Quota Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5" />
              <CardTitle className="text-base">{t('quotaTitle')}</CardTitle>
            </div>
            <CardDescription>{t('quotaDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {configData?.config?.system?.quota ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('dailyTokens')}</p>
                    <p className="text-lg font-bold">
                      {configData.config.system.quota.daily.tokens?.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('monthlyTokens')}</p>
                    <p className="text-lg font-bold">
                      {configData.config.system.quota.monthly.tokens?.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('dailyCost')}</p>
                    <p className="text-lg font-bold">
                      ${configData.config.system.quota.daily.cost}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">{t('monthlyCost')}</p>
                    <p className="text-lg font-bold">
                      ${configData.config.system.quota.monthly.cost}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Input
                    type="number"
                    placeholder={t('dailyTokens')}
                    value={quotaForm.dailyTokens}
                    onChange={(e) => setQuotaForm({ ...quotaForm, dailyTokens: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder={t('monthlyTokens')}
                    value={quotaForm.monthlyTokens}
                    onChange={(e) => setQuotaForm({ ...quotaForm, monthlyTokens: e.target.value })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={t('dailyCost')}
                    value={quotaForm.dailyCost}
                    onChange={(e) => setQuotaForm({ ...quotaForm, dailyCost: e.target.value })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={t('monthlyCost')}
                    value={quotaForm.monthlyCost}
                    onChange={(e) => setQuotaForm({ ...quotaForm, monthlyCost: e.target.value })}
                  />
                </div>
                <Button
                  onClick={() => {
                    const data: any = {};
                    if (quotaForm.dailyTokens) data.dailyTokens = Number(quotaForm.dailyTokens);
                    if (quotaForm.monthlyTokens)
                      data.monthlyTokens = Number(quotaForm.monthlyTokens);
                    if (quotaForm.dailyCost) data.dailyCost = Number(quotaForm.dailyCost);
                    if (quotaForm.monthlyCost) data.monthlyCost = Number(quotaForm.monthlyCost);
                    if (Object.keys(data).length > 0) updateQuotaMutation.mutate(data);
                  }}
                  disabled={updateQuotaMutation.isPending}
                  size="sm"
                >
                  {updateQuotaMutation.isPending && (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  )}
                  {t('updateQuota')}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            )}
          </CardContent>
        </Card>

        {/* Section 6: Agent Configurations */}
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

        {/* Section 7: Circuit Breakers */}
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

        {/* Section 8: Traces */}
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
                        <TableHead>Trace ID</TableHead>
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
      </div>

      {/* Agent Edit Dialog */}
      <Dialog open={!!editingAgent} onOpenChange={(open) => !open && setEditingAgent(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('editAgent')}</DialogTitle>
            <DialogDescription>
              {editingAgent && (agents as any)?.[editingAgent]?.name
                ? (agents as any)[editingAgent].name
                : editingAgent?.replace(/_/g, ' ')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('agentModel')}</Label>
              <ModelSelect
                value={agentForm.model}
                onValueChange={(v) => setAgentForm({ ...agentForm, model: v })}
                placeholder={t('agentModelPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('agentModelDesc')}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('agentTemp')}</Label>
                <span className="text-sm font-mono">{agentForm.temperature.toFixed(1)}</span>
              </div>
              <Slider
                value={[agentForm.temperature]}
                onValueChange={([v]) => setAgentForm({ ...agentForm, temperature: v })}
                min={0}
                max={2}
                step={0.1}
              />
              <p className="text-xs text-muted-foreground">{t('agentTempDesc')}</p>
            </div>
            <div className="space-y-2">
              <Label>{t('agentMaxTokens')}</Label>
              <Input
                type="number"
                min={100}
                max={8000}
                value={agentForm.maxTokens}
                onChange={(e) => setAgentForm({ ...agentForm, maxTokens: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">{t('agentMaxTokensDesc')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAgent(null)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={() => {
                if (!editingAgent) return;
                updateAgentMutation.mutate({
                  type: editingAgent,
                  model: agentForm.model,
                  temperature: agentForm.temperature,
                  maxTokens: agentForm.maxTokens,
                });
              }}
              disabled={updateAgentMutation.isPending}
            >
              {updateAgentMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
