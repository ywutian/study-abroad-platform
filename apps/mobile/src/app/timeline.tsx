/**
 * Timeline Page - Application timelines, tasks, personal & global events.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Stack, router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  UIManager,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InlineTaskList } from '@/components/features/timeline/InlineTaskList';
import {
  TimelineArchive,
  isArchivedPersonalEvent,
  isArchivedTimeline,
} from '@/components/features/timeline/TimelineArchive';
import {
  AnimatedButton,
  AnimatedCard,
  Badge,
  CardContent,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Input,
  Loading,
  Modal,
  Progress,
  Segment,
  Select,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query';
import { fontFamily, fontSize, fontWeight, spacing, useColors, withOpacity } from '@/utils/theme';
import type {
  GlobalEvent as GlobalEventResponse,
  // PersonalEventDetail carries the optional inline `tasks` this screen reads.
  PersonalEventDetail as PersonalEventResponse,
  TaskResponse,
  TimelineOverview,
  TimelineResponse,
  TimelineStatus,
} from '@study-abroad/shared';
import {
  API_ROUTES,
  PERSONAL_EVENT_CATEGORIES,
  resolveApplicationYear,
} from '@study-abroad/shared';
import { TimelineOverviewHeader } from '@/components/features/timeline/TimelineOverviewHeader';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import {
  ROUND_VARIANTS,
  STATUS_VARIANTS,
  TASK_ICONS,
  fmtDate,
  getDaysLeft,
} from './timeline.constants';

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
  const [eventForm, setEventForm] = useState({ title: '', category: 'OTHER', notes: '' });
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
    queryKey: qk.timeline.list(),
    queryFn: () => apiClient.get(API_ROUTES.TIMELINES),
  });
  const {
    data: overview,
    isLoading: ovLoading,
    refetch: refetchOv,
  } = useQuery<TimelineOverview>({
    queryKey: qk.timeline.overview(),
    queryFn: () => apiClient.get(`${API_ROUTES.TIMELINES}/overview`),
    enabled: activeTab === 'overview',
  });
  const {
    data: personalEvents,
    isLoading: peLoading,
    refetch: refetchPe,
  } = useQuery<PersonalEventResponse[]>({
    queryKey: qk.timeline.personal(),
    queryFn: () => apiClient.get(`${API_ROUTES.TIMELINES}/personal-events`),
    enabled: activeTab === 'events' || activeTab === 'archive',
  });
  const yr = new Date().getFullYear();
  const { data: globalEvents, isLoading: geLoading } = useQuery<GlobalEventResponse[]>({
    queryKey: qk.timeline.global(yr),
    queryFn: () => apiClient.get(`${API_ROUTES.TIMELINES}/global-events`, { params: { year: yr } }),
    enabled: activeTab === 'events',
  });

  // ── Mutations ──

  const invalidateTl = () => {
    qc.invalidateQueries({ queryKey: qk.timeline.list() });
    qc.invalidateQueries({ queryKey: qk.timeline.overview() });
  };

  const toggleTask = useMutation<TaskResponse, Error, string>({
    mutationFn: (id) => apiClient.post(`${API_ROUTES.TIMELINES}/tasks/${id}/toggle`),
    onSuccess: () => {
      invalidateTl();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onError: (e) => toast.error(e.message),
  });
  const addTask = useMutation<TaskResponse, Error, { timelineId: string; title: string }>({
    mutationFn: (dto) => apiClient.post(`${API_ROUTES.TIMELINES}/tasks`, dto),
    onSuccess: () => {
      invalidateTl();
      setTaskModal({ visible: false, timelineId: null });
      setNewTaskTitle('');
      toast.success(t('timeline.taskAdded'));
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteTl = useMutation<void, Error, string>({
    mutationFn: (id) => apiClient.delete(`${API_ROUTES.TIMELINES}/${id}`),
    onSuccess: () => {
      invalidateTl();
      toast.success(t('timeline.deleted'));
    },
    onError: (e) => toast.error(e.message),
  });
  const addEvent = useMutation<
    PersonalEventResponse,
    Error,
    { title: string; category: string; notes?: string }
  >({
    mutationFn: (dto) => apiClient.post(`${API_ROUTES.TIMELINES}/personal-events`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.timeline.personal() });
      setEventModal(false);
      setEventForm({ title: '', category: 'OTHER', notes: '' });
      toast.success(t('timeline.eventAdded'));
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteEvt = useMutation<void, Error, string>({
    mutationFn: (id) => apiClient.delete(`${API_ROUTES.TIMELINES}/personal-events/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.timeline.personal() });
      toast.success(t('timeline.deleted'));
    },
    onError: (e) => toast.error(e.message),
  });
  const subscribe = useMutation<PersonalEventResponse, Error, string>({
    mutationFn: (gid) =>
      apiClient.post(`${API_ROUTES.TIMELINES}/personal-events/subscribe`, { globalEventId: gid }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.timeline.personal() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('timeline.subscribed'));
    },
    onError: (e) => toast.error(e.message),
  });
  const togglePTask = useMutation<unknown, Error, string>({
    mutationFn: (id) => apiClient.post(`${API_ROUTES.TIMELINES}/personal-tasks/${id}/toggle`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.timeline.personal() });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Derived ──

  const sorted = useMemo(() => {
    if (!timelines) return [];
    return timelines
      .filter((timeline) => !isArchivedTimeline(timeline))
      .sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
  }, [timelines]);

  const archivedTimelines = useMemo(() => {
    if (!timelines) return [];
    return timelines
      .filter(isArchivedTimeline)
      .sort((a, b) => new Date(b.deadline ?? 0).getTime() - new Date(a.deadline ?? 0).getTime());
  }, [timelines]);

  const currentCycleTimelines = useMemo(() => {
    const currentApplicationYear = resolveApplicationYear();
    return (
      timelines?.filter((timeline) => timeline.applicationYear >= currentApplicationYear) ?? []
    );
  }, [timelines]);

  const activePersonalEvents = useMemo(
    () => personalEvents?.filter((event) => !isArchivedPersonalEvent(event)) ?? [],
    [personalEvents]
  );

  const archivedPersonalEvents = useMemo(
    () => personalEvents?.filter(isArchivedPersonalEvent) ?? [],
    [personalEvents]
  );

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
        activeTab === 'events' || activeTab === 'archive' ? refetchPe() : null,
      ].filter(Boolean)
    );
    setRefreshing(false);
  }, [refetchTl, refetchOv, refetchPe, activeTab]);
  const confirmDelete = () => {
    if (!deleteDialog) return;
    (deleteDialog.type === 'timeline' ? deleteTl : deleteEvt).mutate(deleteDialog.id);
    setDeleteDialog(null);
  };

  const renderHeader = () => (
    <TimelineOverviewHeader timelines={currentCycleTimelines} sorted={sorted} />
  );

  // ── Render: Schools Tab ──

  const renderSchoolCard = (item: TimelineResponse, idx: number, readOnly = false) => {
    const open = expandedId === item.id;
    const days = getDaysLeft(item.deadline);
    const overdue = days !== null && days < 0;
    return (
      <Animated.View key={item.id} entering={FadeInUp.delay(idx * 60).springify()}>
        <AnimatedCard
          style={[s.card, s.statusCard, { borderLeftColor: statusColor(item.status) }]}
          onPress={() => toggle(item.id)}
          accessibilityLabel={item.schoolName}
        >
          <CardContent>
            <View style={s.row}>
              <View style={s.schoolInfo}>
                <Text style={[s.name, { color: colors.foreground }]} numberOfLines={1}>
                  {item.schoolName}
                </Text>
                <View style={s.badges}>
                  <Badge variant={ROUND_VARIANTS[item.round] ?? 'secondary'}>
                    {t(`timeline.round.${item.round}`, item.round)}
                  </Badge>
                  <Badge variant="outline">
                    {t('timeline.applicationYear', { year: item.applicationYear })}
                  </Badge>
                  <Badge variant={STATUS_VARIANTS[item.status] ?? 'secondary'}>
                    {t(`timeline.status.${item.status}`, item.status)}
                  </Badge>
                </View>
              </View>
              <View style={s.deadlineInfo}>
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
                    {overdue ? t('timeline.overdue') : t('timeline.daysLeft', { count: days })}
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
                style={s.flex}
              />
              <Text
                style={[s.progTxt, { color: colors.foregroundMuted, fontFamily: fontFamily.mono }]}
              >
                {item.tasksCompleted}/{item.tasksTotal}
              </Text>
            </View>
            {open && (
              <View style={[s.expanded, { borderTopColor: colors.border }]}>
                <InlineTaskList
                  timelineId={item.id}
                  t={t}
                  readOnly={readOnly}
                  onToggle={(id) => toggleTask.mutate(id)}
                  onAdd={() => {
                    setTaskModal({ visible: true, timelineId: item.id });
                    setNewTaskTitle('');
                  }}
                />
                {!readOnly && (
                  <View style={s.deleteRow}>
                    <AnimatedButton
                      variant="ghost"
                      size="sm"
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setDeleteDialog({ visible: true, type: 'timeline', id: item.id });
                      }}
                      leftIcon={<Ionicons name="trash-outline" size={16} color={colors.error} />}
                    >
                      <Text style={{ color: colors.error }}>{t('timeline.delete')}</Text>
                    </AnimatedButton>
                  </View>
                )}
              </View>
            )}
          </CardContent>
        </AnimatedCard>
      </Animated.View>
    );
  };

  const renderSchools = () => {
    if (tlLoading) return <Loading text={t('timeline.loading')} />;
    if (!sorted.length)
      return (
        <EmptyState
          icon="school-outline"
          title={t('timeline.empty.noSchools')}
          description={t('timeline.empty.noSchoolsDesc')}
          action={{
            label: t('prediction.empty.addSchool'),
            onPress: () => router.push('/find-college'),
          }}
        />
      );
    return <>{sorted.map((x, i) => renderSchoolCard(x, i))}</>;
  };

  // ── Render: Events Tab ──

  const renderEvents = () => {
    if (peLoading || geLoading) return <Loading text={t('timeline.loading')} />;
    return (
      <>
        <View style={s.sectionHdr}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>
            {t('timeline.events.personal')}
          </Text>
          <AnimatedButton
            variant="ghost"
            size="sm"
            onPress={() => setEventModal(true)}
            leftIcon={<Ionicons name="add" size={18} color={colors.primary} />}
          >
            {t('timeline.addEvent')}
          </AnimatedButton>
        </View>
        {!activePersonalEvents.length ? (
          <EmptyState
            icon="calendar-outline"
            title={t('timeline.empty.noEvents')}
            description={t('timeline.empty.noEventsDesc')}
            style={{ paddingVertical: spacing.xl }}
          />
        ) : (
          activePersonalEvents.map((ev, i) => {
            const open = expandedEventId === ev.id;
            const done = ev.tasks?.filter((t) => t.completed).length ?? 0;
            const total = ev.tasks?.length ?? 0;
            return (
              <Animated.View key={ev.id} entering={FadeInUp.delay(i * 60).springify()}>
                <AnimatedCard
                  style={s.card}
                  onPress={() => toggleEvt(ev.id)}
                  accessibilityLabel={ev.title}
                >
                  <CardContent>
                    <View style={s.eventHeader}>
                      <View style={s.eventTitleRow}>
                        <Badge variant="outline">
                          {t(`timeline.category.${ev.category}`, ev.category)}
                        </Badge>
                        <Text
                          style={[s.name, s.flex, { color: colors.foreground }]}
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
                      <View style={[s.deadlineRow, s.marginTopSm]}>
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
                          style={s.flex}
                        />
                        <Text
                          style={[
                            s.progTxt,
                            { color: colors.foregroundMuted, fontFamily: fontFamily.mono },
                          ]}
                        >
                          {done}/{total}
                        </Text>
                      </View>
                    )}
                    {open && (
                      <View style={[s.expanded, { borderTopColor: colors.border }]}>
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
                          style={s.deleteButton}
                        >
                          <Text style={{ color: colors.error }}>{t('timeline.delete')}</Text>
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
            {t('timeline.events.global')}
          </Text>
        </View>
        {!sortedGlobal.length ? (
          <Text style={[s.emptyGlobalText, { color: colors.foregroundMuted }]}>
            {t('timeline.events.noGlobal')}
          </Text>
        ) : (
          <AnimatedCard>
            <CardContent style={s.noVerticalPadding}>
              {sortedGlobal.map((ge, i) => {
                const d = getDaysLeft(ge.eventDate);
                return (
                  <View
                    key={ge.id}
                    style={[
                      s.globalRow,
                      i < sortedGlobal.length - 1 && [
                        s.rowDivider,
                        { borderBottomColor: colors.border },
                      ],
                    ]}
                  >
                    <View style={s.calendarDate}>
                      <Text style={[s.calendarMonth, { color: colors.primary }]}>
                        {new Date(ge.eventDate).toLocaleDateString(undefined, { month: 'short' })}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSize.xl,
                          fontWeight: fontWeight.bold,
                          color: colors.foreground,
                          fontFamily: fontFamily.mono,
                        }}
                      >
                        {new Date(ge.eventDate).getDate()}
                      </Text>
                    </View>
                    <View style={s.flex}>
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
                      <Text style={[s.secondaryText, { color: colors.foregroundMuted }]}>
                        {t(`timeline.category.${ge.category}`, ge.category)}
                        {d !== null && d >= 0 ? ` - ${t('timeline.daysLeft', { count: d })}` : ''}
                      </Text>
                    </View>
                    <AnimatedButton
                      variant="outline"
                      size="sm"
                      onPress={() => subscribe.mutate(ge.id)}
                      disabled={subscribe.isPending}
                    >
                      {t('timeline.events.subscribe')}
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
    if (ovLoading) return <Loading text={t('timeline.loading')} />;
    if (!overview)
      return <EmptyState icon="analytics-outline" title={t('timeline.empty.noData')} />;
    const stats = [
      {
        l: t('timeline.overview.totalSchools'),
        v: overview.totalSchools,
        c: colors.foreground,
        i: 'school-outline' as const,
      },
      {
        l: t('timeline.overview.submitted'),
        v: overview.submitted,
        c: colors.primary,
        i: 'checkmark-circle-outline' as const,
      },
      {
        l: t('timeline.overview.inProgress'),
        v: overview.inProgress,
        c: colors.info,
        i: 'reload-outline' as const,
      },
      {
        l: t('timeline.overview.notStarted'),
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
              style={s.statCard}
            >
              <AnimatedCard>
                <CardContent style={s.centeredCard}>
                  <Ionicons name={st.i} size={22} color={st.c} />
                  <Text
                    style={{
                      fontSize: fontSize['2xl'],
                      fontWeight: fontWeight.bold,
                      color: st.c,
                      fontFamily: fontFamily.mono,
                    }}
                  >
                    {st.v}
                  </Text>
                  <Text
                    style={[s.centeredCaption, { color: colors.foregroundMuted }]}
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
              {t('timeline.overview.upcomingDeadlines')}
            </Text>
            {overview.upcomingDeadlines.slice(0, 5).map((item) => {
              const d = getDaysLeft(item.deadline);
              return (
                <View key={item.id} style={[s.upcomingRow, { borderBottomColor: colors.border }]}>
                  <View style={[s.statusDot, { backgroundColor: statusColor(item.status) }]} />
                  <View style={s.flex}>
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
                    <Text style={[s.secondaryText, { color: colors.foregroundMuted }]}>
                      {fmtDate(item.deadline)}
                    </Text>
                  </View>
                  {d !== null && (
                    <Badge variant={d < 0 ? 'error' : d <= 7 ? 'warning' : 'secondary'}>
                      {d < 0 ? t('timeline.overdue') : `${d}d`}
                    </Badge>
                  )}
                </View>
              );
            })}
          </Animated.View>
        )}
        {overview.overdueTasks.length > 0 && (
          <Animated.View entering={FadeInUp.delay(400).springify()} style={s.marginTopXl}>
            <Text style={[s.sectionTitle, { color: colors.error, marginBottom: spacing.md }]}>
              {t('timeline.overview.overdueTasks')}
            </Text>
            {overview.overdueTasks.map((tk) => (
              <View
                key={tk.id}
                style={[
                  s.overdueTask,
                  {
                    borderColor: withOpacity(colors.error, 0.125),
                    backgroundColor: withOpacity(colors.error, 0.03),
                  },
                ]}
              >
                <Ionicons
                  name={TASK_ICONS[tk.type] ?? 'ellipsis-horizontal'}
                  size={16}
                  color={colors.error}
                />
                <View style={s.flex}>
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
                    <Text style={[s.secondaryText, { color: colors.error }]}>
                      {t('timeline.overdue')} - {fmtDate(tk.dueDate)}
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
      <Stack.Screen options={{ title: t('timeline.title') }} />
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
              { key: 'schools', label: t('timeline.tabs.schools') },
              { key: 'events', label: t('timeline.tabs.events') },
              { key: 'overview', label: t('timeline.tabs.overview') },
              { key: 'archive', label: t('timeline.tabs.archive') },
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
          {activeTab === 'archive' && (
            <TimelineArchive
              timelines={archivedTimelines}
              personalEvents={archivedPersonalEvents}
              loading={tlLoading || peLoading}
              renderSchoolCard={renderSchoolCard}
            />
          )}
        </View>
      </ScrollView>

      <Modal
        visible={taskModal.visible}
        onClose={() => setTaskModal({ visible: false, timelineId: null })}
        title={t('timeline.addTask')}
        footer={
          <AnimatedButton
            onPress={() => {
              if (taskModal.timelineId && newTaskTitle.trim())
                addTask.mutate({ timelineId: taskModal.timelineId, title: newTaskTitle.trim() });
            }}
            disabled={!newTaskTitle.trim() || addTask.isPending}
            loading={addTask.isPending}
          >
            {t('timeline.save')}
          </AnimatedButton>
        }
      >
        <Input
          label={t('timeline.taskTitle')}
          placeholder={t('timeline.taskTitlePlaceholder')}
          value={newTaskTitle}
          onChangeText={setNewTaskTitle}
          autoFocus
        />
      </Modal>

      <Modal
        visible={eventModal}
        onClose={() => setEventModal(false)}
        title={t('timeline.addEvent')}
        footer={
          <AnimatedButton
            onPress={() => {
              if (eventForm.title.trim())
                addEvent.mutate({
                  title: eventForm.title.trim(),
                  category: eventForm.category,
                  notes: eventForm.notes.trim() || undefined,
                });
            }}
            disabled={!eventForm.title.trim() || addEvent.isPending}
            loading={addEvent.isPending}
          >
            {t('timeline.save')}
          </AnimatedButton>
        }
      >
        <Input
          label={t('timeline.eventTitle')}
          placeholder={t('timeline.eventTitlePlaceholder')}
          value={eventForm.title}
          onChangeText={(v) => setEventForm((p) => ({ ...p, title: v }))}
          autoFocus
        />
        <Select
          label={t('timeline.eventCategory')}
          placeholder={t('timeline.eventCategoryPlaceholder')}
          value={eventForm.category}
          onChange={(v) => setEventForm((p) => ({ ...p, category: v }))}
          options={PERSONAL_EVENT_CATEGORIES.map((c) => ({
            value: c,
            label: t(`timeline.category.${c}`, c),
          }))}
        />
        <Input
          label={t('timeline.eventNotes')}
          placeholder={t('timeline.eventNotesPlaceholder')}
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
        title={t('timeline.deleteConfirmTitle')}
        message={t('timeline.deleteConfirmMessage')}
        variant="destructive"
        loading={deleteTl.isPending || deleteEvt.isPending}
      />
    </>
  );
}

import { timelineLocalStyles as s } from './timeline-local.styles';
