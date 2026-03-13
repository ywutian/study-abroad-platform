'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ArrowRight, GraduationCap, Trophy, Clock, AlertCircle, CalendarDays } from 'lucide-react';

export interface TodoItem {
  id: string;
  type: 'school' | 'event';
  title: string;
  subtitle: string;
  date: Date;
  dateStr: string;
  daysLeft: number;
}

interface DashboardDeadlinesProps {
  todoList: TodoItem[];
}

export function DashboardDeadlines({ todoList }: DashboardDeadlinesProps) {
  const t = useTranslations();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          {t('dashboard.upcomingDeadlines')}
        </CardTitle>
        <Link href="/timeline">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            {t('dashboard.viewAll')}
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {todoList.length > 0 ? (
          <div className="space-y-3">
            {todoList.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-3 py-2 border-b last:border-0"
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                    item.type === 'school' ? 'bg-violet-500/10' : 'bg-amber-500/10'
                  )}
                >
                  {item.type === 'school' ? (
                    <GraduationCap className="w-4 h-4 text-violet-500" />
                  ) : (
                    <Trophy className="w-4 h-4 text-amber-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{item.title}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] px-1.5 py-0 shrink-0',
                        item.type === 'school'
                          ? 'border-violet-300 text-violet-600 bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:bg-violet-950/30'
                          : 'border-amber-300 text-amber-600 bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-950/30'
                      )}
                    >
                      {t(`dashboard.todoType.${item.type}`)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                      <CalendarDays className="w-3 h-3" />
                      {item.dateStr}
                    </span>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    'ml-2 shrink-0',
                    item.daysLeft <= 3
                      ? 'border-red-300 text-red-600 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-950/30'
                      : item.daysLeft <= 7
                        ? 'border-amber-300 text-amber-600 bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-950/30'
                        : 'border-gray-300 text-gray-600 bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:bg-gray-900/30'
                  )}
                >
                  <AlertCircle
                    className={cn(
                      'w-3 h-3 mr-1',
                      item.daysLeft <= 3
                        ? 'text-red-500'
                        : item.daysLeft <= 7
                          ? 'text-amber-500'
                          : 'text-gray-400 dark:text-gray-500'
                    )}
                  />
                  {t('dashboard.daysLeft', { days: item.daysLeft })}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{t('dashboard.noDeadlines')}</p>
            <Link href="/timeline">
              <Button variant="link" className="mt-2">
                {t('dashboard.viewAll')}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
