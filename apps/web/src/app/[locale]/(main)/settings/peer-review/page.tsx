'use client';

/**
 * Settings → Peer Review (校友广场锐评隐私设置).
 *
 * Toggles `User.acceptPeerReview`. Youth-safety gating:
 *   - age < 16   → toggle disabled, explanation shown
 *   - age 16–18  → guardian-consent confirmation before enabling
 *   - age 18+ / unknown → plain toggle
 *
 * Age is derived server-side from `Profile.birthday`; when no birthday is
 * on file the API returns `age: null` and we ship the plain toggle.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { MessageSquareHeart, ShieldCheck, Info, Loader2, Lock } from 'lucide-react';
import { userRoutes } from '@study-abroad/shared';

import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiClient } from '@/lib/api';

interface PeerReviewSetting {
  acceptPeerReview: boolean;
  age: number | null;
}

export default function PeerReviewSettingsPage() {
  const t = useTranslations('peerReviewSettings');
  const queryClient = useQueryClient();
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);

  const { data, isLoading } = useQuery<PeerReviewSetting>({
    queryKey: ['peer-review-setting'],
    queryFn: () => apiClient.get(userRoutes.peerReviewSetting()),
  });

  const mutation = useMutation({
    mutationFn: (acceptPeerReview: boolean) =>
      apiClient.patch<PeerReviewSetting>(userRoutes.peerReviewSetting(), {
        acceptPeerReview,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData<PeerReviewSetting>(['peer-review-setting'], (prev) =>
        prev ? { ...prev, acceptPeerReview: result.acceptPeerReview } : prev
      );
      toast.success(
        result.acceptPeerReview ? t('toast.enabled') : t('toast.disabled')
      );
    },
    onError: () => {
      toast.error(t('toast.error'));
    },
  });

  const age = data?.age ?? null;
  const isMinorBlocked = age !== null && age < 16;
  const needsGuardianConsent = age !== null && age >= 16 && age < 18;
  const enabled = data?.acceptPeerReview ?? false;

  const handleToggle = (next: boolean) => {
    if (isMinorBlocked) return;
    // Enabling for a 16–18 user requires an explicit guardian-consent step.
    if (next && needsGuardianConsent) {
      setConsentDialogOpen(true);
      return;
    }
    mutation.mutate(next);
  };

  return (
    <PageContainer maxWidth="3xl">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={MessageSquareHeart}
        color="violet"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Toggle card */}
          <Card className="overflow-hidden">
            <div className="h-1.5 bg-primary" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-primary" />
                {t('toggleCardTitle')}
              </CardTitle>
              <CardDescription>{t('toggleCardDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{t('toggleLabel')}</p>
                  <p className="text-sm text-muted-foreground">{t('toggleHint')}</p>
                </div>
                <Switch
                  checked={enabled}
                  disabled={isMinorBlocked || mutation.isPending}
                  onCheckedChange={handleToggle}
                  aria-label={t('toggleLabel')}
                  className="shrink-0"
                />
              </div>

              {/* Minor block notice */}
              {isMinorBlocked && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="min-w-0 text-amber-900 dark:text-amber-200">
                    {t('minorBlocked')}
                  </p>
                </div>
              )}

              {/* Guardian-consent advisory */}
              {needsGuardianConsent && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm dark:border-indigo-900/50 dark:bg-indigo-950/30">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <p className="min-w-0 text-indigo-900 dark:text-indigo-200">
                    {t('guardianAdvisory')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Explanatory copy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-5 w-5 text-muted-foreground" />
                {t('explainTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{t('explainWhat')}</p>
              <p>{t('explainPrivacy')}</p>
              <p>{t('explainControl')}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="secondary">{t('badgeAnonymized')}</Badge>
                <Badge variant="secondary">{t('badgeReversible')}</Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Guardian-consent confirmation (16–18) */}
      <ConfirmDialog
        open={consentDialogOpen}
        onOpenChange={setConsentDialogOpen}
        type="question"
        title={t('consentDialog.title')}
        description={t('consentDialog.description')}
        confirmLabel={t('consentDialog.confirm')}
        onConfirm={() => {
          setConsentDialogOpen(false);
          mutation.mutate(true);
        }}
      />
    </PageContainer>
  );
}
