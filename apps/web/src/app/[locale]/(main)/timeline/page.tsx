'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { API_ROUTES, schoolListRoutes, timelineRoutes } from '@study-abroad/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertTriangle,
  Calendar,
  GraduationCap,
  Info,
  ListChecks,
  Loader2,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/lib/i18n/navigation';
import { EnterpriseStatusStrip, PageContainer, PageHeader } from '@/components/layout';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPersonalEventSchema, type PersonalEventFormData } from '@/lib/validations/timeline';
import type {
  TimelineResponse,
  TimelineOverview as TimelineOverviewType,
  GlobalEvent,
  TimelineDetail,
  PersonalEventResponse,
  PersonalEventDetail,
  TabType,
} from '@/types/timeline';

import { TimelineOverview } from './_components/timeline-overview';
import { TimelineTabs } from './_components/timeline-tabs';
import { PersonalEventsSection } from './_components/personal-events-section';
import { GlobalEventsSection } from './_components/generate-timeline-dialog';
import { CreateEventDialog } from './_components/create-event-dialog';
import { DeleteConfirmationDialog } from './_components/delete-confirmation-dialog';
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

function listFromResponse<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== 'object') return [];

  const record = value as { items?: unknown; data?: unknown; results?: unknown };
  if (Array.isArray(record.items)) return record.items as T[];
  if (Array.isArray(record.data)) return record.data as T[];
  if (Array.isArray(record.results)) return record.results as T[];
  return [];
}

function overviewFromResponse(
  value: unknown,
  timelines: TimelineResponse[],
  personalEvents: PersonalEventResponse[]
): TimelineOverviewType | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Partial<TimelineOverviewType>;
    if (
      typeof record.totalSchools === 'number' ||
      typeof record.totalPersonalEvents === 'number' ||
      Array.isArray(record.upcomingDeadlines)
    ) {
      return {
        totalSchools: record.totalSchools ?? timelines.length,
        submitted: record.submitted ?? timelines.filter((tl) => tl.status === 'SUBMITTED').length,
        inProgress:
          record.inProgress ??
          timelines.filter((tl) => tl.status !== 'SUBMITTED' && tl.status !== 'NOT_STARTED').length,
        notStarted:
          record.notStarted ?? timelines.filter((tl) => tl.status === 'NOT_STARTED').length,
        upcomingDeadlines: Array.isArray(record.upcomingDeadlines)
          ? record.upcomingDeadlines
          : timelines,
        overdueTasks: Array.isArray(record.overdueTasks) ? record.overdueTasks : [],
        totalPersonalEvents: record.totalPersonalEvents ?? personalEvents.length,
        personalInProgress:
          record.personalInProgress ??
          personalEvents.filter((event) => event.status !== 'COMPLETED').length,
        personalCompleted:
          record.personalCompleted ??
          personalEvents.filter((event) => event.status === 'COMPLETED').length,
        upcomingPersonalEvents: Array.isArray(record.upcomingPersonalEvents)
          ? record.upcomingPersonalEvents
          : personalEvents,
      };
    }
  }

  if (!timelines.length && !personalEvents.length) return null;
  return {
    totalSchools: timelines.length,
    submitted: timelines.filter((tl) => tl.status === 'SUBMITTED').length,
    inProgress: timelines.filter((tl) => tl.status !== 'SUBMITTED' && tl.status !== 'NOT_STARTED')
      .length,
    notStarted: timelines.filter((tl) => tl.status === 'NOT_STARTED').length,
    upcomingDeadlines: timelines,
    overdueTasks: [],
    totalPersonalEvents: personalEvents.length,
    personalInProgress: personalEvents.filter((event) => event.status !== 'COMPLETED').length,
    personalCompleted: personalEvents.filter((event) => event.status === 'COMPLETED').length,
    upcomingPersonalEvents: personalEvents,
  };
}

// ============ Page Component ============

export default function TimelinePage() {
  const t = useTranslations('timeline');
  const statusT = useTranslations('enterpriseStatus');
  const format = useFormatter();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const VALID_TABS: TabType[] = ['all', 'school', 'personal'];
  const initialTab = VALID_TABS.includes(searchParams.get('tab') as TabType)
    ? (searchParams.get('tab') as TabType)
    : 'all';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const handleTabChange = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      if (tab === 'all') params.delete('tab');
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

  const { data: overviewRaw, isLoading: overviewLoading } = useQuery<unknown>({
    queryKey: ['timeline-overview'],
    queryFn: () => apiClient.get(`${API_ROUTES.TIMELINES}/overview`),
  });

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
    queryKey: ['school-lists'],
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
  const overview = useMemo(
    () => overviewFromResponse(overviewRaw, timelines, personalEvents),
    [overviewRaw, timelines, personalEvents]
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

  const isLoading = overviewLoading || timelinesLoading || personalLoading;
  const hasTimelines = timelines.length > 0;
  const hasPersonalEvents = personalEvents.length > 0;
  const hasAny = hasTimelines || hasPersonalEvents;
  const deadlineRiskCount = useMemo(() => {
    const schoolRisk = timelines.filter((item) => {
      const days = getDaysUntil(item.deadline);
      return days !== null && days >= 0 && days <= 30;
    }).length;
    const personalRisk = personalEvents.filter((item) => {
      const days = getDaysUntil(item.deadline ?? item.eventDate);
      return days !== null && days >= 0 && days <= 30;
    }).length;
    return schoolRisk + personalRisk;
  }, [timelines, personalEvents]);

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

  // Sorted data
  const sortedTimelines = useMemo(() => {
    return [...timelines].sort((a, b) => {
      if (a.status === 'SUBMITTED' && b.status !== 'SUBMITTED') return 1;
      if (a.status !== 'SUBMITTED' && b.status === 'SUBMITTED') return -1;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [timelines]);

  const sortedPersonalEvents = useMemo(() => {
    return [...personalEvents].sort((a, b) => {
      if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return 1;
      if (a.status !== 'COMPLETED' && b.status === 'COMPLETED') return -1;
      const aDate = a.deadline || a.eventDate || a.createdAt;
      const bDate = b.deadline || b.eventDate || b.createdAt;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });
  }, [personalEvents]);

  const upcomingGlobalEvents = useMemo(() => {
    const now = new Date();
    const subscribedIds = new Set(personalEvents.map((e) => e.globalEventId).filter(Boolean));
    return globalEvents
      .filter((e) => {
        const eventDate = new Date(e.eventDate);
        const days = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return days >= -7 && days <= 90;
      })
      .map((e) => ({ ...e, subscribed: subscribedIds.has(e.id) }))
      .slice(0, 12);
  }, [globalEvents, personalEvents]);

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

      <EnterpriseStatusStrip
        title={statusT('timeline.title')}
        description={statusT('timeline.description')}
        items={[
          {
            tone: schoolsWithoutTimeline.length > 0 ? 'attention' : 'ready',
            label: statusT('timeline.coverage'),
            value:
              schoolsWithoutTimeline.length > 0
                ? String(schoolsWithoutTimeline.length)
                : statusT('states.ready'),
            description: statusT('timeline.coverageDesc'),
            icon: GraduationCap,
          },
          {
            tone: deadlineRiskCount > 0 ? 'attention' : 'ready',
            label: statusT('timeline.risk'),
            value: deadlineRiskCount > 0 ? String(deadlineRiskCount) : statusT('states.ready'),
            description: statusT('timeline.riskDesc'),
            icon: AlertTriangle,
          },
          {
            tone: hasAny ? 'ready' : 'blocked',
            label: statusT('timeline.tasks'),
            value: hasAny ? statusT('states.ready') : statusT('states.blocked'),
            description: statusT('timeline.tasksDesc'),
            icon: ListChecks,
          },
          {
            tone: upcomingGlobalEvents.length > 0 ? 'verified' : 'attention',
            label: statusT('timeline.sync'),
            value:
              upcomingGlobalEvents.length > 0
                ? statusT('states.verified')
                : statusT('states.nextAction'),
            description: statusT('timeline.syncDesc'),
            icon: ShieldCheck,
          },
        ]}
      />

      {/* Tab navigation */}
      <div className="flex w-fit gap-1 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] p-1 shadow-[var(--theme-button-shadow)]">
        {(['all', 'school', 'personal'] as TabType[]).map((tab) => (
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

      {/* Overview stats */}
      {hasAny && overview && <TimelineOverview overview={overview} />}

      {/* Empty state */}
      {!hasAny && (
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

      {/* Global events (subscribable) */}
      {(activeTab === 'all' || activeTab === 'personal') && (
        <GlobalEventsSection
          upcomingGlobalEvents={upcomingGlobalEvents}
          subscribeGlobalEventMutation={subscribeGlobalEventMutation}
          formatDate={formatDate}
          getDaysUntil={getDaysUntil}
          formatDaysUntil={formatDaysUntil}
          getCategoryIcon={getCategoryIcon}
        />
      )}

      {/* Create personal event dialog */}
      <CreateEventDialog
        open={showCreateEvent}
        onOpenChange={setShowCreateEvent}
        eventForm={eventForm}
        createPersonalEventMutation={createPersonalEventMutation}
        getCategoryLabel={getCategoryLabel}
      />

      {/* Personal events list */}
      {(activeTab === 'all' || activeTab === 'personal') && hasPersonalEvents && (
        <PersonalEventsSection
          sortedPersonalEvents={sortedPersonalEvents}
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
      )}

      {/* School timelines + pending schools */}
      {(activeTab === 'all' || activeTab === 'school') && hasTimelines && (
        <TimelineTabs
          activeTab={activeTab}
          sortedTimelines={sortedTimelines}
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

      {/* Dynamic calculation note */}
      {hasAny && (
        <div className="flex items-start gap-2 rounded-[var(--theme-radius-card)] border bg-[color:var(--theme-control-bg)] p-3 text-sm">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground">{t('dynamicNote')}</span>
        </div>
      )}

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
