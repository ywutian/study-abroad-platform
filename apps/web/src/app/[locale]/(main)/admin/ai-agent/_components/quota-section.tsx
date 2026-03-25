/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { API_ROUTES } from '@study-abroad/shared';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Settings, Loader2 } from 'lucide-react';

export function QuotaSection() {
  const t = useTranslations('admin.aiAgent');
  const queryClient = useQueryClient();

  const { data: configData } = useQuery({
    queryKey: ['aiAgentConfig'],
    queryFn: () => apiClient.get<any>('/admin/ai-agent/config'),
  });

  const quota = configData?.config?.system?.quota;

  const [quotaForm, setQuotaForm] = useState({
    dailyTokens: '',
    monthlyTokens: '',
    dailyCost: '',
    monthlyCost: '',
  });

  const updateQuotaMutation = useMutation({
    mutationFn: (data: any) => apiClient.put(`${API_ROUTES.ADMIN}/ai-agent/config/quota`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiAgentConfig'] });
      toast.success(t('quotaUpdated'));
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5" />
          <CardTitle className="text-base">{t('quotaTitle')}</CardTitle>
        </div>
        <CardDescription>{t('quotaDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        {quota ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('dailyTokens')}</p>
                <p className="text-lg font-bold">{quota.daily.tokens?.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('monthlyTokens')}</p>
                <p className="text-lg font-bold">{quota.monthly.tokens?.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('dailyCost')}</p>
                <p className="text-lg font-bold">${quota.daily.cost}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{t('monthlyCost')}</p>
                <p className="text-lg font-bold">${quota.monthly.cost}</p>
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
                if (quotaForm.monthlyTokens) data.monthlyTokens = Number(quotaForm.monthlyTokens);
                if (quotaForm.dailyCost) data.dailyCost = Number(quotaForm.dailyCost);
                if (quotaForm.monthlyCost) data.monthlyCost = Number(quotaForm.monthlyCost);
                if (Object.keys(data).length > 0) updateQuotaMutation.mutate(data);
              }}
              disabled={updateQuotaMutation.isPending}
              size="sm"
            >
              {updateQuotaMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {t('updateQuota')}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        )}
      </CardContent>
    </Card>
  );
}
