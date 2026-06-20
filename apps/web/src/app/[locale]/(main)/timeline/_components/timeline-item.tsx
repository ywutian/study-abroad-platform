'use client';

import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import type { TimelineDetail } from '@/types/timeline';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { TimelineItemDetail } from './timeline-item-detail';
import type { TimelineDisplayRow } from './timeline-helpers';

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
        <TimelineItemDetail
          tasks={tasks}
          isLoading={timelineDetailLoading}
          toggleTaskMutation={toggleTaskMutation}
          formatDate={formatDate}
          onDelete={() => setDeleteTarget({ type: 'timeline', id: tl.id, name: tl.schoolName })}
          deleteLabel={t('deleteTimeline')}
          showTaskType
        />
      )}
    </div>
  );
}
