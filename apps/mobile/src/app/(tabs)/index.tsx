import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInRight, SlideInUp } from 'react-native-reanimated';

import {
  Badge,
  EmptyState,
  AnimatedButton,
  AnimatedCard,
  CardContent,
  FadeInView,
  StaggeredItem,
  AnimatedSkeleton,
  SkeletonCard,
  SkeletonListItem,
} from '@/components/ui';
import { SchoolAvatar } from '@/components/features/SchoolAvatar';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/stores';
import {
  useColors,
  colors as themeColors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  withOpacity,
} from '@/utils/theme';
import { getResultBadgeVariant } from '@/utils/case-helpers';
import type { School, Case, PaginatedResponse, Profile } from '@/types';

type HomeProfile = Profile & {
  completionPercentage?: number;
};

type SchoolListItem = {
  id: string;
  tier: 'REACH' | 'TARGET' | 'SAFETY' | string;
};

type TimelineOverview = {
  upcomingDeadlines: {
    id: string;
    schoolName: string;
    deadline?: string;
    round?: string;
    status?: string;
  }[];
};

type UpcomingDeadline = TimelineOverview['upcomingDeadlines'][number] & {
  deadline: string;
};

function getProfileCompletion(profile?: HomeProfile): number {
  if (!profile) return 0;
  if (typeof profile.completionPercentage === 'number') {
    return Math.max(0, Math.min(profile.completionPercentage, 100));
  }

  const checkpoints = [
    Boolean(profile.gpa),
    Boolean(profile.currentSchool),
    Boolean(profile.targetMajor),
    Boolean(profile.budgetTier || profile.regionPreference?.length),
    (profile.testScores?.length ?? 0) > 0,
    (profile.activities?.length ?? 0) > 0,
    (profile.awards?.length ?? 0) > 0,
    (profile.education?.length ?? 0) > 0,
    (profile.essays?.length ?? 0) > 0,
  ];

  const completed = checkpoints.filter(Boolean).length;
  return Math.round((completed / checkpoints.length) * 100);
}

function isFutureDeadline(
  item: TimelineOverview['upcomingDeadlines'][number]
): item is UpcomingDeadline {
  if (!item.deadline) return false;
  return new Date(item.deadline) > new Date();
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuthStore();

  // Fetch recent cases
  const {
    data: casesData,
    isLoading: casesLoading,
    refetch: refetchCases,
  } = useQuery({
    queryKey: ['recentCases'],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Case>>('/cases', {
        params: { page: 1, pageSize: 5 },
      }),
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
  });

  // Fetch top schools
  const {
    data: schoolsData,
    isLoading: schoolsLoading,
    refetch: refetchSchools,
  } = useQuery({
    queryKey: ['topSchools'],
    queryFn: () =>
      apiClient.get<PaginatedResponse<School>>('/schools', {
        params: { page: 1, pageSize: 5 },
      }),
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
  });

  // Fetch profile for grade card
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => apiClient.get<HomeProfile>('/profiles/me'),
    enabled: isAuthenticated,
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
  });

  // Fetch school list for tier breakdown
  const { data: schoolList, refetch: refetchSchoolList } = useQuery({
    queryKey: ['schoolList'],
    queryFn: () => apiClient.get<SchoolListItem[]>('/school-lists'),
    enabled: isAuthenticated,
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
  });

  // Fetch upcoming deadlines
  const { data: deadlines, refetch: refetchDeadlines } = useQuery({
    queryKey: ['deadlines', 'upcoming'],
    queryFn: () => apiClient.get<TimelineOverview>('/timelines/overview'),
    enabled: isAuthenticated,
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchCases(),
      refetchSchools(),
      refetchProfile(),
      refetchSchoolList(),
      refetchDeadlines(),
    ]);
    setRefreshing(false);
  };

  const quickActions = useMemo(
    () => [
      {
        icon: 'person-outline' as const,
        title: t('home.features.profile'),
        desc: t('home.features.profileDesc'),
        route: '/(tabs)/profile',
        color: colors.primary,
      },
      {
        icon: 'analytics-outline' as const,
        title: t('home.features.prediction'),
        desc: t('home.features.predictionDesc'),
        route: '/(tabs)/ai',
        color: colors.success,
      },
      {
        icon: 'list-outline' as const,
        title: t('home.features.ranking'),
        desc: t('home.features.rankingDesc'),
        route: '/(tabs)/schools',
        color: colors.warning,
      },
      {
        icon: 'calendar-outline' as const,
        title: t('home.features.timeline'),
        desc: t('home.features.timelineDesc'),
        route: '/timeline',
        color: colors.info,
      },
      {
        icon: 'chatbubbles-outline' as const,
        title: t('home.features.forum'),
        desc: t('home.features.forumDesc'),
        route: '/forum',
        color: colors.accent,
      },
      {
        icon: 'game-controller-outline' as const,
        title: t('home.features.swipe'),
        desc: t('home.features.swipeDesc'),
        route: '/swipe',
        color: colors.error,
      },
    ],
    [t, colors.primary, colors.success, colors.warning, colors.info, colors.accent, colors.error]
  );

  const profileCompletion = useMemo(() => getProfileCompletion(profile), [profile]);

  const profileGrade = useMemo(() => {
    const pct = profileCompletion;
    if (pct >= 90) return { grade: 'A', color: colors.success };
    if (pct >= 80) return { grade: 'B+', color: '#10b981' };
    if (pct >= 70) return { grade: 'B', color: colors.info };
    if (pct >= 50) return { grade: 'C', color: colors.warning };
    return { grade: 'D', color: colors.error };
  }, [profileCompletion, colors]);

  const tierCounts = useMemo(() => {
    const items = schoolList ?? [];
    return {
      reach: items.filter((s) => s.tier === 'REACH').length,
      target: items.filter((s) => s.tier === 'TARGET').length,
      safety: items.filter((s) => s.tier === 'SAFETY').length,
    };
  }, [schoolList]);

  const upcomingDeadlines = useMemo(() => {
    return (deadlines?.upcomingDeadlines ?? [])
      .filter(isFutureDeadline)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 5);
  }, [deadlines]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <Animated.View entering={SlideInUp.duration(500).springify()}>
        <LinearGradient
          colors={[colors.primary, colors.primary + 'cc']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroContent}>
            {isAuthenticated ? (
              <FadeInView animation="fadeUp" delay={200}>
                <Text style={styles.heroWelcome}>{t('home.welcomeBack')}</Text>
                <Text style={styles.heroName}>{user?.email.split('@')[0]}</Text>
              </FadeInView>
            ) : (
              <FadeInView animation="fadeUp" delay={200}>
                <Text style={styles.heroWelcome}>{t('home.guestWelcome')}</Text>
                <Text style={styles.heroSubtitle}>{t('home.loginPrompt')}</Text>
                <AnimatedButton
                  onPress={() => router.push('/(auth)/login')}
                  variant="ghost"
                  style={styles.heroButton}
                  textStyle={styles.heroButtonText}
                >
                  {t('common.login')}
                </AnimatedButton>
              </FadeInView>
            )}
          </View>

          {/* Stats */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(400).springify()}
            style={styles.statsRow}
          >
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {casesData ? casesData.total.toLocaleString() : '-'}
              </Text>
              <Text style={styles.statLabel}>{t('home.stats.cases')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{schoolsData ? `${schoolsData.total}+` : '-'}</Text>
              <Text style={styles.statLabel}>{t('home.stats.schools')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>-</Text>
              <Text style={styles.statLabel}>{t('home.stats.accuracy')}</Text>
            </View>
          </Animated.View>
        </LinearGradient>
      </Animated.View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <FadeInView animation="fadeUp" delay={500}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t('home.quickActions')}
          </Text>
        </FadeInView>
        <View style={styles.actionsGrid}>
          {quickActions.map((action, index) => (
            <StaggeredItem
              key={index}
              index={index}
              staggerDelay={80}
              style={styles.actionCardWrapper}
            >
              <AnimatedCard
                onPress={() => router.push(action.route as Href)}
                style={styles.actionCard}
              >
                <CardContent style={styles.actionCardContent}>
                  <View
                    style={[styles.actionIconContainer, { backgroundColor: action.color + '20' }]}
                  >
                    <Ionicons name={action.icon} size={24} color={action.color} />
                  </View>
                  <Text
                    style={[styles.actionTitle, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {action.title}
                  </Text>
                  <Text
                    style={[styles.actionDesc, { color: colors.foregroundMuted }]}
                    numberOfLines={1}
                  >
                    {action.desc}
                  </Text>
                </CardContent>
              </AnimatedCard>
            </StaggeredItem>
          ))}
        </View>
      </View>

      {/* Profile Grade Card */}
      {isAuthenticated && profile && (
        <View style={styles.section}>
          <FadeInView animation="fadeUp" delay={550}>
            <AnimatedCard onPress={() => router.push('/(tabs)/profile')} style={styles.gradeCard}>
              <CardContent style={styles.gradeCardContent}>
                <View style={[styles.gradeCircle, { borderColor: profileGrade.color }]}>
                  <Text style={[styles.gradeText, { color: profileGrade.color }]}>
                    {profileGrade.grade}
                  </Text>
                </View>
                <View style={styles.gradeInfo}>
                  <Text style={[styles.gradeTitle, { color: colors.foreground }]}>
                    {t('home.profileGrade')}
                  </Text>
                  <Text style={[styles.gradeDesc, { color: colors.foregroundMuted }]}>
                    {t('home.profileCompletion', { pct: profileCompletion })}
                  </Text>
                  {/* Progress bar */}
                  <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(profileCompletion, 100)}%`,
                          backgroundColor: profileGrade.color,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.foregroundMuted} />
              </CardContent>
            </AnimatedCard>
          </FadeInView>
        </View>
      )}

      {/* School Tier Breakdown */}
      {isAuthenticated &&
        schoolList &&
        tierCounts.reach + tierCounts.target + tierCounts.safety > 0 && (
          <View style={styles.section}>
            <FadeInView animation="fadeUp" delay={560}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t('home.schoolTiers')}
              </Text>
              <View style={styles.tierRow}>
                <View
                  style={[styles.tierCard, { backgroundColor: withOpacity(colors.error, 0.1) }]}
                >
                  <Ionicons name="arrow-up" size={20} color={colors.error} />
                  <Text style={[styles.tierValue, { color: colors.error }]}>
                    {tierCounts.reach}
                  </Text>
                  <Text style={[styles.tierLabel, { color: colors.foregroundMuted }]}>
                    {t('home.tiers.reach')}
                  </Text>
                </View>
                <View
                  style={[styles.tierCard, { backgroundColor: withOpacity(colors.warning, 0.1) }]}
                >
                  <Ionicons name="locate" size={20} color={colors.warning} />
                  <Text style={[styles.tierValue, { color: colors.warning }]}>
                    {tierCounts.target}
                  </Text>
                  <Text style={[styles.tierLabel, { color: colors.foregroundMuted }]}>
                    {t('home.tiers.target')}
                  </Text>
                </View>
                <View
                  style={[styles.tierCard, { backgroundColor: withOpacity(colors.success, 0.1) }]}
                >
                  <Ionicons name="shield-checkmark" size={20} color={colors.success} />
                  <Text style={[styles.tierValue, { color: colors.success }]}>
                    {tierCounts.safety}
                  </Text>
                  <Text style={[styles.tierLabel, { color: colors.foregroundMuted }]}>
                    {t('home.tiers.safety')}
                  </Text>
                </View>
              </View>
            </FadeInView>
          </View>
        )}

      {/* Upcoming Deadlines */}
      {isAuthenticated && upcomingDeadlines.length > 0 && (
        <View style={styles.section}>
          <FadeInView animation="fadeUp" delay={570}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t('home.upcomingDeadlines')}
              </Text>
              <AnimatedButton variant="ghost" size="sm" onPress={() => router.push('/timeline')}>
                {t('home.viewAll')}
              </AnimatedButton>
            </View>
            {upcomingDeadlines.map((dl) => {
              const daysLeft = Math.ceil((new Date(dl.deadline).getTime() - Date.now()) / 86400000);
              const urgencyColor =
                daysLeft <= 3
                  ? colors.error
                  : daysLeft <= 7
                    ? colors.warning
                    : colors.foregroundMuted;
              return (
                <View
                  key={dl.id}
                  style={[styles.deadlineItem, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.deadlineInfo}>
                    <Text
                      style={[styles.deadlineSchool, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {dl.schoolName}
                    </Text>
                    <Text style={[styles.deadlineType, { color: colors.foregroundMuted }]}>
                      {dl.round || dl.status || ''}
                    </Text>
                  </View>
                  <View style={styles.deadlineDays}>
                    <Text style={[styles.deadlineDaysValue, { color: urgencyColor }]}>
                      {daysLeft}
                    </Text>
                    <Text style={[styles.deadlineDaysLabel, { color: urgencyColor }]}>
                      {t('home.daysLeft')}
                    </Text>
                  </View>
                </View>
              );
            })}
          </FadeInView>
        </View>
      )}

      {/* Top Schools */}
      <View style={styles.section}>
        <FadeInView animation="fadeUp" delay={600}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t('home.topSchools')}
            </Text>
            <AnimatedButton
              variant="ghost"
              size="sm"
              onPress={() => router.push('/(tabs)/schools')}
            >
              {t('home.viewAll')}
            </AnimatedButton>
          </View>
        </FadeInView>

        {schoolsLoading ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.schoolCard}>
                <AnimatedSkeleton
                  variant="circle"
                  height={64}
                  style={{ alignSelf: 'center', marginBottom: 8 }}
                />
                <AnimatedSkeleton height={14} style={{ marginBottom: 8 }} />
                <AnimatedSkeleton
                  width={80}
                  height={24}
                  borderRadius={12}
                  style={{ alignSelf: 'center' }}
                />
              </View>
            ))}
          </ScrollView>
        ) : schoolsData?.items?.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {schoolsData.items.map((school, index) => (
              <StaggeredItem key={school.id} index={index} staggerDelay={100}>
                <AnimatedCard
                  onPress={() => router.push(`/school/${school.id}`)}
                  style={styles.schoolCard}
                  accessibilityLabel={`${school.name}${school.usNewsRank ? `, #${school.usNewsRank} US News` : ''}`}
                >
                  <CardContent>
                    <SchoolAvatar
                      name={school.name}
                      logoUrl={school.logoUrl}
                      website={school.website}
                      size="lg"
                      style={styles.schoolLogo}
                    />
                    <Text
                      style={[styles.schoolName, { color: colors.foreground }]}
                      numberOfLines={2}
                    >
                      {school.name}
                    </Text>
                    {school.usNewsRank && (
                      <Badge variant="secondary">#{school.usNewsRank} US News</Badge>
                    )}
                  </CardContent>
                </AnimatedCard>
              </StaggeredItem>
            ))}
          </ScrollView>
        ) : (
          <FadeInView animation="zoom">
            <EmptyState icon="school-outline" title={t('schools.noResults')} />
          </FadeInView>
        )}
      </View>

      {/* Recent Cases */}
      <View style={styles.section}>
        <FadeInView animation="fadeUp" delay={700}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t('home.recentCases')}
            </Text>
            <AnimatedButton variant="ghost" size="sm" onPress={() => router.push('/(tabs)/cases')}>
              {t('home.viewAll')}
            </AnimatedButton>
          </View>
        </FadeInView>

        {casesLoading ? (
          <View>
            {[1, 2, 3].map((i) => (
              <SkeletonListItem key={i} hasAvatar={false} />
            ))}
          </View>
        ) : casesData?.items?.length ? (
          casesData.items.map((caseItem, index) => (
            <StaggeredItem key={caseItem.id} index={index} staggerDelay={80}>
              <AnimatedCard
                onPress={() => router.push(`/case/${caseItem.id}`)}
                style={styles.caseCard}
              >
                <CardContent style={styles.caseCardContent}>
                  <View style={styles.caseInfo}>
                    <Text
                      style={[styles.caseSchool, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {caseItem.school?.name || t('common.unknownSchool')}
                    </Text>
                    <Text
                      style={[styles.caseMajor, { color: colors.foregroundMuted }]}
                      numberOfLines={1}
                    >
                      {caseItem.major} · {caseItem.year}
                    </Text>
                  </View>
                  <Badge variant={getResultBadgeVariant(caseItem.result)}>
                    {t(`cases.result.${caseItem.result.toLowerCase()}`)}
                  </Badge>
                </CardContent>
              </AnimatedCard>
            </StaggeredItem>
          ))
        ) : (
          <FadeInView animation="zoom">
            <EmptyState icon="folder-open-outline" title={t('cases.noCases')} />
          </FadeInView>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    padding: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
    borderBottomLeftRadius: borderRadius['2xl'],
    borderBottomRightRadius: borderRadius['2xl'],
  },
  heroContent: {
    marginBottom: spacing.xl,
  },
  heroWelcome: {
    fontSize: fontSize.base,
    color: themeColors.light.onGradientMuted,
    marginBottom: spacing.xs,
  },
  heroName: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: themeColors.light.onGradient,
  },
  heroSubtitle: {
    fontSize: fontSize.sm,
    color: themeColors.light.onGradientMuted,
    marginBottom: spacing.lg,
  },
  heroButton: {
    backgroundColor: themeColors.light.onGradientOverlay,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignSelf: 'flex-start',
  },
  heroButtonText: {
    color: themeColors.light.onGradient,
    fontWeight: fontWeight.semibold,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: themeColors.light.onGradientOverlay,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: themeColors.light.onGradient,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: themeColors.light.onGradientMuted,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: themeColors.light.onGradientOverlay,
    marginHorizontal: spacing.md,
  },
  section: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  viewAll: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  actionCardWrapper: {
    width: '33.33%',
    padding: spacing.xs,
  },
  actionCard: {
    height: 110,
  },
  actionCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  actionDesc: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  horizontalList: {
    paddingRight: spacing.lg,
  },
  schoolCard: {
    width: 140,
    marginRight: spacing.md,
  },
  schoolLogo: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  schoolName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
    marginBottom: spacing.sm,
    height: 36,
  },
  caseCard: {
    marginBottom: spacing.sm,
  },
  caseCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  caseInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  caseSchool: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  caseMajor: {
    fontSize: fontSize.sm,
  },

  // Profile Grade Card
  gradeCard: { marginBottom: 0 },
  gradeCardContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  gradeCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold },
  gradeInfo: { flex: 1 },
  gradeTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  gradeDesc: { fontSize: fontSize.sm, marginBottom: spacing.sm },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },

  // Tier Breakdown
  tierRow: { flexDirection: 'row', gap: spacing.md },
  tierCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    gap: spacing.xs,
  },
  tierValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  tierLabel: { fontSize: fontSize.xs },

  // Deadlines
  deadlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  deadlineInfo: { flex: 1 },
  deadlineSchool: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  deadlineType: { fontSize: fontSize.sm },
  deadlineDays: { alignItems: 'center', marginLeft: spacing.md },
  deadlineDaysValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  deadlineDaysLabel: { fontSize: fontSize.xs },
});
