'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Star } from 'lucide-react';
import type { PersonalEventsSectionProps, PersonalEventDisplayRow } from './timeline-helpers';
import { TimelineItemDetail } from './timeline-item-detail';

interface PersonalEventItemProps extends Omit<PersonalEventsSectionProps, 'sortedPersonalEvents'> {
  event: PersonalEventDisplayRow;
}

export function PersonalEventItem({
  event: ev,
  expandedPersonalEvent,
  setExpandedPersonalEvent,
  personalEventDetail,
  personalEventDetailLoading,
  togglePersonalTaskMutation,
  setDeleteTarget,
  onEditEvent,
  addPersonalTaskMutation,
  deletePersonalTaskMutation,
  formatDate,
  getDaysUntil,
  formatDaysUntil,
  getStatusBadge,
  getCategoryIcon,
  getCategoryLabel,
  getCategoryColor,
  readOnly = false,
}: PersonalEventItemProps) {
  const t = useTranslations('timeline');
  const isExpanded = expandedPersonalEvent === ev.id;
  const deadlineDays = getDaysUntil(ev.deadline);
  const eventDays = getDaysUntil(ev.eventDate);
  const dateDistances = [deadlineDays, eventDays].filter(
    (value): value is number => value !== null
  );
  const upcomingDistances = dateDistances.filter((value) => value >= 0);
  const days =
    upcomingDistances.length > 0
      ? Math.min(...upcomingDistances)
      : dateDistances.length > 0
        ? Math.max(...dateDistances)
        : null;
  const tasks = isExpanded && personalEventDetail?.tasks ? personalEventDetail.tasks : [];

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpandedPersonalEvent(isExpanded ? null : ev.id)}
        onKeyDown={(e) => e.key === 'Enter' && setExpandedPersonalEvent(isExpanded ? null : ev.id)}
        role="button"
        tabIndex={0}
      >
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-md flex-shrink-0 ${getCategoryColor(ev.category)}`}
        >
          {getCategoryIcon(ev.category)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm truncate">{ev.title}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-md font-medium ${getCategoryColor(ev.category)}`}
            >
              {getCategoryLabel(ev.category)}
            </span>
            {getStatusBadge(ev.status)}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {ev.deadline && (
              <span>{`${t('personalEvents.deadline')}: ${formatDate(ev.deadline)}`}</span>
            )}
            {ev.eventDate && (
              <span>{`${t('personalEvents.eventDate')}: ${formatDate(ev.eventDate)}`}</span>
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
          onDelete={
            readOnly
              ? undefined
              : () => setDeleteTarget({ type: 'personalEvent', id: ev.id, name: ev.title })
          }
          deleteLabel={readOnly ? undefined : t('personalEvents.delete')}
          readOnly={readOnly}
          onEdit={readOnly ? undefined : () => onEditEvent(ev)}
          editLabel={readOnly ? undefined : t('personalEvents.edit')}
          onAddTask={
            readOnly
              ? undefined
              : (title) => addPersonalTaskMutation.mutate({ eventId: ev.id, title })
          }
          addTaskPending={addPersonalTaskMutation.isPending}
          onDeleteTask={
            readOnly ? undefined : (taskId) => deletePersonalTaskMutation.mutate(taskId)
          }
        />
      )}
    </div>
  );
}

export function PersonalEventsSection({
  sortedPersonalEvents,
  expandedPersonalEvent,
  setExpandedPersonalEvent,
  personalEventDetail,
  personalEventDetailLoading,
  togglePersonalTaskMutation,
  setDeleteTarget,
  onEditEvent,
  addPersonalTaskMutation,
  deletePersonalTaskMutation,
  formatDate,
  getDaysUntil,
  formatDaysUntil,
  getStatusBadge,
  getRoundBadge,
  getCategoryIcon,
  getCategoryLabel,
  getCategoryColor,
  readOnly = false,
}: PersonalEventsSectionProps) {
  const t = useTranslations('timeline');

  if (sortedPersonalEvents.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-body flex items-center gap-2">
          <Star className="h-4 w-4" />
          {t('personalEvents.title')}
        </CardTitle>
        <CardDescription>{t('personalEvents.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedPersonalEvents.map((ev) => (
          <PersonalEventItem
            key={ev.id}
            event={ev}
            expandedPersonalEvent={expandedPersonalEvent}
            setExpandedPersonalEvent={setExpandedPersonalEvent}
            personalEventDetail={personalEventDetail}
            personalEventDetailLoading={personalEventDetailLoading}
            togglePersonalTaskMutation={togglePersonalTaskMutation}
            setDeleteTarget={setDeleteTarget}
            onEditEvent={onEditEvent}
            addPersonalTaskMutation={addPersonalTaskMutation}
            deletePersonalTaskMutation={deletePersonalTaskMutation}
            formatDate={formatDate}
            getDaysUntil={getDaysUntil}
            formatDaysUntil={formatDaysUntil}
            getStatusBadge={getStatusBadge}
            getRoundBadge={getRoundBadge}
            getCategoryIcon={getCategoryIcon}
            getCategoryLabel={getCategoryLabel}
            getCategoryColor={getCategoryColor}
            readOnly={readOnly}
          />
        ))}
      </CardContent>
    </Card>
  );
}
