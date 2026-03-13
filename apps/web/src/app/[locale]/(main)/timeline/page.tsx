'use client';

import { useState, useMemo, useCallback, type ReactNode } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Calendar,
  CheckCircle2,
  Plus,
  GraduationCap,
  Trophy,
  FileText,
  Target,
  Loader2,
  BookOpen,
  Briefcase,
  Users,
  ClipboardList,
  Info,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageContainer, PageHeader } from '@/components/layout';
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

// ============ Page Component ============

export default function TimelinePage() {
  const t = useTranslations('timeline');
  const format = useFormatter();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('all');
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

  const { data: overview, isLoading: overviewLoading } = useQuery<TimelineOverviewType>({
    queryKey: ['timeline-overview'],
    queryFn: () => apiClient.get('/timelines/overview'),
  });

  const { data: timelines = [], isLoading: timelinesLoading } = useQuery<TimelineResponse[]>({
    queryKey: ['timelines'],
    queryFn: () => apiClient.get('/timelines'),
  });

  const { data: globalEvents = [] } = useQuery<GlobalEvent[]>({
    queryKey: ['global-events'],
    queryFn: () => apiClient.get('/timelines/global-events'),
  });

  const { data: personalEvents = [], isLoading: personalLoading } = useQuery<
    PersonalEventResponse[]
  >({
    queryKey: ['personal-events'],
    queryFn: () => apiClient.get('/timelines/personal-events'),
  });

  const { data: schoolListItems = [] } = useQuery<
    Array<{ id: string; schoolId: string; school: { id: string; name: string; nameZh?: string } }>
  >({
    queryKey: ['school-lists'],
    queryFn: () => apiClient.get('/school-lists'),
  });

  const generateTimelineMutation = useMutation({
    mutationFn: (schoolIds: string[]) => apiClient.post('/timelines/generate', { schoolIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timelines'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
      toast.success(t('generateSuccess'));
    },
  });

  const { data: timelineDetail, isLoading: timelineDetailLoading } = useQuery<TimelineDetail>({
    queryKey: ['timeline-detail', expandedTimeline],
    queryFn: () => apiClient.get(`/timelines/${expandedTimeline}`),
    enabled: !!expandedTimeline,
  });

  const { data: personalEventDetail, isLoading: personalEventDetailLoading } =
    useQuery<PersonalEventDetail>({
      queryKey: ['personal-event-detail', expandedPersonalEvent],
      queryFn: () => apiClient.get(`/timelines/personal-events/${expandedPersonalEvent}`),
      enabled: !!expandedPersonalEvent,
    });

  // ============ Mutations ============

  const toggleTaskMutation = useMutation({
    mutationFn: (taskId: string) => apiClient.post(`/timelines/tasks/${taskId}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-detail', expandedTimeline] });
      queryClient.invalidateQueries({ queryKey: ['timelines'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
    },
  });

  const deleteTimelineMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/timelines/${id}`),
    onSuccess: () => {
      toast.success(t('deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['timelines'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
      setExpandedTimeline(null);
    },
  });

  const togglePersonalTaskMutation = useMutation({
    mutationFn: (taskId: string) => apiClient.post(`/timelines/personal-tasks/${taskId}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-event-detail', expandedPersonalEvent] });
      queryClient.invalidateQueries({ queryKey: ['personal-events'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
    },
  });

  const createPersonalEventMutation = useMutation({
    mutationFn: (data: PersonalEventFormData) => apiClient.post('/timelines/personal-events', data),
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
      apiClient.post('/timelines/personal-events/subscribe', { globalEventId }),
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
    mutationFn: (id: string) => apiClient.delete(`/timelines/personal-events/${id}`),
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

  const schoolsWithoutTimeline = useMemo(() => {
    const timelineSchoolIds = new Set(timelines.map((tl) => tl.schoolId));
    return schoolListItems.filter((item) => item.school && !timelineSchoolIds.has(item.schoolId));
  }, [timelines, schoolListItems]);

  const formatDate = useCallback(
    (dateStr?: string) => {
      if (!dateStr) return '-';
      return format.dateTime(new Date(dateStr), 'medium');
    },
    [format]
  );

  const getDaysUntil = useCallback((dateStr?: string) => {
    if (!dateStr) return null;
    const now = new Date();
    const target = new Date(dateStr);
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }, []);

  const formatDaysUntil = useCallback(
    (days: number | null) => {
      if (days === null) return '';
      if (days < 0) return t('daysAgo', { days: Math.abs(days) });
      if (days === 0) return t('today');
      if (days === 1) return t('tomorrow');
      return t('daysLeft', { days });
    },
    [t]
  );

  const getStatusBadge = useCallback(
    (status: string): ReactNode => {
      switch (status) {
        case 'SUBMITTED':
          return <Badge variant="success">{t('statuses.submitted')}</Badge>;
        case 'IN_PROGRESS':
          return <Badge variant="warning">{t('statuses.inProgress')}</Badge>;
        case 'ACCEPTED':
          return <Badge variant="solid-success">{t('statuses.accepted')}</Badge>;
        case 'REJECTED':
          return <Badge variant="destructive">{t('statuses.rejected')}</Badge>;
        case 'WAITLISTED':
          return <Badge variant="purple">{t('statuses.waitlisted')}</Badge>;
        case 'WITHDRAWN':
          return <Badge variant="secondary">{t('statuses.withdrawn')}</Badge>;
        case 'COMPLETED':
          return <Badge variant="success">{t('statuses.completed')}</Badge>;
        case 'CANCELLED':
          return <Badge variant="secondary">{t('statuses.cancelled')}</Badge>;
        case 'NOT_STARTED':
          return <Badge variant="outline">{t('statuses.notStarted')}</Badge>;
        default:
          return <Badge variant="outline">{t('statuses.notStarted')}</Badge>;
      }
    },
    [t]
  );

  const getRoundBadge = useCallback((round: string): ReactNode => {
    const colors: Record<string, string> = {
      ED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      ED2: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      EA: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      REA: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      RD: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      Rolling: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${colors[round] || colors.RD}`}>
        {round}
      </span>
    );
  }, []);

  const getCategoryIcon = useCallback((category: string): ReactNode => {
    switch (category) {
      case 'TEST':
        return <FileText className="h-4 w-4" />;
      case 'COMPETITION':
        return <Trophy className="h-4 w-4" />;
      case 'SUMMER_PROGRAM':
        return <BookOpen className="h-4 w-4" />;
      case 'INTERNSHIP':
        return <Briefcase className="h-4 w-4" />;
      case 'ACTIVITY':
        return <Users className="h-4 w-4" />;
      case 'MATERIAL':
        return <ClipboardList className="h-4 w-4" />;
      case 'FINANCIAL_AID':
        return <Target className="h-4 w-4" />;
      case 'APPLICATION':
        return <GraduationCap className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  }, []);

  const getCategoryLabel = useCallback(
    (category: string) => {
      const key = `personalEvents.categories.${category}`;
      try {
        return t(key);
      } catch {
        return category;
      }
    },
    [t]
  );

  const getCategoryColor = useCallback((category: string) => {
    const colors: Record<string, string> = {
      COMPETITION: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      TEST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      SUMMER_PROGRAM: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      INTERNSHIP: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      ACTIVITY: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
      MATERIAL: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      OTHER: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    };
    return colors[category] || colors.OTHER;
  }, []);

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
            <Button variant="outline" size="sm" onClick={() => setShowCreateEvent(true)}>
              <Plus className="h-4 w-4 mr-1" />
              {t('personalEvents.create')}
            </Button>
            <Button onClick={() => router.push('schools')} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              {t('addSchool')}
            </Button>
          </>
        }
      />

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {(['all', 'school', 'personal'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
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
              <Button variant="outline" onClick={() => setShowCreateEvent(true)}>
                <Plus className="h-4 w-4 mr-1" />
                {t('personalEvents.create')}
              </Button>
              <Button onClick={() => router.push('schools')}>
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
        <div className="p-3 bg-muted/50 rounded-lg flex items-start gap-2 text-sm">
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
