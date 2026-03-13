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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          {t('dashboard.recentActivity')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity, idx) => (
              <div key={idx} className="flex items-start gap-3 py-2 border-b last:border-0">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                    activity.type === 'earn' ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                  )}
                >
                  {activity.type === 'earn' ? (
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Zap className="w-4 h-4 text-amber-500" />
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
