'use client';

import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  FileText,
  CheckCircle,
  Eye,
  Brain,
  Sparkles,
  Award,
} from 'lucide-react';

interface ActivityItem {
  type: string;
  title: string;
  description: string;
  createdAt: string;
}

interface RecentActivityProps {
  activities: ActivityItem[];
  className?: string;
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  earn: TrendingUp,
  spend: TrendingDown,
  SUBMIT_CASE: FileText,
  CASE_VERIFIED: CheckCircle,
  COMPLETE_PROFILE: Award,
  VIEW_CASE_DETAIL: Eye,
  AI_ANALYSIS: Brain,
  ESSAY_POLISH: Sparkles,
  ESSAY_REVIEW: FileText,
};

export function RecentActivity({ activities, className }: RecentActivityProps) {
  const t = useTranslations('activity');
  const locale = useLocale();

  if (!activities || activities.length === 0) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <div className="h-1 bg-primary" />
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
              <Activity className="h-6 w-6 text-blue-500" />
            </div>
            <p className="font-medium">{t('noActivity')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('noActivityDesc')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="h-1 bg-primary" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-blue-500" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <ScrollArea className="h-[200px]">
          <div className="space-y-3">
            {activities.map((activity, index) => {
              const Icon = ACTIVITY_ICONS[activity.type] || Activity;
              const isEarn = activity.type === 'earn';

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-start gap-3 p-2"
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      isEarn ? 'bg-emerald-500/10' : 'bg-blue-500/10'
                    )}
                  >
                    <Icon
                      className={cn('h-4 w-4', isEarn ? 'text-emerald-500' : 'text-blue-500')}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {activity.description}
                    </p>
                  </div>

                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(activity.createdAt), {
                      addSuffix: true,
                      locale: locale === 'zh' ? zhCN : enUS,
                    })}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
