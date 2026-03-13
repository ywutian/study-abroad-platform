'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Star } from 'lucide-react';
import type { PersonalEventsSectionProps } from './timeline-helpers';
import { TimelineItemDetail } from './timeline-item-detail';

export function PersonalEventsSection({
  sortedPersonalEvents,
  expandedPersonalEvent,
  setExpandedPersonalEvent,
  personalEventDetail,
  personalEventDetailLoading,
  togglePersonalTaskMutation,
  setDeleteTarget,
  formatDate,
  getDaysUntil,
  formatDaysUntil,
  getStatusBadge,
  getCategoryIcon,
  getCategoryLabel,
  getCategoryColor,
}: PersonalEventsSectionProps) {
  const t = useTranslations('timeline');

  if (sortedPersonalEvents.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-4 w-4" />
          {t('personalEvents.title')}
        </CardTitle>
        <CardDescription>{t('personalEvents.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedPersonalEvents.map((ev) => {
          const isExpanded = expandedPersonalEvent === ev.id;
          const days = getDaysUntil(ev.deadline || ev.eventDate);
          const tasks = isExpanded && personalEventDetail?.tasks ? personalEventDetail.tasks : [];

          return (
            <div key={ev.id} className="border rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedPersonalEvent(isExpanded ? null : ev.id)}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-md flex-shrink-0 ${getCategoryColor(ev.category)}`}
                >
                  {getCategoryIcon(ev.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm truncate">{ev.title}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-md font-medium ${getCategoryColor(ev.category)}`}
                    >
                      {getCategoryLabel(ev.category)}
                    </span>
                    {getStatusBadge(ev.status)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {(ev.deadline || ev.eventDate) && (
                      <span>
                        {ev.deadline
                          ? `${t('personalEvents.deadline')}: ${formatDate(ev.deadline)}`
                          : `${t('personalEvents.eventDate')}: ${formatDate(ev.eventDate)}`}
                      </span>
                    )}
                    {days !== null && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full ${
                          days < 0
                            ? 'bg-destructive/10 text-destructive'
                            : days <= 7
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {formatDaysUntil(days)}
                      </span>
                    )}
                    <span>
                      {t('schoolTimelines.tasks')}: {ev.tasksCompleted}/{ev.tasksTotal}
                    </span>
                    {ev.globalEventId && (
                      <span className="text-xs text-blue-500 dark:text-blue-400">
                        {t('personalEvents.fromGlobal')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-28 h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${ev.progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium w-8 text-right">{ev.progress}%</span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <TimelineItemDetail
                  tasks={tasks}
                  isLoading={personalEventDetailLoading}
                  toggleTaskMutation={togglePersonalTaskMutation}
                  formatDate={formatDate}
                  onDelete={() =>
                    setDeleteTarget({ type: 'personalEvent', id: ev.id, name: ev.title })
                  }
                  deleteLabel={t('personalEvents.delete')}
                />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
