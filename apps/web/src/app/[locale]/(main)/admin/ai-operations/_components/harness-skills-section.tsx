'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { adminAiAgentHarnessRoutes } from '@study-abroad/shared';

interface SkillDeployment {
  agentType: string;
  activeVersionId: string;
  previousVersionId: string | null;
  status: string;
  activatedAt: string;
}

interface SkillStatus {
  enabled: boolean;
  evolutionEnabled: boolean;
  autoPublishEnabled: boolean;
  deployments: SkillDeployment[];
  evaluations: Array<{ status: string; passed: boolean }>;
  signals: Array<{ status: string; signalType: string }>;
  audits: Array<{ action: string; createdAt: string }>;
}

interface HarnessEvidence {
  totals: Record<string, number>;
}

interface HarnessAlert {
  alertId: string;
  title: string;
  severity: string;
  source?: string;
  timestamp?: string;
}

interface HarnessAlertStatus {
  pendingAlerts: number;
  activeAlerts: number;
  configuredChannels: string[];
  unavailableChannels: string[];
}

interface EvolutionResult {
  signalsCollected: number;
  candidatesCreated: number;
  published: number;
  rolledBack: number;
}

export function HarnessSkillsSection() {
  const t = useTranslations('admin.aiOps.harness');
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['aiAgentSkills'] });
    void queryClient.invalidateQueries({ queryKey: ['aiAgentHarnessEvidence'] });
    void queryClient.invalidateQueries({ queryKey: ['aiAgentHarnessAlerts'] });
    void queryClient.invalidateQueries({ queryKey: ['aiAgentHarnessAlertStatus'] });
  };

  const { data: skills, isLoading: skillsLoading } = useQuery({
    queryKey: ['aiAgentSkills'],
    queryFn: () => apiClient.get<SkillStatus>(adminAiAgentHarnessRoutes.skills()),
    refetchInterval: 60000,
  });
  const { data: evidence } = useQuery({
    queryKey: ['aiAgentHarnessEvidence'],
    queryFn: () => apiClient.get<HarnessEvidence>(adminAiAgentHarnessRoutes.evidence()),
    refetchInterval: 60000,
  });
  const { data: alerts = [] } = useQuery({
    queryKey: ['aiAgentHarnessAlerts'],
    queryFn: () => apiClient.get<HarnessAlert[]>(adminAiAgentHarnessRoutes.alerts()),
    refetchInterval: 30000,
  });
  const { data: alertStatus } = useQuery({
    queryKey: ['aiAgentHarnessAlertStatus'],
    queryFn: () => apiClient.get<HarnessAlertStatus>(adminAiAgentHarnessRoutes.alertStatus()),
    refetchInterval: 30000,
  });

  const evolution = useMutation({
    // @cache-invalidation-allowed: refresh() invalidates all Skill, Harness evidence, alert, and channel-status queries after success
    mutationFn: () => apiClient.post<EvolutionResult>(adminAiAgentHarnessRoutes.runEvolution()),
    onSuccess: (result) => {
      toast.success(
        t('evolutionResult', {
          signals: result.signalsCollected,
          candidates: result.candidatesCreated,
          published: result.published,
          rolledBack: result.rolledBack,
        })
      );
      refresh();
    },
    onError: () => toast.error(t('operationFailed')),
  });

  const rollback = useMutation({
    // @cache-invalidation-allowed: refresh() invalidates the deployment and all related Harness operational queries after success
    mutationFn: (agentType: string) =>
      apiClient.post(adminAiAgentHarnessRoutes.rollbackSkill(), {
        agentType,
        reason: 'Manual rollback from AI Operations',
      }),
    onSuccess: () => {
      toast.success(t('rollbackComplete'));
      refresh();
    },
    onError: () => toast.error(t('operationFailed')),
  });

  const acknowledge = useMutation({
    // @cache-invalidation-allowed: refresh() invalidates both active-alert and delivery-status queries after acknowledgement
    mutationFn: (alertId: string) =>
      apiClient.post(adminAiAgentHarnessRoutes.acknowledgeAlert(alertId), {
        notes: 'Acknowledged from AI Operations',
      }),
    onSuccess: () => {
      toast.success(t('alertAcknowledged'));
      refresh();
    },
    onError: () => toast.error(t('operationFailed')),
  });

  const confirmRollback = (agentType: string) => {
    if (window.confirm(t('rollbackConfirm', { agent: agentType }))) rollback.mutate(agentType);
  };

  const totals = evidence?.totals ?? {};
  const pendingSignals =
    skills?.signals.filter((signal) => signal.status === 'PENDING').length ?? 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5" />
              <CardTitle className="text-body">{t('title')}</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refresh}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('refresh')}
              </Button>
              <Button
                size="sm"
                onClick={() => evolution.mutate()}
                disabled={!skills?.evolutionEnabled || evolution.isPending}
              >
                <Activity className="mr-2 h-4 w-4" />
                {t('runEvolution')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Flag label={t('harness')} enabled />
            <Flag label={t('evolution')} enabled={Boolean(skills?.evolutionEnabled)} />
            <Flag label={t('autoPublish')} enabled={Boolean(skills?.autoPublishEnabled)} />
          </div>

          <p className="text-xs text-muted-foreground">
            {t('alertChannels')}: {alertStatus?.configuredChannels.join(', ') || '-'}
            {alertStatus?.unavailableChannels.length
              ? ` · ${t('unavailableChannels')}: ${alertStatus.unavailableChannels.join(', ')}`
              : ''}
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label={t('completedRuns')} value={totals.run_completed ?? 0} />
            <Metric label={t('failedRuns')} value={totals.run_failed ?? 0} />
            <Metric label={t('approvalsExecuted')} value={totals.approval_executed ?? 0} />
            <Metric label={t('pendingSignals')} value={pendingSignals} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">{t('deployments')}</p>
            {skillsLoading ? (
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {(skills?.deployments ?? []).map((deployment) => (
                  <div
                    key={deployment.agentType}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium capitalize">{deployment.agentType}</p>
                        <Badge variant={deployment.status === 'ACTIVE' ? 'success' : 'secondary'}>
                          {deployment.status}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {t('activeVersion')}: {deployment.activeVersionId}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!deployment.previousVersionId || rollback.isPending}
                      onClick={() => confirmRollback(deployment.agentType)}
                    >
                      <RotateCcw className="mr-2 h-3.5 w-3.5" />
                      {t('rollback')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5" />
            <CardTitle className="text-body">{t('activeAlerts')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noAlerts')}</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={`${alert.alertId}-${alert.timestamp ?? ''}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {alert.severity}
                      </Badge>
                      <p className="text-sm font-medium">{alert.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {alert.source ?? 'ai-agent'} · {alert.timestamp ?? '-'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={acknowledge.isPending}
                    onClick={() => acknowledge.mutate(alert.alertId)}
                  >
                    {t('acknowledge')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Flag({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <span className="text-sm font-medium">{label}</span>
      <Badge variant={enabled ? 'success' : 'secondary'}>{enabled ? 'ON' : 'OFF'}</Badge>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}
