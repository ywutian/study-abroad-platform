'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { adminRoutes } from '@study-abroad/shared';
import { ClipboardList, FileCheck, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReviewStats {
  pendingStaging: number;
  pendingCases: number;
  approvedToday: number;
  rejectedToday: number;
  totalStaging: number;
  totalPending: number;
}

const STAT_CARDS = [
  {
    key: 'pendingStaging',
    icon: ClipboardList,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
  },
  {
    key: 'pendingCases',
    icon: FileCheck,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
  },
  {
    key: 'approvedToday',
    icon: CheckCircle,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  {
    key: 'rejectedToday',
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
  },
] as const;

export function ReviewStatsCards() {
  const t = useTranslations('admin.dataReview.stats');

  const { data: stats } = useQuery<ReviewStats>({
    queryKey: ['reviewStats'],
    queryFn: () => apiClient.get<ReviewStats>(adminRoutes.reviewStats()),
    refetchInterval: 30000,
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {STAT_CARDS.map(({ key, icon: Icon, color, bg }) => (
        <Card key={key}>
          <CardContent className="py-4 flex items-center gap-3">
            <div className={cn('rounded-lg p-2', bg)}>
              <Icon className={cn('h-5 w-5', color)} />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {stats?.[key as keyof ReviewStats] ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">{t(key)}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
