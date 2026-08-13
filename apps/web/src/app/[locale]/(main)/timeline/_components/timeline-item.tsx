'use client';

import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import type { TimelineDetail, TimelineStatus } from '@/types/timeline';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TimelineItemDetail } from './timeline-item-detail';
import {
  SCHOOL_STATUS_OPTIONS,
  type TimelineDisplayRow,
  type UpdateTimelineVars,
  type AddTaskVars,
} from './timeline-helpers';

interface TimelineItemProps {
  timeline: TimelineDisplayRow;
  isExpanded: boolean;
  onToggleExpand: () => void;
  timelineDetail: TimelineDetail | undefined;
  timelineDetailLoading: boolean;
  toggleTaskMutation: UseMutationResult<unknown, Error, string>;
  formatDate: (dateStr?: string) => string;
  getDaysUntil: (dateStr?: string) => number | null;
  formatDaysUntil: (days: number | null) => string;
  getRoundBadge: (round: string) => ReactNode;
  getStatusBadge: (status: string) => ReactNode;
  setDeleteTarget: (target: { type: string; id: string; name: string }) => void;
  /**
   * When provided, the expanded panel shows an editable status selector. Omitted
   * in the archive view, where `status` carries a display-only 'OVERDUE' value.
   */
  updateTimelineMutation?: UseMutationResult<unknown, Error, UpdateTimelineVars>;
  /** When provided, the expanded panel allows adding/removing tasks (non-archive). */
  addTaskMutation?: UseMutationResult<unknown, Error, AddTaskVars>;
  deleteTaskMutation?: UseMutationResult<unknown, Error, string>;
  readOnly?: boolean;
}

export function TimelineItem({
  timeline: tl,
  isExpanded,
  onToggleExpand,
  timelineDetail,
  timelineDetailLoading,
  toggleTaskMutation,
  formatDate,
  getDaysUntil,
  formatDaysUntil,
  getRoundBadge,
  getStatusBadge,
  setDeleteTarget,
  updateTimelineMutation,
  addTaskMutation,
  deleteTaskMutation,
  readOnly = false,
}: TimelineItemProps) {
  const t = useTranslations('timeline');
  const days = getDaysUntil(tl.deadline);
  const tasks = isExpanded && timelineDetail?.tasks ? timelineDetail.tasks : [];

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggleExpand}
        onKeyDown={(e) => e.key === 'Enter' && onToggleExpand()}
        role="button"
        tabIndex={0}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/schools/${tl.schoolId}`}
              className="font-semibold truncate hover:underline hover:text-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {tl.schoolName}
            </Link>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t('schoolTimelines.applicationYear', { year: tl.applicationYear })}
            </span>
            {getRoundBadge(tl.round)}
            {getStatusBadge(tl.status)}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {t('schoolTimelines.deadline')}: {formatDate(tl.deadline)}
            </span>
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
              {t('schoolTimelines.tasks')}: {tl.tasksCompleted}/{tl.tasksTotal}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-28 h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${tl.progress}%` }}
            />
          </div>
          <span className="text-xs font-medium w-8 text-right">{tl.progress}%</span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {updateTimelineMutation && (
            <div className="flex items-center gap-2 border-t bg-muted/10 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                {t('schoolTimelines.statusLabel')}
              </span>
              <Select
                value={tl.status}
                onValueChange={(value) =>
                  updateTimelineMutation.mutate({
                    id: tl.id,
                    status: value as TimelineStatus,
                  })
                }
                disabled={updateTimelineMutation.isPending}
              >
                <SelectTrigger
                  className="h-8 w-44"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={t('schoolTimelines.statusLabel')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHOOL_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(`statuses.${opt.key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <TimelineItemDetail
            tasks={tasks}
            isLoading={timelineDetailLoading}
            toggleTaskMutation={toggleTaskMutation}
            formatDate={formatDate}
            onDelete={
              readOnly
                ? undefined
                : () => setDeleteTarget({ type: 'timeline', id: tl.id, name: tl.schoolName })
            }
            deleteLabel={readOnly ? undefined : t('deleteTimeline')}
            readOnly={readOnly}
            showTaskType
            onAddTask={
              addTaskMutation
                ? (title) => addTaskMutation.mutate({ timelineId: tl.id, title })
                : undefined
            }
            addTaskPending={addTaskMutation?.isPending}
            onDeleteTask={
              deleteTaskMutation ? (taskId) => deleteTaskMutation.mutate(taskId) : undefined
            }
          />
        </>
      )}
    </div>
  );
}
