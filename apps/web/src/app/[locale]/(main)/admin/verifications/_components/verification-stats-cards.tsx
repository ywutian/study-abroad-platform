'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface VerificationStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

interface VerificationStatsCardsProps {
  stats: VerificationStats;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn('text-2xl font-bold', color)}>{value}</p>
      </CardContent>
    </Card>
  );
}

export function VerificationStatsCards({ stats }: VerificationStatsCardsProps) {
  const t = useTranslations('admin');

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <StatCard
        label={t('verifications.stats.pending')}
        value={stats.pending}
        color="text-amber-600 dark:text-amber-400"
      />
      <StatCard
        label={t('verifications.stats.approved')}
        value={stats.approved}
        color="text-emerald-600 dark:text-emerald-400"
      />
      <StatCard
        label={t('verifications.stats.rejected')}
        value={stats.rejected}
        color="text-red-600 dark:text-red-400"
      />
      <StatCard
        label={t('verifications.stats.total')}
        value={stats.total}
        color="text-foreground"
      />
    </div>
  );
}
