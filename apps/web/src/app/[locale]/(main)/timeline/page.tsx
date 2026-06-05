'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { qk } from '@/lib/query';
import { API_ROUTES, schoolListRoutes, timelineRoutes } from '@study-abroad/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertTriangle,
  Archive,
  Calendar,
  CalendarClock,
  GraduationCap,
  ListChecks,
  Loader2,
  Plus,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/lib/i18n/navigation';
import { PageContainer, PageHeader } from '@/components/layout';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPersonalEventSchema, type PersonalEventFormData } from '@/lib/validations/timeline';
import type {
  TimelineResponse,
  GlobalEvent,
  TimelineDetail,
  PersonalEventResponse,
  PersonalEventDetail,
  TabType,
} from '@/types/timeline';

import { TimelineTabs } from './_components/timeline-tabs';
import { PersonalEventItem, PersonalEventsSection } from './_components/personal-events-section';
import { GlobalEventsSection } from './_components/generate-timeline-dialog';
import { CreateEventDialog } from './_components/create-event-dialog';
import { DeleteConfirmationDialog } from './_components/delete-confirmation-dialog';
import { TimelineItem } from './_components/timeline-item';
import {
  formatDate as formatDateHelper,
  getDaysUntil,
  formatDaysUntil as formatDaysUntilHelper,
  getStatusBadge as getStatusBadgeHelper,
  getRoundBadge,
  getCategoryIcon,
  getCategoryLabel as getCategoryLabelHelper,
  getCategoryColor,
} from './_components/timeline.helpers';
import {
  buildTimelineBoardModel,
  daysUntilDate,
  getArchivedDisplayStatus,
  resolveTimelineTab,
} from './_components/timeline-view-model';

function listFromResponse<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== 'object') return [];

  const record = value as { items?: unknown; data?: unknown; results?: unknown };
  if (Array.isArray(record.items)) return record.items as T[];
  if (Array.isArray(record.data)) return record.data as T[];
  if (Array.isArray(record.results)) return record.results as T[];
  return [];
}

// ============ Page Component ============

export default function TimelinePage() {
  const t = useTranslations('timeline');
  const format = useFormatter();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const initialTab = resolveTimelineTab(searchParams.get('tab'));
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const handleTabChange = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      if (tab === 'todo') params.delete('tab');
      else params.set('tab', tab);
      const qs = params.toString();
      router.replace(`/timeline${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [searchParams, router]
  );
  const [expandedTimeline, setExpandedTimeline] = useState<string | null>(null);
  const [expandedPersonalEvent, setExpandedPersonalEvent] = useState<string | null>(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: string;
    id: string;
    name: string;
  } | null>(null);
  const eventForm = useForm<PersonalEventFormData>({
    resolver: zodResolver(createPersonalEventSchema(t)),
    defaultValues: {
      title: '',
      category: 'COMPETITION',
      deadline: '',
      eventDate: '',
      description: '',
    },
  });

  // ============ Queries ============

  const { data: timelinesRaw, isLoading: timelinesLoading } = useQuery<unknown>({
    queryKey: ['timelines'],
    queryFn: () => apiClient.get(API_ROUTES.TIMELINES),
  });
  const timelines = useMemo(() => listFromResponse<TimelineResponse>(timelinesRaw), [timelinesRaw]);

  const { data: globalEventsRaw } = useQuery<unknown>({
    queryKey: ['global-events'],
    queryFn: () => apiClient.get(`${API_ROUTES.TIMELINES}/global-events`),
  });
  const globalEvents = useMemo(
    () => listFromResponse<GlobalEvent>(globalEventsRaw),
    [globalEventsRaw]
  );

  const { data: personalEventsRaw, isLoading: personalLoading } = useQuery<unknown>({
    queryKey: ['personal-events'],
    queryFn: () => apiClient.get(`${API_ROUTES.TIMELINES}/personal-events`),
  });
  const personalEvents = useMemo(
    () => listFromResponse<PersonalEventResponse>(personalEventsRaw),
    [personalEventsRaw]
  );

  const { data: schoolListItemsRaw } = useQuery<unknown>({
    queryKey: qk.schoolList.all,
    queryFn: () => apiClient.get(schoolListRoutes.list()),
  });
  const schoolListItems = useMemo(
    () =>
      listFromResponse<{
        id: string;
        schoolId: string;
        school: { id: string; name: string; nameZh?: string };
      }>(schoolListItemsRaw),
    [schoolListItemsRaw]
  );

  const generateTimelineMutation = useMutation({
    mutationFn: (schoolIds: string[]) =>
      apiClient.post(`${API_ROUTES.TIMELINES}/generate`, { schoolIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timelines'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
      toast.success(t('generateSuccess'));
    },
  });

  const { data: timelineDetail, isLoading: timelineDetailLoading } = useQuery<TimelineDetail>({
    queryKey: ['timeline-detail', expandedTimeline],
    queryFn: () => apiClient.get(`${API_ROUTES.TIMELINES}/${expandedTimeline}`),
    enabled: !!expandedTimeline,
  });

  const { data: personalEventDetail, isLoading: personalEventDetailLoading } =
    useQuery<PersonalEventDetail>({
      queryKey: ['personal-event-detail', expandedPersonalEvent],
      queryFn: () =>
        apiClient.get(`${API_ROUTES.TIMELINES}/personal-events/${expandedPersonalEvent}`),
      enabled: !!expandedPersonalEvent,
    });

  // ============ Mutations ============

  const toggleTaskMutation = useMutation({
    mutationFn: (taskId: string) => apiClient.post(timelineRoutes.taskToggle(taskId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-detail', expandedTimeline] });
      queryClient.invalidateQueries({ queryKey: ['timelines'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
    },
  });

  const deleteTimelineMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`${API_ROUTES.TIMELINES}/${id}`),
    onSuccess: () => {
      toast.success(t('deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['timelines'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
      setExpandedTimeline(null);
    },
  });

  const togglePersonalTaskMutation = useMutation({
    mutationFn: (taskId: string) =>
      apiClient.post(`${API_ROUTES.TIMELINES}/personal-tasks/${taskId}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-event-detail', expandedPersonalEvent] });
      queryClient.invalidateQueries({ queryKey: ['personal-events'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
    },
  });

  const createPersonalEventMutation = useMutation({
    mutationFn: (data: PersonalEventFormData) =>
      apiClient.post(`${API_ROUTES.TIMELINES}/personal-events`, data),
    onSuccess: () => {
      toast.success(t('personalEvents.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['personal-events'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
      setShowCreateEvent(false);
      eventForm.reset();
    },
  });

  const subscribeGlobalEventMutation = useMutation({
    mutationFn: (globalEventId: string) =>
      apiClient.post(`${API_ROUTES.TIMELINES}/personal-events/subscribe`, { globalEventId }),
    onSuccess: () => {
      toast.success(t('personalEvents.subscribed'));
      queryClient.invalidateQueries({ queryKey: ['personal-events'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
    },
    onError: () => {
      toast.error(t('personalEvents.alreadySubscribed'));
    },
  });

  const deletePersonalEventMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`${API_ROUTES.TIMELINES}/personal-events/${id}`),
    onSuccess: () => {
      toast.success(t('deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['personal-events'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
      setExpandedPersonalEvent(null);
    },
  });

  // ============ Helpers ============

  const isLoading = timelinesLoading || personalLoading;
  const hasTimelines = timelines.length > 0;
  const hasPersonalEvents = personalEvents.length > 0;
  const hasAny = hasTimelines || hasPersonalEvents;
  const board = useMemo(
    () => buildTimelineBoardModel(timelines, personalEvents),
    [timelines, personalEvents]
  );

  const schoolsWithoutTimeline = useMemo(() => {
    const timelineSchoolIds = new Set(timelines.map((tl) => tl.schoolId));
    return schoolListItems.filter((item) => item.school && !timelineSchoolIds.has(item.schoolId));
  }, [timelines, schoolListItems]);

  const formatDate = useCallback((dateStr?: string) => formatDateHelper(dateStr, format), [format]);

  const formatDaysUntil = useCallback((days: number | null) => formatDaysUntilHelper(days, t), [t]);

  const getStatusBadge = useCallback((status: string) => getStatusBadgeHelper(status, t), [t]);

  const getCategoryLabel = useCallback(
    (category: string) => getCategoryLabelHelper(category, t),
    [t]
  );

  const actionableTimelineMap = useMemo(
    () => new Map(board.actionableTimelines.map((item) => [item.id, item])),
    [board.actionableTimelines]
  );
  const actionablePersonalEventMap = useMemo(
    () => new Map(board.actionablePersonalEvents.map((item) => [item.id, item])),
    [board.actionablePersonalEvents]
  );

  const upcomingGlobalEvents = useMemo(() => {
    const subscribedIds = new Set(personalEvents.map((e) => e.globalEventId).filter(Boolean));
    return globalEvents
      .filter((e) => {
        const days = getDaysUntil(e.eventDate);
        return days !== null && days >= 0 && days <= 90;
      })
      .map((e) => ({ ...e, subscribed: subscribedIds.has(e.id) }))
      .slice(0, 12);
  }, [globalEvents, personalEvents]);

  const archivedTimelines = useMemo(
    () =>
      board.archivedTimelines.map((timeline) => ({
        ...timeline,
        status: getArchivedDisplayStatus(timeline.status, daysUntilDate(timeline.deadline)),
      })),
    [board.archivedTimelines]
  );
  const archivedPersonalEvents = useMemo(
    () =>
      board.archivedPersonalEvents.map((event) => ({
        ...event,
        status: getArchivedDisplayStatus(
          event.status,
          daysUntilDate(event.deadline ?? event.eventDate)
        ),
      })),
    [board.archivedPersonalEvents]
  );

  const actionMetrics = [
    {
      key: 'dueWindow',
      icon: CalendarClock,
      label: t('actionBoard.dueWindow'),
      value: `${board.metrics.due7}/${board.metrics.due30}`,
      description: t('actionBoard.dueWindowDesc'),
      tone:
        board.metrics.due7 > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-muted-foreground',
    },
    {
      key: 'overdue',
      icon: AlertTriangle,
      label: t('actionBoard.overdue'),
      value: String(board.metrics.overdue),
      description: t('actionBoard.overdueDesc'),
      tone: board.metrics.overdue > 0 ? 'text-destructive' : 'text-muted-foreground',
    },
    {
      key: 'pendingSchools',
      icon: GraduationCap,
      label: t('actionBoard.pendingSchools'),
      value: String(schoolsWithoutTimeline.length),
      description: t('actionBoard.pendingSchoolsDesc'),
      tone:
        schoolsWithoutTimeline.length > 0
          ? 'text-blue-700 dark:text-blue-300'
          : 'text-muted-foreground',
    },
    {
      key: 'incompleteTasks',
      icon: ListChecks,
      label: t('actionBoard.incompleteTasks'),
      value: String(board.metrics.incompleteTasks),
      description: t('actionBoard.incompleteTasksDesc'),
      tone: board.metrics.incompleteTasks > 0 ? 'text-foreground' : 'text-muted-foreground',
    },
  ];

  // ============ Render ============

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-5xl flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <PageContainer maxWidth="5xl" className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={Calendar}
        color="blue"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="min-h-10 sm:min-h-9"
              onClick={() => setShowCreateEvent(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('personalEvents.create')}
            </Button>
            <Button
              onClick={() => router.push('/schools')}
              size="sm"
              className="min-h-10 sm:min-h-9"
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('addSchool')}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actionMetrics.map(({ key, icon: Icon, label, value, description, tone }) => (
          <Card key={key}>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                <Icon className={`h-4 w-4 ${tone}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold leading-none">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex w-fit gap-1 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] p-1 shadow-[var(--theme-button-shadow)]">
        {(['todo', 'school', 'personal', 'archive'] as TabType[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => handleTabChange(tab)}
            className={`min-h-10 px-4 py-2 text-sm font-medium rounded-md transition-colors sm:min-h-9 ${
              activeTab === tab
                ? 'bg-[color:var(--theme-control-selected-bg)] shadow-sm text-foreground'
                : 'text-muted-foreground hover:bg-[color:var(--theme-control-hover-bg)] hover:text-foreground'
            }`}
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {!hasAny && activeTab === 'todo' && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('empty.title')}</h3>
            <p className="text-muted-foreground mb-4 max-w-md">{t('empty.description')}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="min-h-10"
                onClick={() => setShowCreateEvent(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('personalEvents.create')}
              </Button>
              <Button className="min-h-10" onClick={() => router.push('/schools')}>
                <Plus className="h-4 w-4 mr-1" />
                {t('empty.action')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'todo' && hasAny && (
        <>
          {board.todoItems.length > 0 ? (
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="pb-1">
                  <h2 className="text-base font-semibold">{t('todo.title')}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t('todo.description')}</p>
                </div>
                {board.todoItems.map((item) => {
                  if (item.kind === 'school') {
                    const timeline = actionableTimelineMap.get(item.id);
                    if (!timeline) return null;
                    return (
                      <TimelineItem
                        key={`school-${item.id}`}
                        timeline={timeline}
                        isExpanded={expandedTimeline === timeline.id}
                        onToggleExpand={() =>
                          setExpandedTimeline(expandedTimeline === timeline.id ? null : timeline.id)
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
                      />
                    );
                  }

                  const event = actionablePersonalEventMap.get(item.id);
                  if (!event) return null;
                  return (
                    <PersonalEventItem
                      key={`personal-${item.id}`}
                      event={event}
                      expandedPersonalEvent={expandedPersonalEvent}
                      setExpandedPersonalEvent={setExpandedPersonalEvent}
                      personalEventDetail={personalEventDetail}
                      personalEventDetailLoading={personalEventDetailLoading}
                      togglePersonalTaskMutation={togglePersonalTaskMutation}
                      setDeleteTarget={setDeleteTarget}
                      formatDate={formatDate}
                      getDaysUntil={getDaysUntil}
                      formatDaysUntil={formatDaysUntil}
                      getStatusBadge={getStatusBadge}
                      getRoundBadge={getRoundBadge}
                      getCategoryIcon={getCategoryIcon}
                      getCategoryLabel={getCategoryLabel}
                      getCategoryColor={getCategoryColor}
                    />
                  );
                })}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <ListChecks className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h3 className="text-base font-semibold">{t('todo.emptyTitle')}</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {t('todo.emptyDescription')}
                </p>
              </CardContent>
            </Card>
          )}

          {schoolsWithoutTimeline.length > 0 && (
            <TimelineTabs
              activeTab={activeTab}
              sortedTimelines={[]}
              expandedTimeline={expandedTimeline}
              setExpandedTimeline={setExpandedTimeline}
              timelineDetail={timelineDetail}
              timelineDetailLoading={timelineDetailLoading}
              toggleTaskMutation={toggleTaskMutation}
              setDeleteTarget={setDeleteTarget}
              schoolsWithoutTimeline={schoolsWithoutTimeline}
              generateTimelineMutation={generateTimelineMutation}
              formatDate={formatDate}
              getDaysUntil={getDaysUntil}
              formatDaysUntil={formatDaysUntil}
              getStatusBadge={getStatusBadge}
              getRoundBadge={getRoundBadge}
              getCategoryIcon={getCategoryIcon}
              getCategoryLabel={getCategoryLabel}
              getCategoryColor={getCategoryColor}
            />
          )}
        </>
      )}

      {activeTab === 'school' && (
        <>
          {board.actionableTimelines.length > 0 || schoolsWithoutTimeline.length > 0 ? (
            <TimelineTabs
              activeTab={activeTab}
              sortedTimelines={board.actionableTimelines}
              expandedTimeline={expandedTimeline}
              setExpandedTimeline={setExpandedTimeline}
              timelineDetail={timelineDetail}
              timelineDetailLoading={timelineDetailLoading}
              toggleTaskMutation={toggleTaskMutation}
              setDeleteTarget={setDeleteTarget}
              schoolsWithoutTimeline={schoolsWithoutTimeline}
              generateTimelineMutation={generateTimelineMutation}
              formatDate={formatDate}
              getDaysUntil={getDaysUntil}
              formatDaysUntil={formatDaysUntil}
              getStatusBadge={getStatusBadge}
              getRoundBadge={getRoundBadge}
              getCategoryIcon={getCategoryIcon}
              getCategoryLabel={getCategoryLabel}
              getCategoryColor={getCategoryColor}
            />
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <GraduationCap className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h3 className="text-base font-semibold">{t('schoolTimelines.emptyTitle')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('schoolTimelines.emptyDescription')}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeTab === 'personal' && (
        <>
          {board.actionablePersonalEvents.length > 0 ? (
            <PersonalEventsSection
              sortedPersonalEvents={board.actionablePersonalEvents}
              expandedPersonalEvent={expandedPersonalEvent}
              setExpandedPersonalEvent={setExpandedPersonalEvent}
              personalEventDetail={personalEventDetail}
              personalEventDetailLoading={personalEventDetailLoading}
              togglePersonalTaskMutation={togglePersonalTaskMutation}
              setDeleteTarget={setDeleteTarget}
              formatDate={formatDate}
              getDaysUntil={getDaysUntil}
              formatDaysUntil={formatDaysUntil}
              getStatusBadge={getStatusBadge}
              getRoundBadge={getRoundBadge}
              getCategoryIcon={getCategoryIcon}
              getCategoryLabel={getCategoryLabel}
              getCategoryColor={getCategoryColor}
            />
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h3 className="text-base font-semibold">{t('personalEvents.emptyTitle')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('personalEvents.emptyDescription')}
                </p>
              </CardContent>
            </Card>
          )}

          <GlobalEventsSection
            upcomingGlobalEvents={upcomingGlobalEvents}
            subscribeGlobalEventMutation={subscribeGlobalEventMutation}
            formatDate={formatDate}
            getDaysUntil={getDaysUntil}
            formatDaysUntil={formatDaysUntil}
            getCategoryIcon={getCategoryIcon}
          />
        </>
      )}

      {activeTab === 'archive' && (
        <>
          {archivedTimelines.length === 0 && archivedPersonalEvents.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <Archive className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <h3 className="text-base font-semibold">{t('archive.emptyTitle')}</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  {t('archive.emptyDescription')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <TimelineTabs
                activeTab={activeTab}
                sortedTimelines={archivedTimelines}
                expandedTimeline={expandedTimeline}
                setExpandedTimeline={setExpandedTimeline}
                timelineDetail={timelineDetail}
                timelineDetailLoading={timelineDetailLoading}
                toggleTaskMutation={toggleTaskMutation}
                setDeleteTarget={setDeleteTarget}
                schoolsWithoutTimeline={[]}
                generateTimelineMutation={generateTimelineMutation}
                formatDate={formatDate}
                getDaysUntil={getDaysUntil}
                formatDaysUntil={formatDaysUntil}
                getStatusBadge={getStatusBadge}
                getRoundBadge={getRoundBadge}
                getCategoryIcon={getCategoryIcon}
                getCategoryLabel={getCategoryLabel}
                getCategoryColor={getCategoryColor}
              />
              <PersonalEventsSection
                sortedPersonalEvents={archivedPersonalEvents}
                expandedPersonalEvent={expandedPersonalEvent}
                setExpandedPersonalEvent={setExpandedPersonalEvent}
                personalEventDetail={personalEventDetail}
                personalEventDetailLoading={personalEventDetailLoading}
                togglePersonalTaskMutation={togglePersonalTaskMutation}
                setDeleteTarget={setDeleteTarget}
                formatDate={formatDate}
                getDaysUntil={getDaysUntil}
                formatDaysUntil={formatDaysUntil}
                getStatusBadge={getStatusBadge}
                getRoundBadge={getRoundBadge}
                getCategoryIcon={getCategoryIcon}
                getCategoryLabel={getCategoryLabel}
                getCategoryColor={getCategoryColor}
              />
            </>
          )}
        </>
      )}

      {!hasAny && upcomingGlobalEvents.length > 0 && (
        <GlobalEventsSection
          upcomingGlobalEvents={upcomingGlobalEvents}
          subscribeGlobalEventMutation={subscribeGlobalEventMutation}
          formatDate={formatDate}
          getDaysUntil={getDaysUntil}
          formatDaysUntil={formatDaysUntil}
          getCategoryIcon={getCategoryIcon}
        />
      )}

      <CreateEventDialog
        open={showCreateEvent}
        onOpenChange={setShowCreateEvent}
        eventForm={eventForm}
        createPersonalEventMutation={createPersonalEventMutation}
        getCategoryLabel={getCategoryLabel}
      />

      {/* Delete confirmation dialog */}
      <DeleteConfirmationDialog
        deleteTarget={deleteTarget}
        setDeleteTarget={setDeleteTarget}
        deleteTimelineMutation={deleteTimelineMutation}
        deletePersonalEventMutation={deletePersonalEventMutation}
      />
    </PageContainer>
  );
}
