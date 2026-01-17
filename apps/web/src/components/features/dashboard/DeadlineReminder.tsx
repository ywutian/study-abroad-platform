'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';
import { Calendar, ChevronRight, Bell, GraduationCap } from 'lucide-react';

interface Deadline {
  id: string;
  schoolName: string;
  round: string;
  deadline: string;
  daysLeft: number;
}

interface DeadlineReminderProps {
  deadlines: Deadline[];
  className?: string;
}

export function DeadlineReminder({ deadlines, className }: DeadlineReminderProps) {
  const t = useTranslations('deadline');

  if (!deadlines || deadlines.length === 0) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <div className="h-1 bg-success" />
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
              <Calendar className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="font-medium">{t('noDeadlines')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('noDeadlinesDesc')}</p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/timeline">
                {t('manageTimeline')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getUrgencyColor = (daysLeft: number) => {
    if (daysLeft <= 3) return 'text-red-500 bg-red-500/10 border-red-500/30';
    if (daysLeft <= 7) return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
    if (daysLeft <= 14) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
    return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
  };

  const getUrgencyBadge = (daysLeft: number) => {
    if (daysLeft <= 3) return { text: t('urgency.critical'), variant: 'destructive' as const };
    if (daysLeft <= 7) return { text: t('urgency.soon'), variant: 'warning' as const };
    return null;
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="h-1 bg-gradient-to-r bg-warning" />
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-amber-500" />
            {t('title')}
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/timeline">
              {t('viewAll')}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <ScrollArea className="h-[200px]">
          <div className="space-y-3">
            {deadlines.map((deadline, index) => {
              const urgencyBadge = getUrgencyBadge(deadline.daysLeft);

              return (
                <motion.div
                  key={deadline.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/50',
                    getUrgencyColor(deadline.daysLeft)
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
                    <GraduationCap className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{deadline.schoolName}</p>
                      {urgencyBadge && (
                        <Badge variant={urgencyBadge.variant} className="text-xs">
                          {urgencyBadge.text}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{deadline.round}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={cn(
                        'text-lg font-bold',
                        deadline.daysLeft <= 3
                          ? 'text-red-500'
                          : deadline.daysLeft <= 7
                            ? 'text-amber-500'
                            : 'text-foreground'
                      )}
                    >
                      {deadline.daysLeft}
                    </div>
                    <div className="text-xs text-muted-foreground">{t('daysLeft')}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
