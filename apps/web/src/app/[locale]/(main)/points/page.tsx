'use client';

/**
 * 积分兑换中心 — Hall refactor Stage 7 (B6, cross-module spend outlet).
 *
 * Surfaces the points balance earned across Hall activities and lets users
 * spend it on consultations / membership / unlocks. Backend:
 * `points-redemption.controller` (catalog + redeem + history).
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Coins, Loader2, Sparkles, History, Check, X } from 'lucide-react';
import type { RedemptionType, RedemptionCatalogItem } from '@study-abroad/shared';
import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  useHallOverview,
  useRedemptionCatalog,
  useRedemptionHistory,
  useRedeem,
} from '@/hooks/use-hall-api';
import { cn } from '@/lib/utils';

interface RedemptionHistoryItem {
  id: string;
  type: RedemptionType;
  pointsSpent: number;
  status: 'PENDING' | 'FULFILLED' | 'CANCELLED';
  createdAt: string;
}

export default function PointsCenterPage() {
  const t = useTranslations('pointsCenter');
  const { data: overview } = useHallOverview();
  const { data: catalog, isLoading: catalogLoading } = useRedemptionCatalog();
  const { data: history } = useRedemptionHistory();
  const redeem = useRedeem();

  const [confirmItem, setConfirmItem] = useState<RedemptionCatalogItem | null>(null);

  const balance = overview?.points.balance ?? 0;
  const historyItems = (history as RedemptionHistoryItem[] | undefined) ?? [];

  const handleRedeem = () => {
    if (!confirmItem) return;
    redeem.mutate(
      { type: confirmItem.type },
      {
        onSuccess: () => {
          toast.success(t('redeemSuccess'));
          setConfirmItem(null);
        },
        onError: () => {
          toast.error(t('redeemError'));
          setConfirmItem(null);
        },
      },
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={Coins}
        color="amber"
      />

      {/* Balance */}
      <Card className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-900/50">
        <CardContent className="flex items-center justify-between p-6">
          <div className="min-w-0">
            <p className="text-sm text-amber-700 dark:text-amber-300">{t('balance')}</p>
            <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 tabular-nums">
              {balance.toLocaleString()}
            </p>
            {overview?.points.todayEarned ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t('todayEarned', { count: overview.points.todayEarned })}
              </p>
            ) : null}
          </div>
          <Sparkles className="h-10 w-10 shrink-0 text-amber-400" />
        </CardContent>
      </Card>

      {/* Catalog */}
      <h2 className="mb-3 text-title">{t('catalogTitle')}</h2>
      {catalogLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(catalog ?? []).map((item) => {
            const affordable = balance >= item.cost;
            return (
              <Card key={item.type} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <p className="font-semibold">{t(`types.${item.type}`)}</p>
                  <p className="flex-1 text-body-sm text-muted-foreground">
                    {item.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                      <Coins className="h-4 w-4" />
                      {item.cost.toLocaleString()}
                    </span>
                    <Button
                      size="sm"
                      disabled={!affordable || redeem.isPending}
                      onClick={() => setConfirmItem(item)}
                    >
                      {affordable ? t('redeem') : t('insufficient')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* History */}
      {historyItems.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 flex items-center gap-2 text-title">
            <History className="h-5 w-5" />
            {t('historyTitle')}
          </h2>
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {historyItems.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t(`types.${h.type}`)}</p>
                    <p className="text-caption text-muted-foreground">
                      {new Date(h.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-body-sm text-muted-foreground tabular-nums">
                      -{h.pointsSpent.toLocaleString()}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        h.status === 'FULFILLED' &&
                          'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
                        h.status === 'CANCELLED' &&
                          'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
                      )}
                    >
                      {h.status === 'FULFILLED' && <Check className="mr-1 h-3 w-3" />}
                      {h.status === 'CANCELLED' && <X className="mr-1 h-3 w-3" />}
                      {t(`status.${h.status}`)}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {/* Redeem confirmation */}
      <AlertDialog open={!!confirmItem} onOpenChange={(o) => !o && setConfirmItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmItem
                ? t('confirmBody', {
                    name: t(`types.${confirmItem.type}`),
                    cost: confirmItem.cost.toLocaleString(),
                  })
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRedeem} disabled={redeem.isPending}>
              {redeem.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
