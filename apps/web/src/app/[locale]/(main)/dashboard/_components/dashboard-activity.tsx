'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRight, TrendingUp, Zap } from 'lucide-react';

interface Activity {
  type: string;
  title: string;
  description: string;
  createdAt: string;
}

interface DashboardActivityProps {
  activities: Activity[];
}

export function DashboardActivity({ activities }: DashboardActivityProps) {
  const t = useTranslations();
  return (
    <Card className="rounded-[var(--theme-radius-card)] py-0">
      <CardHeader className="px-4 py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4" />
          {t('dashboard.recentActivity')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity, idx) => (
              <div key={idx} className="flex items-start gap-3 py-2 border-b last:border-0">
                <div
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--theme-radius-card)] border',
                    activity.type === 'earn'
                      ? 'border-success/25 bg-success/10'
                      : 'border-warning/25 bg-warning/10'
                  )}
                >
                  {activity.type === 'earn' ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : (
                    <Zap className="h-4 w-4 text-warning" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{activity.title}</p>
                  <p className="text-xs text-muted-foreground">{activity.description}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(activity.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>{t('dashboard.noRecentActivity')}</p>
            <Link href="/schools">
              <Button variant="link" className="mt-2">
                {t('dashboard.startExploring')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
