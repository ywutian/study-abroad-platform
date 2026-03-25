/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { apiClient } from '@/lib/api';
import { API_ROUTES } from '@study-abroad/shared';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Clock, Loader2, Play } from 'lucide-react';
import { DecayConfig, DecayStats, DecayResult } from './types';

export function DecaySection() {
  const t = useTranslations('admin.memory');
  const queryClient = useQueryClient();

  const { data: decayConfig } = useQuery({
    queryKey: ['memoryDecayConfig'],
    queryFn: () => apiClient.get<DecayConfig>('/admin/ai-agent/memory/decay/config'),
  });

  const { data: decayStats } = useQuery({
    queryKey: ['memoryDecayStats'],
    queryFn: () => apiClient.get<DecayStats>('/admin/ai-agent/memory/decay/stats'),
  });

  const [decayForm, setDecayForm] = useState<Partial<DecayConfig>>({});
  const [showTriggerConfirm, setShowTriggerConfirm] = useState(false);
  const [decayResultData, setDecayResultData] = useState<DecayResult['result'] | null>(null);

  const updateDecayMutation = useMutation({
    mutationFn: (data: Partial<DecayConfig>) =>
      apiClient.put(`${API_ROUTES.ADMIN}/ai-agent/memory/decay/config`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memoryDecayConfig'] });
      toast.success(t('configSaved'));
    },
  });

  const triggerDecayMutation = useMutation({
    mutationFn: () => apiClient.post<DecayResult>('/admin/ai-agent/memory/decay/trigger'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['memoryDecayStats'] });
      queryClient.invalidateQueries({ queryKey: ['memoryGlobalStats'] });
      setDecayResultData(data.result || null);
      setShowTriggerConfirm(false);
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5" />
            <div>
              <CardTitle className="text-base">{t('decay')}</CardTitle>
              <CardDescription className="mt-1">{t('decayDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            {decayConfig && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{t('decayEnabled')}</Label>
                  <Switch
                    checked={decayForm.enabled ?? decayConfig.enabled}
                    onCheckedChange={(v) => setDecayForm({ ...decayForm, enabled: v })}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{t('decayRate')}</Label>
                    <span className="text-xs text-muted-foreground">
                      {((decayForm.decayRate ?? decayConfig.decayRate) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Slider
                    value={[decayForm.decayRate ?? decayConfig.decayRate]}
                    onValueChange={([v]) => setDecayForm({ ...decayForm, decayRate: v })}
                    min={0}
                    max={0.1}
                    step={0.001}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{t('minImportanceThreshold')}</Label>
                    <span className="text-xs text-muted-foreground">
                      {((decayForm.minImportance ?? decayConfig.minImportance) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[decayForm.minImportance ?? decayConfig.minImportance]}
                    onValueChange={([v]) => setDecayForm({ ...decayForm, minImportance: v })}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{t('accessBoostRate')}</Label>
                    <span className="text-xs text-muted-foreground">
                      {((decayForm.accessBoost ?? decayConfig.accessBoost) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <Slider
                    value={[decayForm.accessBoost ?? decayConfig.accessBoost]}
                    onValueChange={([v]) => setDecayForm({ ...decayForm, accessBoost: v })}
                    min={0}
                    max={0.5}
                    step={0.01}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{t('archiveThreshold')}</Label>
                    <span className="text-xs text-muted-foreground">
                      {((decayForm.archiveThreshold ?? decayConfig.archiveThreshold) * 100).toFixed(
                        0
                      )}
                      %
                    </span>
                  </div>
                  <Slider
                    value={[decayForm.archiveThreshold ?? decayConfig.archiveThreshold]}
                    onValueChange={([v]) => setDecayForm({ ...decayForm, archiveThreshold: v })}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('archiveAfterDays')}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={decayForm.archiveAfterDays ?? decayConfig.archiveAfterDays}
                      onChange={(e) =>
                        setDecayForm({ ...decayForm, archiveAfterDays: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('deleteAfterDays')}</Label>
                    <Input
                      type="number"
                      min={30}
                      max={3650}
                      value={decayForm.deleteAfterDays ?? decayConfig.deleteAfterDays}
                      onChange={(e) =>
                        setDecayForm({ ...decayForm, deleteAfterDays: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <Button
                  onClick={() => {
                    const data: any = {};
                    for (const [key, val] of Object.entries(decayForm)) {
                      if (val !== undefined && val !== (decayConfig as any)[key]) data[key] = val;
                    }
                    if (Object.keys(data).length > 0) updateDecayMutation.mutate(data);
                  }}
                  disabled={updateDecayMutation.isPending}
                  size="sm"
                >
                  {updateDecayMutation.isPending && (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  )}
                  {t('saveConfig')}
                </Button>
              </div>
            )}

            <div className="space-y-4">
              {decayStats && (
                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-sm font-medium">{t('decayStats')}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">{t('totalMemories')}</p>
                      <p className="text-lg font-bold">{decayStats.totalMemories}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('scheduledArchive')}</p>
                      <p className="text-lg font-bold">{decayStats.scheduledForArchive}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('avgImportance')}</p>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2"
                        style={{ width: `${decayStats.averageImportance * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {(decayStats.averageImportance * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('avgFreshness')}</p>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-emerald-500 rounded-full h-2"
                        style={{ width: `${decayStats.averageFreshness * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {(decayStats.averageFreshness * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t('tierDist')}</p>
                    {(['SHORT', 'LONG', 'ARCHIVE'] as const).map((tier) => {
                      const count = decayStats.byTier[tier] || 0;
                      const total = decayStats.totalMemories || 1;
                      return (
                        <div key={tier} className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] w-14">
                            {t(`tier${tier.charAt(0)}${tier.slice(1).toLowerCase()}`)}
                          </span>
                          <div className="flex-1 bg-muted rounded-full h-1.5">
                            <div
                              className="bg-primary rounded-full h-1.5"
                              style={{ width: `${(count / total) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] w-6 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium mb-2">{t('triggerDecay')}</p>
                <Button
                  variant="outline"
                  onClick={() => setShowTriggerConfirm(true)}
                  disabled={triggerDecayMutation.isPending}
                >
                  {triggerDecayMutation.isPending ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-3 w-3" />
                  )}
                  {t('triggerDecay')}
                </Button>
                {decayResultData && (
                  <div className="mt-3 rounded-lg bg-muted p-3 text-xs space-y-1">
                    <p className="font-medium">{t('decayResult')}</p>
                    <p>
                      {t('decayProcessed')}: {decayResultData.processed}
                    </p>
                    <p>
                      {t('decayDecayed')}: {decayResultData.decayed}
                    </p>
                    <p>
                      {t('decayArchived')}: {decayResultData.archived}
                    </p>
                    <p>
                      {t('decayDeleted')}: {decayResultData.deleted}
                    </p>
                    <p>
                      {t('decayErrors')}: {decayResultData.errors}
                    </p>
                    <p>
                      {t('decayDuration')}: {decayResultData.durationMs}ms
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showTriggerConfirm} onOpenChange={setShowTriggerConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('triggerDecay')}</AlertDialogTitle>
            <AlertDialogDescription>{t('triggerDecayConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => triggerDecayMutation.mutate()}>
              {triggerDecayMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
