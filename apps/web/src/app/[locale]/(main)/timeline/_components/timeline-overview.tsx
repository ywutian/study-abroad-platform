'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import type { TimelineOverviewProps } from './timeline-helpers';

export function TimelineOverview({ overview }: TimelineOverviewProps) {
  const t = useTranslations('timeline');

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
      <Card>
        <CardContent className="py-4 text-center">
          <div className="text-2xl font-bold">{overview.totalSchools}</div>
          <div className="text-xs text-muted-foreground">{t('overview.totalSchools')}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-4 text-center">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {overview.inProgress}
          </div>
          <div className="text-xs text-muted-foreground">{t('overview.inProgress')}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-4 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {overview.submitted}
          </div>
          <div className="text-xs text-muted-foreground">{t('overview.submitted')}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-4 text-center">
          <div className="text-2xl font-bold text-muted-foreground">{overview.notStarted}</div>
          <div className="text-xs text-muted-foreground">{t('overview.notStarted')}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-4 text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {overview.totalPersonalEvents}
          </div>
          <div className="text-xs text-muted-foreground">{t('overview.totalPersonalEvents')}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-4 text-center">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {overview.personalCompleted}
          </div>
          <div className="text-xs text-muted-foreground">{t('overview.personalCompleted')}</div>
        </CardContent>
      </Card>
    </div>
  );
}
