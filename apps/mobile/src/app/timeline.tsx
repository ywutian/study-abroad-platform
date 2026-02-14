/**
 * Timeline Page - Application timelines, tasks, personal & global events.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  AnimatedButton,
  AnimatedCard,
  CardContent,
  Badge,
  EmptyState,
  Loading,
  Input,
  Modal,
  Progress,
  Segment,
  Checkbox,
  ConfirmDialog,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Types ──────────────────────────────────────────────────

enum ApplicationRound {
  ED = 'ED',
  ED2 = 'ED2',
  EA = 'EA',
  REA = 'REA',
  RD = 'RD',
  ROLLING = 'Rolling',
}
enum TimelineStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WAITLISTED = 'WAITLISTED',
  WITHDRAWN = 'WITHDRAWN',
}
enum TaskType {
  ESSAY = 'ESSAY',
  DOCUMENT = 'DOCUMENT',
  TEST = 'TEST',
  INTERVIEW = 'INTERVIEW',
  RECOMMENDATION = 'RECOMMENDATION',
  OTHER = 'OTHER',
}

interface TimelineResponse {
  id: string;
  schoolId: string;
  schoolName: string;
  round: ApplicationRound;
  deadline?: Date;
  status: TimelineStatus;
  progress: number;
  priority: number;
  notes?: string;
  tasksTotal: number;
  tasksCompleted: number;
  createdAt: Date;
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
  upcomingPersonalEvents: any[];
}
interface TaskResponse {
  id: string;
  timelineId: string;
  title: string;
  type: TaskType;
  description?: string;
  dueDate?: Date;
  completed: boolean;
  completedAt?: Date;
  essayPrompt?: string;
  wordLimit?: number;
  sortOrder: number;
}
interface PersonalEventResponse {
  id: string;
  title: string;
  category: string;
  deadline?: Date;
  eventDate?: Date;
  priority?: number;
  description?: string;
  url?: string;
  notes?: string;
  tasks: { id: string; eventId: string; title: string; dueDate?: Date; completed: boolean }[];
  createdAt: Date;
}
interface GlobalEventResponse {
  id: string;
  title: string;
  category: string;
  eventDate: Date;
  registrationDeadline?: Date;
  description?: string;
  url?: string;
}

// ── Constants ──────────────────────────────────────────────

const ROUND_VARIANTS: Record<string, 'error' | 'default' | 'secondary' | 'success'> = {
  ED: 'error',
  ED2: 'error',
  EA: 'default',
  REA: 'default',
  RD: 'secondary',
  Rolling: 'success',
};
const STATUS_VARIANTS: Record<string, 'secondary' | 'default' | 'success' | 'error' | 'warning'> = {
  NOT_STARTED: 'secondary',
  IN_PROGRESS: 'default',
  SUBMITTED: 'default',
  ACCEPTED: 'success',
  REJECTED: 'error',
  WAITLISTED: 'warning',
  WITHDRAWN: 'secondary',
};
const TASK_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  ESSAY: 'document-text-outline',
  DOCUMENT: 'folder-outline',
  TEST: 'school-outline',
  INTERVIEW: 'people-outline',
  RECOMMENDATION: 'mail-outline',
  OTHER: 'ellipsis-horizontal',
};

const keys = {
  list: ['timeline', 'list'] as const,
  overview: ['timeline', 'overview'] as const,
  personal: ['timeline', 'personalEvents'] as const,
  global: (y: number) => ['timeline', 'globalEvents', y] as const,
  tasks: (id: string) => ['timeline', 'tasks', id] as const,
};

// ── Helpers ────────────────────────────────────────────────

const getDaysLeft = (d?: Date | string) => {
  if (!d) return null;
  const target = new Date(d);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
};
const fmtDate = (d?: Date | string) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// ── Main Component ─────────────────────────────────────────

export default function TimelinePage() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState('schools');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [taskModal, setTaskModal] = useState<{ visible: boolean; timelineId: string | null }>({
    visible: false,
    timelineId: null,
  });
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [eventModal, setEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({ title: '', category: '', notes: '' });
  const [deleteDialog, setDeleteDialog] = useState<{
    visible: boolean;
    type: 'timeline' | 'event';
    id: string;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const statusColor = useCallback(
    (s: TimelineStatus) => {
      const m: Record<string, string> = {
        NOT_STARTED: colors.foregroundMuted,
        IN_PROGRESS: colors.info,
        SUBMITTED: colors.primary,
        ACCEPTED: colors.success,
        REJECTED: colors.error,
        WAITLISTED: colors.warning,
        WITHDRAWN: colors.foregroundMuted,
      };
      return m[s] ?? colors.foregroundMuted;
    },
    [colors]
  );

  // ── Queries ──

  const {
    data: timelines,
    isLoading: tlLoading,
    refetch: refetchTl,
  } = useQuery<TimelineResponse[]>({
    queryKey: keys.list,
    queryFn: () => apiClient.get('/timelines'),
  });
  const {
    data: overview,
    isLoading: ovLoading,
    refetch: refetchOv,
  } = useQuery<TimelineOverview>({
    queryKey: keys.overview,
    queryFn: () => apiClient.get('/timelines/overview'),
    enabled: activeTab === 'overview',
  });
  const {
    data: personalEvents,
    isLoading: peLoading,
    refetch: refetchPe,
  } = useQuery<PersonalEventResponse[]>({
    queryKey: keys.personal,
    queryFn: () => apiClient.get('/timelines/personal-events'),
    enabled: activeTab === 'events',
  });
  const yr = new Date().getFullYear();
  const { data: globalEvents, isLoading: geLoading } = useQuery<GlobalEventResponse[]>({
    queryKey: keys.global(yr),
    queryFn: () => apiClient.get('/timelines/global-events', { params: { year: yr } }),
    enabled: activeTab === 'events',
  });

  // ── Mutations ──

  const invalidateTl = () => {
    qc.invalidateQueries({ queryKey: keys.list });
    qc.invalidateQueries({ queryKey: keys.overview });
  };

  const toggleTask = useMutation<TaskResponse, Error, string>({
    mutationFn: (id) => apiClient.post(`/timelines/tasks/${id}/toggle`),
    onSuccess: () => {
      invalidateTl();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onError: (e) => toast.error(e.message),
  });
  const addTask = useMutation<TaskResponse, Error, { timelineId: string; title: string }>({
    mutationFn: (dto) => apiClient.post('/timelines/tasks', dto),
    onSuccess: () => {
      invalidateTl();
      setTaskModal({ visible: false, timelineId: null });
      setNewTaskTitle('');
      toast.success(t('timeline.taskAdded', 'Task added'));
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteTl = useMutation<void, Error, string>({
    mutationFn: (id) => apiClient.delete(`/timelines/${id}`),
    onSuccess: () => {
      invalidateTl();
      toast.success(t('timeline.deleted', 'Deleted'));
    },
    onError: (e) => toast.error(e.message),
  });
  const addEvent = useMutation<
    PersonalEventResponse,
    Error,
    { title: string; category: string; notes?: string }
  >({
    mutationFn: (dto) => apiClient.post('/timelines/personal-events', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.personal });
      setEventModal(false);
      setEventForm({ title: '', category: '', notes: '' });
      toast.success(t('timeline.eventAdded', 'Event added'));
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteEvt = useMutation<void, Error, string>({
    mutationFn: (id) => apiClient.delete(`/timelines/personal-events/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.personal });
      toast.success(t('timeline.deleted', 'Deleted'));
    },
    onError: (e) => toast.error(e.message),
  });
  const subscribe = useMutation<PersonalEventResponse, Error, string>({
    mutationFn: (gid) =>
      apiClient.post('/timelines/personal-events/subscribe', { globalEventId: gid }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.personal });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('timeline.subscribed', 'Added to your events'));
    },
    onError: (e) => toast.error(e.message),
  });
  const togglePTask = useMutation<any, Error, string>({
    mutationFn: (id) => apiClient.post(`/timelines/personal-tasks/${id}/toggle`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.personal });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Derived ──

  const sorted = useMemo(() => {
    if (!timelines) return [];
    return [...timelines].sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [timelines]);

  const sortedGlobal = useMemo(() => {
    if (!globalEvents) return [];
    return [...globalEvents].sort(
      (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    );
  }, [globalEvents]);

  // ── Handlers ──

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((p) => (p === id ? null : id));
  };
  const toggleEvt = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedEventId((p) => (p === id ? null : id));
  };
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all(
      [
        refetchTl(),
        activeTab === 'overview' ? refetchOv() : null,
        activeTab === 'events' ? refetchPe() : null,
      ].filter(Boolean)
    );
    setRefreshing(false);
  }, [refetchTl, refetchOv, refetchPe, activeTab]);
  const confirmDelete = () => {
    if (!deleteDialog) return;
    (deleteDialog.type === 'timeline' ? deleteTl : deleteEvt).mutate(deleteDialog.id);
    setDeleteDialog(null);
  };

  // ── Render: Overview Header ──

  const renderHeader = () => {
    const total = timelines?.length ?? 0;
    const sub = timelines?.filter((x) => x.status === TimelineStatus.SUBMITTED).length ?? 0;
    const prog = timelines?.filter((x) => x.status === TimelineStatus.IN_PROGRESS).length ?? 0;
    const upcoming =
      timelines?.filter((x) => {
        const d = getDaysLeft(x.deadline);
        return d !== null && d >= 0 && d <= 14;
      }).length ?? 0;
    return (
      <Animated.View entering={FadeInDown.duration(400).springify()}>
        <AnimatedCard style={s.headerCard}>
          <CardContent>
            <View style={s.headerRow}>
              {[
                { v: total, l: t('timeline.overview.totalSchools', 'Total'), c: colors.foreground },
                { v: sub, l: t('timeline.overview.submitted', 'Submitted'), c: colors.primary },
                { v: prog, l: t('timeline.overview.inProgress', 'In Progress'), c: colors.info },
                { v: upcoming, l: t('timeline.overview.upcoming', 'Upcoming'), c: colors.warning },
              ].map((s) => (
                <View key={s.l} style={styles.headerStat}>
                  <Text style={[styles.headerStatVal, { color: s.c }]}>{s.v}</Text>
                  <Text style={[styles.headerStatLbl, { color: colors.foregroundMuted }]}>
                    {s.l}
                  </Text>
                </View>
              ))}
            </View>
            <Progress
              value={total > 0 ? Math.round((sub / total) * 100) : 0}
              max={100}
              height={6}
              color={colors.primary}
              trackColor={colors.muted}
              style={{ marginTop: spacing.md }}
            />
          </CardContent>
        </AnimatedCard>
      </Animated.View>
    );
  };

  // ── Render: Schools Tab ──

  const renderSchoolCard = (item: TimelineResponse, idx: number) => {
    const open = expandedId === item.id;
    const days = getDaysLeft(item.deadline);
    const overdue = days !== null && days < 0;
    return (
      <Animated.View key={item.id} entering={FadeInUp.delay(idx * 60).springify()}>
        <AnimatedCard
          style={[s.card, { borderLeftWidth: 3, borderLeftColor: statusColor(item.status) }]}
          onPress={() => toggle(item.id)}
        >
          <CardContent>
            <View style={s.row}>
              <View style={{ flex: 1, marginRight: spacing.md, gap: spacing.sm }}>
                <Text style={[s.name, { color: colors.foreground }]} numberOfLines={1}>
                  {item.schoolName}
                </Text>
                <View style={s.badges}>
                  <Badge variant={ROUND_VARIANTS[item.round] ?? 'secondary'}>
                    {t(`timeline.round.${item.round}`, item.round)}
                  </Badge>
                  <Badge variant={STATUS_VARIANTS[item.status] ?? 'secondary'}>
                    {t(`timeline.status.${item.status}`, item.status)}
                  </Badge>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                {item.deadline && (
                  <View style={s.deadlineRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={overdue ? colors.error : colors.foregroundMuted}
                    />
                    <Text
                      style={[
                        s.deadlineTxt,
                        { color: overdue ? colors.error : colors.foregroundMuted },
                      ]}
                    >
                      {fmtDate(item.deadline)}
                    </Text>
                  </View>
                )}
                {days !== null && (
                  <Text
                    style={[
                      s.daysLeft,
                      {
                        color: overdue
                          ? colors.error
                          : days <= 7
                            ? colors.warning
                            : colors.foregroundMuted,
                      },
                    ]}
                  >
                    {overdue
                      ? t('timeline.overdue', 'Overdue')
                      : t('timeline.daysLeft', '{{count}} days left', { count: days })}
                  </Text>
                )}
              </View>
            </View>
            <View style={s.progRow}>
              <Progress
                value={item.tasksCompleted}
                max={item.tasksTotal || 1}
                height={4}
                color={statusColor(item.status)}
                trackColor={colors.muted}
                style={{ flex: 1 }}
              />
              <Text style={[s.progTxt, { color: colors.foregroundMuted }]}>
                {item.tasksCompleted}/{item.tasksTotal}
              </Text>
            </View>
            {open && (
              <View style={s.expanded}>
                <InlineTaskList
                  timelineId={item.id}
                  colors={colors}
                  t={t}
                  onToggle={(id) => toggleTask.mutate(id)}
                  onAdd={() => {
                    setTaskModal({ visible: true, timelineId: item.id });
                    setNewTaskTitle('');
                  }}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    marginTop: spacing.sm,
                  }}
                >
                  <AnimatedButton
                    variant="ghost"
                    size="sm"
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setDeleteDialog({ visible: true, type: 'timeline', id: item.id });
                    }}
                    leftIcon={<Ionicons name="trash-outline" size={16} color={colors.error} />}
                  >
                    <Text style={{ color: colors.error }}>{t('timeline.delete', 'Delete')}</Text>
                  </AnimatedButton>
                </View>
              </View>
            )}
          </CardContent>
        </AnimatedCard>
      </Animated.View>
    );
  };

  const renderSchools = () => {
    if (tlLoading) return <Loading text={t('timeline.loading', 'Loading...')} />;
    if (!sorted.length)
      return (
        <EmptyState
          icon="school-outline"
          title={t('timeline.empty.noSchools', 'No schools yet')}
          description={t(
            'timeline.empty.noSchoolsDesc',
            'Add schools to track your application progress.'
          )}
        />
      );
    return <>{sorted.map((x, i) => renderSchoolCard(x, i))}</>;
  };

  // ── Render: Events Tab ──

  const renderEvents = () => {
    if (peLoading || geLoading) return <Loading text={t('timeline.loading', 'Loading...')} />;
    return (
      <>
        <View style={s.sectionHdr}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>
            {t('timeline.events.personal', 'My Events')}
          </Text>
          <AnimatedButton
            variant="ghost"
            size="sm"
            onPress={() => setEventModal(true)}
            leftIcon={<Ionicons name="add" size={18} color={colors.primary} />}
          >
            {t('timeline.addEvent', 'Add')}
          </AnimatedButton>
        </View>
        {!personalEvents?.length ? (
          <EmptyState
            icon="calendar-outline"
            title={t('timeline.empty.noEvents', 'No events yet')}
            description={t(
              'timeline.empty.noEventsDesc',
              'Create events or subscribe to global events.'
            )}
            style={{ paddingVertical: spacing.xl }}
          />
        ) : (
          personalEvents.map((ev, i) => {
            const open = expandedEventId === ev.id;
            const done = ev.tasks?.filter((t) => t.completed).length ?? 0;
            const total = ev.tasks?.length ?? 0;
            return (
              <Animated.View key={ev.id} entering={FadeInUp.delay(i * 60).springify()}>
                <AnimatedCard style={s.card} onPress={() => toggleEvt(ev.id)}>
                  <CardContent>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.sm,
                        }}
                      >
                        <Badge variant="outline">{ev.category}</Badge>
                        <Text
                          style={[s.name, { color: colors.foreground, flex: 1 }]}
                          numberOfLines={1}
                        >
                          {ev.title}
                        </Text>
                      </View>
                      <Ionicons
                        name={open ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.foregroundMuted}
                      />
                    </View>
                    {(ev.deadline || ev.eventDate) && (
                      <View style={[s.deadlineRow, { marginTop: spacing.sm }]}>
                        <Ionicons name="time-outline" size={14} color={colors.foregroundMuted} />
                        <Text style={[s.deadlineTxt, { color: colors.foregroundMuted }]}>
                          {fmtDate(ev.deadline || ev.eventDate)}
                        </Text>
                      </View>
                    )}
                    {total > 0 && (
                      <View style={s.progRow}>
                        <Progress
                          value={done}
                          max={total}
                          height={4}
                          color={colors.primary}
                          trackColor={colors.muted}
                          style={{ flex: 1 }}
                        />
                        <Text style={[s.progTxt, { color: colors.foregroundMuted }]}>
                          {done}/{total}
                        </Text>
                      </View>
                    )}
                    {open && (
                      <View style={s.expanded}>
                        {ev.notes ? (
                          <Text
                            style={[
                              {
                                fontSize: fontSize.sm,
                                lineHeight: fontSize.sm * 1.5,
                                marginBottom: spacing.md,
                              },
                              { color: colors.foregroundSecondary },
                            ]}
                          >
                            {ev.notes}
                          </Text>
                        ) : null}
                        {ev.tasks?.map((tk) => (
                          <Checkbox
                            key={tk.id}
                            checked={tk.completed}
                            onPress={() => togglePTask.mutate(tk.id)}
                            label={tk.title}
                          />
                        ))}
                        <AnimatedButton
                          variant="ghost"
                          size="sm"
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setDeleteDialog({ visible: true, type: 'event', id: ev.id });
                          }}
                          leftIcon={
                            <Ionicons name="trash-outline" size={16} color={colors.error} />
                          }
                          style={{ alignSelf: 'flex-start', marginTop: spacing.sm }}
                        >
                          <Text style={{ color: colors.error }}>
                            {t('timeline.delete', 'Delete')}
                          </Text>
                        </AnimatedButton>
                      </View>
                    )}
                  </CardContent>
                </AnimatedCard>
              </Animated.View>
            );
          })
        )}

        <View style={[s.sectionHdr, { marginTop: spacing.xl }]}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>
            {t('timeline.events.global', 'Global Events')}
          </Text>
        </View>
        {!sortedGlobal.length ? (
          <Text
            style={{
              fontSize: fontSize.sm,
              fontStyle: 'italic',
              textAlign: 'center',
              paddingVertical: spacing.xl,
              color: colors.foregroundMuted,
            }}
          >
            {t('timeline.events.noGlobal', 'No upcoming global events.')}
          </Text>
        ) : (
          <AnimatedCard>
            <CardContent style={{ paddingVertical: 0 }}>
              {sortedGlobal.map((ge, i) => {
                const d = getDaysLeft(ge.eventDate);
                return (
                  <View
                    key={ge.id}
                    style={[
                      s.globalRow,
                      i < sortedGlobal.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <View style={{ alignItems: 'center', width: 44 }}>
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          fontWeight: fontWeight.semibold,
                          textTransform: 'uppercase',
                          color: colors.primary,
                        }}
                      >
                        {new Date(ge.eventDate).toLocaleDateString(undefined, { month: 'short' })}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.xl,
                          fontWeight: fontWeight.bold,
                          color: colors.foreground,
                        }}
                      >
                        {new Date(ge.eventDate).getDate()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: fontSize.sm,
                          fontWeight: fontWeight.medium,
                          color: colors.foreground,
                        }}
                        numberOfLines={1}
                      >
                        {ge.title}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.xs,
                          color: colors.foregroundMuted,
                          marginTop: 2,
                        }}
                      >
                        {ge.category}
                        {d !== null && d >= 0
                          ? ` - ${t('timeline.daysLeft', '{{count}} days left', { count: d })}`
                          : ''}
                      </Text>
                    </View>
                    <AnimatedButton
                      variant="outline"
                      size="sm"
                      onPress={() => subscribe.mutate(ge.id)}
                      disabled={subscribe.isPending}
                    >
                      {t('timeline.events.subscribe', 'Add')}
                    </AnimatedButton>
                  </View>
                );
              })}
            </CardContent>
          </AnimatedCard>
        )}
      </>
    );
  };

  // ── Render: Overview Tab ──

  const renderOverview = () => {
    if (ovLoading) return <Loading text={t('timeline.loading', 'Loading...')} />;
    if (!overview)
      return <EmptyState icon="analytics-outline" title={t('timeline.empty.noData', 'No data')} />;
    const stats = [
      {
        l: t('timeline.overview.totalSchools', 'Total'),
        v: overview.totalSchools,
        c: colors.foreground,
        i: 'school-outline' as const,
      },
      {
        l: t('timeline.overview.submitted', 'Submitted'),
        v: overview.submitted,
        c: colors.primary,
        i: 'checkmark-circle-outline' as const,
      },
      {
        l: t('timeline.overview.inProgress', 'In Progress'),
        v: overview.inProgress,
        c: colors.info,
        i: 'reload-outline' as const,
      },
      {
        l: t('timeline.overview.notStarted', 'Not Started'),
        v: overview.notStarted,
        c: colors.foregroundMuted,
        i: 'ellipsis-horizontal-outline' as const,
      },
    ];
    return (
      <>
        <View style={s.statsGrid}>
          {stats.map((st, i) => (
            <Animated.View
              key={st.l}
              entering={FadeInUp.delay(i * 80).springify()}
              style={{ width: '47%' }}
            >
              <AnimatedCard>
                <CardContent style={{ alignItems: 'center', gap: spacing.xs }}>
                  <Ionicons name={st.i} size={22} color={st.c} />
                  <Text
                    style={{ fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: st.c }}
                  >
                    {st.v}
                  </Text>
                  <Text
                    style={{
                      fontSize: fontSize.xs,
                      color: colors.foregroundMuted,
                      textAlign: 'center',
                    }}
                    numberOfLines={1}
                  >
                    {st.l}
                  </Text>
                </CardContent>
              </AnimatedCard>
            </Animated.View>
          ))}
        </View>
        {overview.upcomingDeadlines.length > 0 && (
          <Animated.View entering={FadeInUp.delay(300).springify()}>
            <Text style={[s.sectionTitle, { color: colors.foreground, marginBottom: spacing.md }]}>
              {t('timeline.overview.upcomingDeadlines', 'Upcoming Deadlines')}
            </Text>
            {overview.upcomingDeadlines.slice(0, 5).map((item) => {
              const d = getDaysLeft(item.deadline);
              return (
                <View
                  key={item.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    gap: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: statusColor(item.status),
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: fontSize.sm,
                        fontWeight: fontWeight.medium,
                        color: colors.foreground,
                      }}
                      numberOfLines={1}
                    >
                      {item.schoolName}
                    </Text>
                    <Text
                      style={{ fontSize: fontSize.xs, color: colors.foregroundMuted, marginTop: 2 }}
                    >
                      {fmtDate(item.deadline)}
                    </Text>
                  </View>
                  {d !== null && (
                    <Badge variant={d < 0 ? 'error' : d <= 7 ? 'warning' : 'secondary'}>
                      {d < 0 ? t('timeline.overdue', 'Overdue') : `${d}d`}
                    </Badge>
                  )}
                </View>
              );
            })}
          </Animated.View>
        )}
        {overview.overdueTasks.length > 0 && (
          <Animated.View
            entering={FadeInUp.delay(400).springify()}
            style={{ marginTop: spacing.xl }}
          >
            <Text style={[s.sectionTitle, { color: colors.error, marginBottom: spacing.md }]}>
              {t('timeline.overview.overdueTasks', 'Overdue Tasks')}
            </Text>
            {overview.overdueTasks.map((tk) => (
              <View
                key={tk.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: borderRadius.md,
                  borderWidth: 1,
                  borderColor: colors.error + '20',
                  backgroundColor: colors.error + '08',
                  marginBottom: spacing.sm,
                }}
              >
                <Ionicons
                  name={TASK_ICONS[tk.type] ?? 'ellipsis-horizontal'}
                  size={16}
                  color={colors.error}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: fontSize.sm,
                      fontWeight: fontWeight.medium,
                      color: colors.foreground,
                    }}
                  >
                    {tk.title}
                  </Text>
                  {tk.dueDate && (
                    <Text style={{ fontSize: fontSize.xs, color: colors.error, marginTop: 2 }}>
                      {t('timeline.overdue', 'Overdue')} - {fmtDate(tk.dueDate)}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </Animated.View>
        )}
      </>
    );
  };

  // ── Render: Main ──

  return (
    <>
      <Stack.Screen options={{ title: t('timeline.title', 'Timeline') }} />
      <ScrollView
        style={[s.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.px}>{renderHeader()}</View>
        <View style={s.tabs}>
          <Segment
            segments={[
              { key: 'schools', label: t('timeline.tabs.schools', 'Schools') },
              { key: 'events', label: t('timeline.tabs.events', 'Events') },
              { key: 'overview', label: t('timeline.tabs.overview', 'Overview') },
            ]}
            value={activeTab}
            onChange={(k) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab(k);
            }}
          />
        </View>
        <View style={s.px}>
          {activeTab === 'schools' && renderSchools()}
          {activeTab === 'events' && renderEvents()}
          {activeTab === 'overview' && renderOverview()}
        </View>
      </ScrollView>

      <Modal
        visible={taskModal.visible}
        onClose={() => setTaskModal({ visible: false, timelineId: null })}
        title={t('timeline.addTask', 'Add Task')}
        footer={
          <AnimatedButton
            onPress={() => {
              if (taskModal.timelineId && newTaskTitle.trim())
                addTask.mutate({ timelineId: taskModal.timelineId, title: newTaskTitle.trim() });
            }}
            disabled={!newTaskTitle.trim() || addTask.isPending}
            loading={addTask.isPending}
          >
            {t('timeline.save', 'Save')}
          </AnimatedButton>
        }
      >
        <Input
          label={t('timeline.taskTitle', 'Task Title')}
          placeholder={t('timeline.taskTitlePlaceholder', 'Enter task title...')}
          value={newTaskTitle}
          onChangeText={setNewTaskTitle}
          autoFocus
        />
      </Modal>

      <Modal
        visible={eventModal}
        onClose={() => setEventModal(false)}
        title={t('timeline.addEvent', 'Add Event')}
        footer={
          <AnimatedButton
            onPress={() => {
              if (eventForm.title.trim())
                addEvent.mutate({
                  title: eventForm.title.trim(),
                  category: eventForm.category.trim() || 'general',
                  notes: eventForm.notes.trim() || undefined,
                });
            }}
            disabled={!eventForm.title.trim() || addEvent.isPending}
            loading={addEvent.isPending}
          >
            {t('timeline.save', 'Save')}
          </AnimatedButton>
        }
      >
        <Input
          label={t('timeline.eventTitle', 'Title')}
          placeholder={t('timeline.eventTitlePlaceholder', 'Enter event title...')}
          value={eventForm.title}
          onChangeText={(v) => setEventForm((p) => ({ ...p, title: v }))}
          autoFocus
        />
        <Input
          label={t('timeline.eventCategory', 'Category')}
          placeholder={t('timeline.eventCategoryPlaceholder', 'e.g. SAT, Competition...')}
          value={eventForm.category}
          onChangeText={(v) => setEventForm((p) => ({ ...p, category: v }))}
        />
        <Input
          label={t('timeline.eventNotes', 'Notes')}
          placeholder={t('timeline.eventNotesPlaceholder', 'Optional notes...')}
          value={eventForm.notes}
          onChangeText={(v) => setEventForm((p) => ({ ...p, notes: v }))}
          multiline
          numberOfLines={3}
        />
      </Modal>

      <ConfirmDialog
        visible={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={confirmDelete}
        title={t('timeline.deleteConfirmTitle', 'Delete')}
        message={t('timeline.deleteConfirmMessage', 'Are you sure? This cannot be undone.')}
        variant="destructive"
        loading={deleteTl.isPending || deleteEvt.isPending}
      />
    </>
  );
}

// ── Inline Task List ───────────────────────────────────────

function InlineTaskList({
  timelineId,
  colors,
  t,
  onToggle,
  onAdd,
}: {
  timelineId: string;
  colors: ReturnType<typeof useColors>;
  t: any;
  onToggle: (id: string) => void;
  onAdd: () => void;
}) {
  const { data: tasks, isLoading } = useQuery<TaskResponse[]>({
    queryKey: keys.tasks(timelineId),
    queryFn: () => apiClient.get(`/timelines/${timelineId}/tasks`),
    staleTime: 30_000,
  });
  if (isLoading) return <Loading size="small" />;
  return (
    <View style={{ gap: spacing.xs }}>
      {tasks?.length ? (
        tasks.map((tk) => (
          <View key={tk.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Checkbox checked={tk.completed} onPress={() => onToggle(tk.id)} />
            <Ionicons
              name={TASK_ICONS[tk.type] ?? 'ellipsis-horizontal'}
              size={16}
              color={tk.completed ? colors.foregroundMuted : colors.foreground}
              style={{ marginLeft: spacing.xs }}
            />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text
                style={{
                  fontSize: fontSize.sm,
                  color: tk.completed ? colors.foregroundMuted : colors.foreground,
                  textDecorationLine: tk.completed ? 'line-through' : 'none',
                }}
                numberOfLines={1}
              >
                {tk.title}
              </Text>
              {tk.dueDate && (
                <Text
                  style={{ fontSize: fontSize.xs, color: colors.foregroundMuted, marginTop: 2 }}
                >
                  {fmtDate(tk.dueDate)}
                </Text>
              )}
            </View>
          </View>
        ))
      ) : (
        <Text
          style={{
            fontSize: fontSize.sm,
            fontStyle: 'italic',
            color: colors.foregroundMuted,
            paddingVertical: spacing.sm,
          }}
        >
          {t('timeline.noTasks', 'No tasks yet')}
        </Text>
      )}
      <AnimatedButton
        variant="ghost"
        size="sm"
        onPress={onAdd}
        leftIcon={<Ionicons name="add-circle-outline" size={16} color={colors.primary} />}
        style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}
      >
        {t('timeline.addTask', 'Add Task')}
      </AnimatedButton>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  px: { paddingHorizontal: spacing.lg },
  tabs: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerCard: { marginTop: spacing.lg, marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  card: { marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  badges: { flexDirection: 'row', gap: spacing.xs },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deadlineTxt: { fontSize: fontSize.xs },
  daysLeft: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  progRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  progTxt: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    minWidth: 32,
    textAlign: 'right' as const,
  },
  expanded: {
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: spacing.md,
  },
  sectionHdr: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  globalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
});

const styles = StyleSheet.create({
  headerStat: { alignItems: 'center', flex: 1 },
  headerStatVal: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold },
  headerStatLbl: { fontSize: fontSize.xs, marginTop: 2 },
});
