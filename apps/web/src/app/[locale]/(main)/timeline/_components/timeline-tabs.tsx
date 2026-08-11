'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraduationCap, Loader2, Plus } from 'lucide-react';
import type { TimelineTabsProps } from './timeline-helpers';
import { TimelineItem } from './timeline-item';

export function TimelineTabs({
  activeTab,
  sortedTimelines,
  expandedTimeline,
  setExpandedTimeline,
  timelineDetail,
  timelineDetailLoading,
  toggleTaskMutation,
  setDeleteTarget,
  schoolsWithoutTimeline,
  generateTimelineMutation,
  formatDate,
  getDaysUntil,
  formatDaysUntil,
  getStatusBadge,
  getRoundBadge,
  updateTimelineMutation,
  addTaskMutation,
  deleteTaskMutation,
}: TimelineTabsProps) {
  const t = useTranslations('timeline');

  if (activeTab === 'personal') return null;

  const isArchive = activeTab === 'archive';

  return (
    <>
      {/* School timelines list */}
      {sortedTimelines.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {t(isArchive ? 'schoolTimelines.archiveTitle' : 'schoolTimelines.title')}
            </CardTitle>
            <CardDescription>
              {t(isArchive ? 'schoolTimelines.archiveDescription' : 'schoolTimelines.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedTimelines.map((tl) => (
              <TimelineItem
                key={tl.id}
                timeline={tl}
                isExpanded={expandedTimeline === tl.id}
                onToggleExpand={() =>
                  setExpandedTimeline(expandedTimeline === tl.id ? null : tl.id)
                }
                timelineDetail={timelineDetail}
                timelineDetailLoading={timelineDetailLoading}
                toggleTaskMutation={toggleTaskMutation}
                formatDate={formatDate}
                getDaysUntil={getDaysUntil}
                formatDaysUntil={formatDaysUntil}
                getRoundBadge={getRoundBadge}
                getStatusBadge={getStatusBadge}
                setDeleteTarget={setDeleteTarget}
                readOnly={isArchive}
                updateTimelineMutation={isArchive ? undefined : updateTimelineMutation}
                addTaskMutation={isArchive ? undefined : addTaskMutation}
                deleteTaskMutation={isArchive ? undefined : deleteTaskMutation}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Schools without timelines */}
      {schoolsWithoutTimeline.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('schoolTimelines.pendingSchools')}</CardTitle>
            <CardDescription>{t('schoolTimelines.pendingSchoolsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {schoolsWithoutTimeline.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{item.school.name}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateTimelineMutation.mutate([item.schoolId])}
                  disabled={generateTimelineMutation.isPending}
                >
                  {generateTimelineMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 mr-1" />
                  )}
                  {t('schoolTimelines.generateTimeline')}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
