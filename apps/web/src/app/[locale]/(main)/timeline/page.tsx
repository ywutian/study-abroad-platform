'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  CheckCircle2,
  Info,
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  GraduationCap,
  Trophy,
  FileText,
  Target,
  Loader2,
  BookOpen,
  Briefcase,
  Users,
  ClipboardList,
  Bell,
  Star,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// ============ Types ============

interface TimelineResponse {
  id: string;
  schoolId: string;
  schoolName: string;
  round: string;
  deadline?: string;
  status: string;
  progress: number;
  priority: number;
  notes?: string;
  tasksTotal: number;
  tasksCompleted: number;
  createdAt: string;
}

interface TaskResponse {
  id: string;
  timelineId: string;
  title: string;
  type: string;
  description?: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  essayPrompt?: string;
  wordLimit?: number;
  sortOrder: number;
}

interface TimelineOverview {
  totalSchools: number;
  submitted: number;
  inProgress: number;
  notStarted: number;
  upcomingDeadlines: TimelineResponse[];
  overdueTasks: TaskResponse[];
  totalPersonalEvents: number;
  personalInProgress: number;
  personalCompleted: number;
  upcomingPersonalEvents: PersonalEventResponse[];
}

interface GlobalEvent {
  id: string;
  title: string;
  titleZh?: string;
  category: string;
  eventDate: string;
  registrationDeadline?: string;
  lateDeadline?: string;
  resultDate?: string;
  description?: string;
  descriptionZh?: string;
  url?: string;
  year: number;
}

interface TimelineDetail extends TimelineResponse {
  tasks?: TaskResponse[];
}

interface PersonalEventResponse {
  id: string;
  category: string;
  title: string;
  globalEventId?: string;
  deadline?: string;
  eventDate?: string;
  status: string;
  progress: number;
  priority: number;
  description?: string;
  url?: string;
  notes?: string;
  tasksTotal: number;
  tasksCompleted: number;
  createdAt: string;
}

interface PersonalTaskResponse {
  id: string;
  eventId: string;
  title: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  sortOrder: number;
}

interface PersonalEventDetail extends PersonalEventResponse {
  tasks?: PersonalTaskResponse[];
}

type TabType = 'all' | 'school' | 'personal';

const PERSONAL_CATEGORIES = [
  'COMPETITION',
  'TEST',
  'SUMMER_PROGRAM',
  'INTERNSHIP',
  'ACTIVITY',
  'MATERIAL',
  'OTHER',
] as const;

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
  const [newEvent, setNewEvent] = useState({
    title: '',
    category: 'COMPETITION' as string,
    deadline: '',
    eventDate: '',
    description: '',
  });

  // ============ Queries ============

  const { data: overview, isLoading: overviewLoading } = useQuery<TimelineOverview>({
    queryKey: ['timeline-overview'],
    queryFn: () => apiClient.get('/timeline/overview'),
  });

  const { data: timelines = [], isLoading: timelinesLoading } = useQuery<TimelineResponse[]>({
    queryKey: ['timelines'],
    queryFn: () => apiClient.get('/timeline'),
  });

  const { data: globalEvents = [] } = useQuery<GlobalEvent[]>({
    queryKey: ['global-events'],
    queryFn: () => apiClient.get('/timeline/global-events'),
  });

  const { data: personalEvents = [], isLoading: personalLoading } = useQuery<
    PersonalEventResponse[]
  >({
    queryKey: ['personal-events'],
    queryFn: () => apiClient.get('/timeline/personal-events'),
  });

  const { data: timelineDetail } = useQuery<TimelineDetail>({
    queryKey: ['timeline-detail', expandedTimeline],
    queryFn: () => apiClient.get(`/timeline/${expandedTimeline}`),
    enabled: !!expandedTimeline,
  });

  const { data: personalEventDetail } = useQuery<PersonalEventDetail>({
    queryKey: ['personal-event-detail', expandedPersonalEvent],
    queryFn: () => apiClient.get(`/timeline/personal-events/${expandedPersonalEvent}`),
    enabled: !!expandedPersonalEvent,
  });

  // ============ Mutations ============

  const toggleTaskMutation = useMutation({
    mutationFn: (taskId: string) => apiClient.post(`/timeline/tasks/${taskId}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-detail', expandedTimeline] });
      queryClient.invalidateQueries({ queryKey: ['timelines'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
    },
  });

  const deleteTimelineMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/timeline/${id}`),
    onSuccess: () => {
      toast.success(t('deleteSuccess'));
      queryClient.invalidateQueries({ queryKey: ['timelines'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
      setExpandedTimeline(null);
    },
  });

  const togglePersonalTaskMutation = useMutation({
    mutationFn: (taskId: string) => apiClient.post(`/timeline/personal-tasks/${taskId}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-event-detail', expandedPersonalEvent] });
      queryClient.invalidateQueries({ queryKey: ['personal-events'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
    },
  });

  const createPersonalEventMutation = useMutation({
    mutationFn: (data: typeof newEvent) => apiClient.post('/timeline/personal-events', data),
    onSuccess: () => {
      toast.success(t('personalEvents.createSuccess'));
      queryClient.invalidateQueries({ queryKey: ['personal-events'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-overview'] });
      setShowCreateEvent(false);
      setNewEvent({
        title: '',
        category: 'COMPETITION',
        deadline: '',
        eventDate: '',
        description: '',
      });
    },
  });

  const subscribeGlobalEventMutation = useMutation({
    mutationFn: (globalEventId: string) =>
      apiClient.post('/timeline/personal-events/subscribe', { globalEventId }),
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
    mutationFn: (id: string) => apiClient.delete(`/timeline/personal-events/${id}`),
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
    (status: string) => {
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

  const getRoundBadge = useCallback((round: string) => {
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

  const getCategoryIcon = useCallback((category: string) => {
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

  // 排序
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
    <div className="container mx-auto py-6 px-4 max-w-5xl space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-title">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('description')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCreateEvent(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {t('personalEvents.create')}
          </Button>
          <Button onClick={() => router.push('find-college')} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {t('addSchool')}
          </Button>
        </div>
      </div>

      {/* Tab 切换 */}
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

      {/* 概览统计 */}
      {hasAny && overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold">{overview.totalSchools}</div>
              <div className="text-xs text-muted-foreground">{t('overview.totalSchools')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{overview.inProgress}</div>
              <div className="text-xs text-muted-foreground">{t('overview.inProgress')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-green-600">{overview.submitted}</div>
              <div className="text-xs text-muted-foreground">{t('overview.submitted')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-muted-foreground">{overview.notStarted}</div>
              <div className="text-xs text-muted-foreground">{t('overview.notStarted')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{overview.totalPersonalEvents}</div>
              <div className="text-xs text-muted-foreground">
                {t('overview.totalPersonalEvents')}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {overview.personalCompleted}
              </div>
              <div className="text-xs text-muted-foreground">{t('overview.personalCompleted')}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 空状态 */}
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
              <Button onClick={() => router.push('find-college')}>
                <Plus className="h-4 w-4 mr-1" />
                {t('empty.action')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 全局事件（可订阅） */}
      {(activeTab === 'all' || activeTab === 'personal') && upcomingGlobalEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
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
                      {event.subscribed
                        ? t('globalEvents.subscribed')
                        : t('globalEvents.subscribe')}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 创建个人事件表单 */}
      {showCreateEvent && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('personalEvents.createTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  {t('personalEvents.form.title')}
                </label>
                <input
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent((v) => ({ ...v, title: e.target.value }))}
                  placeholder={t('personalEvents.form.titlePlaceholder')}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  {t('personalEvents.form.category')}
                </label>
                <select
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  value={newEvent.category}
                  onChange={(e) => setNewEvent((v) => ({ ...v, category: e.target.value }))}
                >
                  {PERSONAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {getCategoryLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  {t('personalEvents.form.deadline')}
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  value={newEvent.deadline}
                  onChange={(e) => setNewEvent((v) => ({ ...v, deadline: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  {t('personalEvents.form.eventDate')}
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                  value={newEvent.eventDate}
                  onChange={(e) => setNewEvent((v) => ({ ...v, eventDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">
                {t('personalEvents.form.description')}
              </label>
              <textarea
                className="w-full px-3 py-2 border rounded-md text-sm bg-background min-h-[80px]"
                value={newEvent.description}
                onChange={(e) => setNewEvent((v) => ({ ...v, description: e.target.value }))}
                placeholder={t('personalEvents.form.descriptionPlaceholder')}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowCreateEvent(false)}>
                {t('personalEvents.form.cancel')}
              </Button>
              <Button
                size="sm"
                disabled={!newEvent.title || createPersonalEventMutation.isPending}
                onClick={() => createPersonalEventMutation.mutate(newEvent)}
              >
                {createPersonalEventMutation.isPending && (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                )}
                {t('personalEvents.form.submit')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 个人事件列表 */}
      {(activeTab === 'all' || activeTab === 'personal') && hasPersonalEvents && (
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
              const tasks =
                isExpanded && personalEventDetail?.tasks ? personalEventDetail.tasks : [];

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
                        {days !== null && days >= 0 && (
                          <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
                            {formatDaysUntil(days)}
                          </span>
                        )}
                        <span>
                          {t('schoolTimelines.tasks')}: {ev.tasksCompleted}/{ev.tasksTotal}
                        </span>
                        {ev.globalEventId && (
                          <span className="text-xs text-blue-500">
                            {t('personalEvents.fromGlobal')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
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
                    <div className="border-t bg-muted/20 p-4">
                      {tasks.length > 0 ? (
                        <div className="space-y-2">
                          {tasks.map((task) => (
                            <div
                              key={task.id}
                              className="flex items-center gap-3 p-2 rounded-md hover:bg-background transition-colors"
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePersonalTaskMutation.mutate(task.id);
                                }}
                                className={`flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  task.completed
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : 'border-muted-foreground/30 hover:border-primary'
                                }`}
                              >
                                {task.completed && <CheckCircle2 className="h-3 w-3" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <span
                                  className={`text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}
                                >
                                  {task.title}
                                </span>
                                {task.dueDate && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {formatDate(task.dueDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                          {t('schoolTimelines.loadingTasks')}
                        </div>
                      )}

                      <div className="mt-4 pt-3 border-t flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(t('deleteConfirm'))) {
                              deletePersonalEventMutation.mutate(ev.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t('personalEvents.delete')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 学校时间线列表 */}
      {(activeTab === 'all' || activeTab === 'school') && hasTimelines && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('schoolTimelines.title')}</CardTitle>
            <CardDescription>{t('schoolTimelines.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sortedTimelines.map((tl) => {
              const isExpanded = expandedTimeline === tl.id;
              const days = getDaysUntil(tl.deadline);
              const tasks = isExpanded && timelineDetail?.tasks ? timelineDetail.tasks : [];

              return (
                <div key={tl.id} className="border rounded-lg overflow-hidden">
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedTimeline(isExpanded ? null : tl.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold truncate">{tl.schoolName}</span>
                        {getRoundBadge(tl.round)}
                        {getStatusBadge(tl.status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {t('schoolTimelines.deadline')}: {formatDate(tl.deadline)}
                        </span>
                        {days !== null && days >= 0 && (
                          <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
                            {formatDaysUntil(days)}
                          </span>
                        )}
                        <span>
                          {t('schoolTimelines.tasks')}: {tl.tasksCompleted}/{tl.tasksTotal}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
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
                    <div className="border-t bg-muted/20 p-4">
                      {tasks.length > 0 ? (
                        <div className="space-y-2">
                          {tasks.map((task) => (
                            <div
                              key={task.id}
                              className="flex items-center gap-3 p-2 rounded-md hover:bg-background transition-colors"
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTaskMutation.mutate(task.id);
                                }}
                                className={`flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  task.completed
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : 'border-muted-foreground/30 hover:border-primary'
                                }`}
                              >
                                {task.completed && <CheckCircle2 className="h-3 w-3" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <span
                                  className={`text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}
                                >
                                  {task.title}
                                </span>
                                {task.dueDate && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {formatDate(task.dueDate)}
                                  </span>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {task.type}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                          {t('schoolTimelines.loadingTasks')}
                        </div>
                      )}

                      <div className="mt-4 pt-3 border-t flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(t('deleteConfirm'))) {
                              deleteTimelineMutation.mutate(tl.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t('deleteTimeline')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 动态计算提示 */}
      {hasAny && (
        <div className="p-3 bg-muted/50 rounded-lg flex items-start gap-2 text-sm">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground">{t('dynamicNote')}</span>
        </div>
      )}
    </div>
  );
}
