'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/layout';
import { CardSkeleton } from '@/components/ui/loading-state';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Coins, Loader2, RotateCcw, Save, TrendingUp, TrendingDown } from 'lucide-react';

interface PointRule {
  action: string;
  points: number;
  description: string;
  type: 'earn' | 'spend';
}

interface PointsConfig {
  enabled: boolean;
  rules: PointRule[];
}

export default function AdminPointsPage() {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});
  const [showReset, setShowReset] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['adminPointsConfig'],
    queryFn: () => apiClient.get<PointsConfig>('/admin/points/config'),
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => apiClient.put('/admin/points/toggle', { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPointsConfig'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const batchUpdateMutation = useMutation({
    mutationFn: (actions: { action: string; points: number }[]) =>
      apiClient.put('/admin/points/actions', { actions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPointsConfig'] });
      setEditedValues({});
      toast.success(t('points.saved'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetMutation = useMutation({
    mutationFn: () => apiClient.post('/admin/points/reset'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPointsConfig'] });
      setEditedValues({});
      setShowReset(false);
      toast.success(t('points.resetDone'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleValueChange = (action: string, value: number) => {
    setEditedValues((prev) => ({ ...prev, [action]: value }));
  };

  const handleSave = () => {
    const actions = Object.entries(editedValues).map(([action, points]) => ({
      action,
      points,
    }));
    if (actions.length > 0) {
      batchUpdateMutation.mutate(actions);
    }
  };

  const hasChanges = Object.keys(editedValues).length > 0;

  const earnRules = config?.rules?.filter((r) => r.type === 'earn') ?? [];
  const spendRules = config?.rules?.filter((r) => r.type === 'spend') ?? [];

  return (
    <>
      <PageHeader
        title={t('points.title')}
        description={t('points.description')}
        icon={Coins}
        color="amber"
      />

      <div className="mt-6 space-y-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : config ? (
          <>
            {/* Toggle Card */}
            <Card>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h3 className="font-semibold">{t('points.systemEnabled')}</h3>
                  <p className="text-sm text-muted-foreground">{t('points.enabledDesc')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={config.enabled ? 'success' : 'secondary'}>
                    {config.enabled ? t('points.enabled') : t('points.disabled')}
                  </Badge>
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(checked) => toggleMutation.mutate(checked)}
                    disabled={toggleMutation.isPending}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action Rules Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t('points.actionRules')}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowReset(true)}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {t('points.resetDefaults')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!hasChanges || batchUpdateMutation.isPending}
                  >
                    {batchUpdateMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {t('points.save')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Earn Rules */}
                {earnRules.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      Earn
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('points.action')}</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[150px]">{t('points.value')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {earnRules.map((rule) => {
                          const currentValue = editedValues[rule.action] ?? rule.points;
                          return (
                            <TableRow key={rule.action}>
                              <TableCell className="font-medium font-mono text-xs">
                                {rule.action}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {rule.description}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={currentValue}
                                  onChange={(e) =>
                                    handleValueChange(rule.action, Number(e.target.value))
                                  }
                                  className="w-[120px] h-8"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Spend Rules */}
                {spendRules.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-500" />
                      Spend
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('points.action')}</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[150px]">{t('points.value')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {spendRules.map((rule) => {
                          const currentValue = editedValues[rule.action] ?? rule.points;
                          return (
                            <TableRow key={rule.action}>
                              <TableCell className="font-medium font-mono text-xs">
                                {rule.action}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {rule.description}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={currentValue}
                                  onChange={(e) =>
                                    handleValueChange(rule.action, Number(e.target.value))
                                  }
                                  className="w-[120px] h-8"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Reset Confirmation */}
      <AlertDialog open={showReset} onOpenChange={setShowReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('points.resetConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('points.resetDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialogs.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('points.resetDefaults')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
