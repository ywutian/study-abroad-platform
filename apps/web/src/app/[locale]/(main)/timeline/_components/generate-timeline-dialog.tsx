'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Plus, Bell } from 'lucide-react';
import type { GlobalEvent } from '@/types/timeline';
import type { UseMutationResult } from '@tanstack/react-query';

interface GlobalEventsSectionProps {
  upcomingGlobalEvents: (GlobalEvent & { subscribed: boolean })[];
  subscribeGlobalEventMutation: UseMutationResult<unknown, Error, string>;
  formatDate: (dateStr?: string) => string;
  getDaysUntil: (dateStr?: string) => number | null;
  formatDaysUntil: (days: number | null) => string;
  getCategoryIcon: (category: string) => React.ReactNode;
}

export function GlobalEventsSection({
  upcomingGlobalEvents,
  subscribeGlobalEventMutation,
  formatDate,
  getDaysUntil,
  formatDaysUntil,
  getCategoryIcon,
}: GlobalEventsSectionProps) {
  const t = useTranslations('timeline');

  if (upcomingGlobalEvents.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-body flex items-center gap-2">
          <Bell className="h-4 w-4" />
          {t('globalEvents.title')}
        </CardTitle>
        <CardDescription>{t('globalEvents.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {upcomingGlobalEvents.map((event) => {
            const days = getDaysUntil(event.eventDate);
            return (
              <div
                key={event.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary flex-shrink-0">
                  {getCategoryIcon(event.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm truncate">
                      {event.titleZh || event.title}
                    </span>
                    {days !== null && days >= 0 && (
                      <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded-full flex-shrink-0">
                        {formatDaysUntil(days)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(event.eventDate)}
                    {event.registrationDeadline && (
                      <span>
                        {' '}
                        · {t('globalEvents.regBy')} {formatDate(event.registrationDeadline)}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant={event.subscribed ? 'secondary' : 'outline'}
                  size="sm"
                  disabled={event.subscribed}
                  className="flex-shrink-0"
                  onClick={() => subscribeGlobalEventMutation.mutate(event.id)}
                >
                  {event.subscribed ? (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  ) : (
                    <Plus className="h-3 w-3 mr-1" />
                  )}
                  {event.subscribed ? t('globalEvents.subscribed') : t('globalEvents.subscribe')}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
