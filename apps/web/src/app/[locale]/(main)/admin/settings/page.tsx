'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/layout';
import { CardSkeleton } from '@/components/ui/loading-state';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Settings, Save, Loader2 } from 'lucide-react';

interface SystemSetting {
  key: string;
  value: string;
  category: string;
}

interface SettingField {
  key: string;
  labelKey: string;
  labelGroup: 'subscriptionSettings' | 'aiQuotaSettings';
}

const SUBSCRIPTION_SETTINGS: SettingField[] = [
  {
    key: 'subscription_pro_price',
    labelKey: 'SUBSCRIPTION_PRO_PRICE',
    labelGroup: 'subscriptionSettings',
  },
  {
    key: 'subscription_premium_price',
    labelKey: 'SUBSCRIPTION_PREMIUM_PRICE',
    labelGroup: 'subscriptionSettings',
  },
  {
    key: 'subscription_yearly_discount',
    labelKey: 'SUBSCRIPTION_YEARLY_DISCOUNT',
    labelGroup: 'subscriptionSettings',
  },
];

const AI_QUOTA_SETTINGS: SettingField[] = [
  {
    key: 'ai_quota_default_daily',
    labelKey: 'AI_QUOTA_DEFAULT_DAILY',
    labelGroup: 'aiQuotaSettings',
  },
  {
    key: 'ai_quota_pro_daily',
    labelKey: 'AI_QUOTA_PRO_DAILY',
    labelGroup: 'aiQuotaSettings',
  },
  {
    key: 'ai_quota_premium_daily',
    labelKey: 'AI_QUOTA_PREMIUM_DAILY',
    labelGroup: 'aiQuotaSettings',
  },
];

export default function AdminSettingsPage() {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

  const { data: subscriptionSettings, isLoading: subLoading } = useQuery({
    queryKey: ['adminSettings', 'subscription'],
    queryFn: () => apiClient.get<SystemSetting[]>('/settings/category/subscription'),
  });

  const { data: aiSettings, isLoading: aiLoading } = useQuery({
    queryKey: ['adminSettings', 'ai_quota'],
    queryFn: () => apiClient.get<SystemSetting[]>('/settings/category/ai_quota'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiClient.put(`/settings/${key}`, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
      toast.success(t('settings.saved'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const batchUpdateMutation = useMutation({
    mutationFn: (settings: { key: string; value: string }[]) =>
      apiClient.put('/settings', settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
      setEditedValues({});
      toast.success(t('settings.batchSaved'));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleValueChange = (key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  };

  const getSettingValue = (settings: SystemSetting[] | undefined, key: string): string => {
    if (editedValues[key] !== undefined) return editedValues[key];
    const setting = settings?.find((s) => s.key === key);
    return setting?.value ?? '';
  };

  const handleSaveAll = () => {
    const settings = Object.entries(editedValues).map(([key, value]) => ({
      key,
      value,
    }));
    if (settings.length > 0) {
      batchUpdateMutation.mutate(settings);
    }
  };

  const hasChanges = Object.keys(editedValues).length > 0;

  const renderSettingsTable = (fields: SettingField[], settings: SystemSetting[] | undefined) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('settings.key')}</TableHead>
          <TableHead className="w-[200px]">{t('settings.value')}</TableHead>
          <TableHead className="w-[80px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {fields.map((field) => (
          <TableRow key={field.key}>
            <TableCell className="font-medium">
              {t(`settings.${field.labelGroup}.${field.labelKey}` as Parameters<typeof t>[0], {
                defaultValue: field.key,
              })}
            </TableCell>
            <TableCell>
              <Input
                value={getSettingValue(settings, field.key)}
                onChange={(e) => handleValueChange(field.key, e.target.value)}
                className="h-8"
              />
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const val = editedValues[field.key] ?? getSettingValue(settings, field.key);
                  updateMutation.mutate({ key: field.key, value: val });
                  setEditedValues((prev) => {
                    const next = { ...prev };
                    delete next[field.key];
                    return next;
                  });
                }}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        description={t('settings.description')}
        icon={Settings}
        color="violet"
      />

      <div className="mt-6 space-y-6">
        {hasChanges && (
          <div className="flex justify-end">
            <Button onClick={handleSaveAll} disabled={batchUpdateMutation.isPending}>
              {batchUpdateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t('settings.batchSave')}
            </Button>
          </div>
        )}

        <Tabs defaultValue="subscription">
          <TabsList>
            <TabsTrigger value="subscription">{t('settings.subscription')}</TabsTrigger>
            <TabsTrigger value="ai_quota">{t('settings.aiQuota')}</TabsTrigger>
          </TabsList>

          <TabsContent value="subscription">
            {subLoading ? (
              <CardSkeleton />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>{t('settings.subscription')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {renderSettingsTable(SUBSCRIPTION_SETTINGS, subscriptionSettings)}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ai_quota">
            {aiLoading ? (
              <CardSkeleton />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>{t('settings.aiQuota')}</CardTitle>
                </CardHeader>
                <CardContent>{renderSettingsTable(AI_QUOTA_SETTINGS, aiSettings)}</CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
